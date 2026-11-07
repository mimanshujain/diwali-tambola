import { ForbiddenException, HttpException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DatabaseService } from '../database/database.service.js';
import { allowedEmails, cloudMode, cloudOrigin, hostContext, type HostIdentity } from './context.js';
import { accessPolicy } from './access-policy.js';

export const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
const secret = (): string => randomBytes(32).toString('base64url');
const SESSION = '__Host-tambola-host', BROWSER = '__Host-tambola-login', SCREEN = '__Host-tambola-screen';
export function cookie(req: IncomingMessage, name: string): string {
  return (req.headers.cookie ?? '').split(';').map(v => v.trim()).find(v => v.startsWith(name + '='))?.slice(name.length + 1) ?? '';
}
function setCookie(res: ServerResponse, name: string, value: string, seconds: number): void {
  res.setHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`);
}
type WebRequest = IncomingMessage & { ip?: string };

@Injectable()
export class HostingService {
  private readonly attempts = new Map<string, {at:number; count:number}>();
  constructor(private readonly db: DatabaseService) {}

  private google(): OAuth2Client {
    return new OAuth2Client({clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,
      redirectUri:cloudOrigin() + '/auth/callback',transporterOptions:{timeout:10000}});
  }

  async begin(req: IncomingMessage, res: ServerResponse): Promise<string> {
    const state = secret(), browser = secret(), nonce = secret();
    const client = this.google(), pkce = await client.generateCodeVerifierAsync();
    await this.db.query(`DELETE FROM oauth_attempts WHERE expires_at < NOW()`);
    await this.db.query(`INSERT INTO oauth_attempts(state_hash,browser_hash,verifier,nonce,expires_at)
      VALUES($1,$2,$3,$4,NOW()+INTERVAL '10 minutes')`, [digest(state),digest(browser),pkce.codeVerifier,nonce]);
    setCookie(res,BROWSER,browser,600);
    return client.generateAuthUrl({scope:['openid','email','profile'],state,nonce,prompt:'select_account',
      code_challenge:pkce.codeChallenge,code_challenge_method:CodeChallengeMethod.S256});
  }

  async finish(req: IncomingMessage, res: ServerResponse, code: unknown, state: unknown): Promise<void> {
    if (typeof code !== 'string' || typeof state !== 'string' || code.length > 4096 || state.length > 128) throw new UnauthorizedException('Sign-in expired. Please try again.');
    const browser = cookie(req,BROWSER);
    const attempt = (await this.db.query<{verifier:string;nonce:string}>(`DELETE FROM oauth_attempts
      WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>NOW() RETURNING verifier,nonce`,[digest(state),digest(browser)])).rows[0];
    if (!browser || !attempt) throw new UnauthorizedException('Sign-in expired. Please try again.');
    const client = this.google();
    const {tokens} = await client.getToken({code,codeVerifier:attempt.verifier});
    if (!tokens.id_token) throw new UnauthorizedException('Unable to verify Google account');
    const identity = (await client.verifyIdToken({idToken:tokens.id_token,audience:process.env.GOOGLE_CLIENT_ID})).getPayload();
    if (!identity || identity.nonce !== attempt.nonce || identity.email_verified !== true || !identity.email || !allowedEmails().has(identity.email.toLowerCase())) {
      throw new ForbiddenException('This host account has not been invited. Contact the organizer of this service.');
    }
    const email = identity.email.toLowerCase(), name = (identity.name ?? identity.email).slice(0,150);
    const token = secret();
    await this.db.transaction(async db => {
      const host = (await db.query<{id:string}>(`INSERT INTO hosts(google_subject,email,name) VALUES($1,$2,$3)
        ON CONFLICT(google_subject) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name RETURNING id`,
        [identity.sub,email,name])).rows[0];
      await db.query('DELETE FROM host_sessions WHERE token_hash=$1 OR expires_at<NOW()', [digest(cookie(req,SESSION))]);
      await db.query(`INSERT INTO host_sessions(token_hash,host_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '7 days')`,[digest(token),host.id]);
    });
    setCookie(res,SESSION,token,7*86400);
  }

  async logout(req: IncomingMessage, res: ServerResponse): Promise<void> {
    await this.db.query('DELETE FROM host_sessions WHERE token_hash=$1',[digest(cookie(req,SESSION))]);
    setCookie(res,SESSION,'',0);
  }

  async pair(gameId: string): Promise<{code:string;url:string;expiresInSeconds:number}> {
    const code = randomBytes(5).toString('hex').toUpperCase();
    await this.db.transaction(async db => {
      await db.query('SELECT id FROM games WHERE id=$1 FOR UPDATE',[gameId]);
      await db.query("DELETE FROM display_access WHERE (game_id=$1 AND kind='PAIR') OR expires_at<NOW()",[gameId]);
      await db.query(`INSERT INTO display_access(token_hash,game_id,kind,expires_at) VALUES($1,$2,'PAIR',NOW()+INTERVAL '10 minutes')`,[digest(code),gameId]);
    });
    return {code,url:cloudOrigin()+'/screen#'+code,expiresInSeconds:600};
  }

  async connect(res: ServerResponse, input: unknown): Promise<{url:string}> {
    const code = typeof input === 'string' ? input.replace(/[ -]/g,'').toUpperCase() : '';
    if (!/^[A-F0-9]{10}$/.test(code)) throw new UnauthorizedException('Invalid or expired TV code');
    const token = secret();
    const joinCode = await this.db.transaction(async db => {
      // Lock game before pairing rows, matching revoke/pair lock order.
      const candidate = (await db.query<{game_id:string}>("SELECT game_id FROM display_access WHERE token_hash=$1 AND kind='PAIR'",[digest(code)])).rows[0];
      if (!candidate) throw new UnauthorizedException('Invalid or expired TV code');
      const game = (await db.query<{join_code:string}>('SELECT join_code FROM games WHERE id=$1 FOR UPDATE',[candidate.game_id])).rows[0];
      const access = await db.query(`DELETE FROM display_access WHERE token_hash=$1 AND kind='PAIR' AND expires_at>NOW() RETURNING game_id`,[digest(code)]);
      if (!access.rowCount || !game) throw new UnauthorizedException('Invalid or expired TV code');
      await db.query(`INSERT INTO display_access(token_hash,game_id,kind,expires_at) VALUES($1,$2,'SESSION',NOW()+INTERVAL '24 hours')`,[digest(token),candidate.game_id]);
      return game.join_code;
    });
    setCookie(res,SCREEN,token,86400);
    return {url:'/tv/'+joinCode};
  }

  async revokeDisplays(gameId:string):Promise<void> {
    await this.db.transaction(async db => {
      await db.query('SELECT id FROM games WHERE id=$1 FOR UPDATE',[gameId]);
      await db.query('DELETE FROM display_access WHERE game_id=$1',[gameId]);
    });
  }

  private limit(req:WebRequest,path:string):void {
    const category = path === '/auth/google' ? 'login' : path === '/screen/connect' ? 'pair' : path.endsWith('/players/register') ? 'register' : path.endsWith('/players/recover') ? 'recover' : null;
    if (!category) return;
    const now=Date.now(),key=category+':'+(req.ip ?? req.socket.remoteAddress ?? 'unknown');
    if (this.attempts.size>10000) for (const [k,v] of this.attempts) if(now-v.at>=600000)this.attempts.delete(k);
    const state=this.attempts.get(key);
    if (!state || now-state.at>=600000) {
      if(this.attempts.size>=20000) throw new HttpException('Please try again shortly',429);
      this.attempts.set(key,{at:now,count:1});return;
    }
    if (++state.count > (category==='register'?300:60)) throw new HttpException('Too many attempts. Try again in 10 minutes.',429);
  }

  /** Runs before all controllers. Legacy admin headers have no authority in cloud mode. */
  async access(req:WebRequest,res:ServerResponse,next:()=>void):Promise<void> {
    if (!cloudMode()) {next();return;}
    res.setHeader('Cache-Control','no-store, private');
    res.setHeader('Strict-Transport-Security','max-age=31536000');
    try {
      const path = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/\/$/,'').toLowerCase() || '/';
      const method = req.method === 'HEAD' ? 'GET' : req.method ?? 'GET';
      if (!path.startsWith('/health/') && req.headers.host !== new URL(cloudOrigin()).host) throw new ForbiddenException('Invalid application host');
      // Same-origin requirement covers host cookies, login/logout and TV pairing.
      // Bearer-authenticated guest APIs do not use cookies for identity.
      const policy = accessPolicy(method,path);
      if (!['GET','HEAD','OPTIONS'].includes(method) && (policy.kind!=='public' || path==='/screen/connect') && req.headers.origin !== cloudOrigin()) throw new ForbiddenException('Open the app on its configured address and try again');
      this.limit(req,path);
      if (policy.kind==='public') {next();return;}
      const token = cookie(req,SESSION);
      const host = token ? (await this.db.query<HostIdentity>(`SELECT h.id,h.email,h.name FROM hosts h JOIN host_sessions s ON s.host_id=h.id
        WHERE s.token_hash=$1 AND s.expires_at>NOW()`,[digest(token)])).rows[0] : undefined;
      const identity = host && allowedEmails().has(host.email.toLowerCase()) ? host : undefined;
      let gameId = policy.game;
      if (policy.reference) {
        const found = (await this.db.query<{id:string}>('SELECT id FROM games WHERE id::text=$1 OR join_code=$2',[policy.reference,policy.reference.toUpperCase()])).rows[0];
        gameId=found?.id;
        if (!gameId) throw new NotFoundException('Game not found');
      }
      if (gameId) {
        const owned = identity && (await this.db.query('SELECT 1 FROM games WHERE id=$1 AND host_id=$2',[gameId,identity.id])).rowCount;
        if (!owned) {
          const screen = policy.kind==='screen' && cookie(req,SCREEN) && (await this.db.query(`SELECT 1 FROM display_access d JOIN games g ON g.id=d.game_id JOIN hosts h ON h.id=g.host_id
            WHERE d.token_hash=$1 AND d.game_id=$2 AND d.kind='SESSION' AND d.expires_at>NOW() AND lower(h.email)=ANY($3::text[])`,
            [digest(cookie(req,SCREEN)),gameId,[...allowedEmails()]])).rowCount;
          if (screen) {next();return;}
          if (method==='GET' && /^\/tv\/[^/]+$/.test(path)) {res.writeHead(302,{Location:'/screen'});res.end();return;}
          if(identity)throw new NotFoundException('Game not found');
          if(method==='GET' && /^\/admin\/[^/]+$/.test(path)){res.writeHead(302,{Location:'/auth/login'});res.end();return;}
          throw new UnauthorizedException('Sign in or pair this TV');
        }
      } else if (!identity) {
        if(method==='GET' && path==='/admin'){res.writeHead(302,{Location:'/auth/login'});res.end();return;}
        throw new UnauthorizedException('Sign in to your host account');
      }
      hostContext.run(identity!,next);
    } catch(error) {
      const status=error instanceof HttpException ? error.getStatus() : error instanceof URIError ? 400 : 503;
      res.statusCode=status;res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({statusCode:status,message:error instanceof HttpException?error.message:'Service unavailable. Please retry.'}));
    }
  }
}
