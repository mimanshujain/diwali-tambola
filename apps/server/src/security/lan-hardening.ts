import { assertAdmin } from './admin.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Small LAN-only guard. It does not replace TLS, network isolation or authentication. */
export function lanHardening(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if (/^\/(?:admin(?:\/|$)|games\/[^/]+\/admin(?:\/|$))/.test(req.url ?? '')) {
    res.setHeader('Cache-Control','no-store, private');
  }
  next();
}

/** Constrains sustained online admin-key guessing on one local Node process.
 * Restricts only protected game admin routes, not game draws, guests or TV.
 * True distributed protection requires a reverse proxy and TLS.
 */
const attempts = new Map<string,{start:number,count:number}>();
export function adminRateLimit(req: IncomingMessage,res: ServerResponse,next: () => void):void {
  const path = (req.url ?? '').split('?')[0];
  if (!/^\/games\/[^/]+\/admin(?:\/|$)/.test(path)) {next();return;}
  // A valid host key must not be locked out by live refreshes or emergency controls.
  try { const key=req.headers['x-admin-key'];assertAdmin(typeof key==='string'?key:undefined);next();return; } catch { /* Rate-limit invalid credentials below. */ }
  const ip = req.socket.remoteAddress ?? 'unknown';
  const now=Date.now();
  let state=attempts.get(ip);
  if (!state || now-state.start >= 60_000) {state={start:now,count:0};attempts.set(ip,state);}
  if (++state.count > 120){
    res.statusCode=429;
    res.setHeader('Retry-After','60');
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({statusCode:429,message:'Too many admin requests; retry shortly'}));
    return;
  }
  if (attempts.size>1000)for(const [key,value] of attempts){if(now-value.start>60_000)attempts.delete(key);}
  next();
}
