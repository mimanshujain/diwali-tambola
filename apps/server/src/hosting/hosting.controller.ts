import { Body, Controller, Get, Header, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import QRCode from 'qrcode';
import { HostingService } from './hosting.service.js';
import { cloudMode, hostContext } from './context.js';
import { html } from '../display/theme.js';
import { renderHostInvitationPage, renderLaunchPage, renderPracticePage, renderRulesPage } from '../onboarding/public-pages.js';

function requireCloud():void {if(!cloudMode())throw new NotFoundException();}
function redirect(res:ServerResponse,url:string):void {res.writeHead(302,{Location:url});res.end();}

@Controller()
export class HostingController {
  constructor(private readonly hosting:HostingService) {}

  @Get('/') @Header('Content-Type','text/html; charset=utf-8')
  home():string {
    if (cloudMode()) return renderLaunchPage();
    return html('Tambola','<main class="wrap stack"><h1>Tambola</h1><div class="row"><a class="button" href="/admin">Open host desk</a><a href="/practice">Try a practice round</a><a href="/how-to-play">How to play</a></div></main>','');
  }

  @Get('how-to-play') @Header('Content-Type','text/html; charset=utf-8')
  rules():string {return renderRulesPage(cloudMode());}

  @Get('practice') @Header('Content-Type','text/html; charset=utf-8')
  practice():string {return renderPracticePage(cloudMode());}

  @Get('host') @Header('Content-Type','text/html; charset=utf-8')
  invite():string {requireCloud();return renderHostInvitationPage();}

  @Get('auth/login') @Header('Content-Type','text/html; charset=utf-8')
  login():string {
    requireCloud();return html('Sign in · Tambola',`<main class="wrap stack" style="max-width:560px;padding-top:12vh"><a href="/" class="brand">✦ TAMBOLA</a><section class="panel"><div class="eyebrow">Your host desk</div><h1>A celebration<br>of your own.</h1><p>Sign in with your invited Google account to manage your games.</p><a class="button" href="/auth/google">Continue with Google</a><p class="small" style="margin-top:24px">Only you can manage your games. Guests join separately using your game code.</p></section><a href="/">Joining as a guest? Enter a game code →</a></main>`,'');
  }

  @Get('auth/google')
  async google(@Req() req:IncomingMessage,@Res() res:ServerResponse):Promise<void> {requireCloud();redirect(res,await this.hosting.begin(req,res));}

  @Get('auth/callback')
  async callback(@Req() req:IncomingMessage,@Res() res:ServerResponse,@Query('code') code:unknown,@Query('state') state:unknown):Promise<void> {
    requireCloud();
    try {await this.hosting.finish(req,res,code,state);redirect(res,'/admin');}
    catch {res.statusCode=401;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html('Sign-in unsuccessful',`<main class="wrap" style="max-width:600px"><h1>We couldn’t sign you in.</h1><p>Use your invited Google account and finish signing in within ten minutes. If you need an invitation, contact the person running this service.</p><a class="button" href="/auth/login">Try again</a></main>`,''));}
  }

  @Get('auth/me')
  me(){requireCloud();return hostContext.getStore();}

  @Post('auth/logout')
  async logout(@Req() req:IncomingMessage,@Res({passthrough:true}) res:ServerResponse):Promise<{signedOut:boolean}> {requireCloud();await this.hosting.logout(req,res);return {signedOut:true};}

  @Get('screen') @Header('Content-Type','text/html; charset=utf-8')
  screen():string {
    requireCloud();return html('Connect TV · Tambola',`<main class="wrap stack" style="max-width:650px;padding-top:10vh"><div class="brand">✦ TAMBOLA</div><section class="panel"><h1>Connect this TV</h1><ol><li>On the host’s phone, open the game, then <strong>TV &amp; guest links → Pair a TV</strong>.</li><li>Enter the ten-character <strong>TV pairing code</strong> below. The six-character game code is for guests.</li><li>When the board opens, press <strong>Sound</strong> and scan the guest QR with a phone to test it.</li></ol><form id="pair"><label>TV pairing code<input id="code" maxlength="12" required autocomplete="off" autocapitalize="characters" placeholder="A1B2C D3E4F" style="font-size:28px;letter-spacing:.12em;text-transform:uppercase"></label><button id="connect">Connect this TV →</button></form><p id="error" role="status" class="notice"></p><p class="small">The TV shows the game board and guest QR. Use the host phone for game controls. If the pairing code has expired, generate a new one.</p></section></main>`,String.raw`
      const input=document.getElementById('code'),button=document.getElementById('connect');
      async function connect(){button.disabled=true;try{const r=await fetch('/screen/connect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:input.value})});const data=await r.json();if(!r.ok)throw Error(data.message||'Unable to connect');location.replace(data.url);}catch(e){document.getElementById('error').textContent=e.message;}finally{button.disabled=false;}}
      document.getElementById('pair').onsubmit=e=>{e.preventDefault();connect();};
      const code=location.hash.slice(1);history.replaceState(null,'','/screen');if(/^[A-F0-9]{10}$/.test(code)){input.value=code;connect();}
    `);
  }

  @Post('screen/connect')
  async connect(@Body() body:{code?:unknown},@Res({passthrough:true}) res:ServerResponse){requireCloud();return this.hosting.connect(res,body?.code);}

  @Post('games/:gameId/admin/tv-pair')
  async pair(@Param('gameId') gameId:string){requireCloud();const pair=await this.hosting.pair(gameId);return {...pair,qr:await QRCode.toString(pair.url,{type:'svg',margin:2,width:280})};}

  @Post('games/:gameId/admin/tv-revoke')
  async revoke(@Param('gameId') gameId:string){requireCloud();await this.hosting.revokeDisplays(gameId);return {revoked:true};}
}
