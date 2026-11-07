const uuid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}';
const game = new RegExp('^/games/(' + uuid + ')(?:/(.*))?$');
export type Access = { kind: 'public' | 'host' | 'screen'; game?: string; reference?: string };

/** Explicit public allowlist. Newly added API routes require a host by default. */
export function accessPolicy(method: string, path: string): Access {
  if (method === 'GET' && /^(?:\/|\/auth\/(?:login|google|callback)|\/health\/(?:live|ready)|\/(?:live|party|print)\/client\.js|\/g\/[A-Za-z2-9]{6}|\/join\/[0-9a-fA-F-]{36}|\/screen)$/.test(path)) return {kind:'public'};
  if (path.startsWith('/socket.io/')) return {kind:'public'}; // Invalidation messages only; snapshots enforce access.
  if (method === 'POST' && path === '/screen/connect') return {kind:'public'};
  const match = game.exec(path);
  if (match) {
    const suffix = match[2] ?? '';
    if (method === 'GET' && ['guest-display','players/me','players/me/power'].includes(suffix)) return {kind:'public'};
    if (method === 'POST' && ['players/register','players/recover','players/me/submit','players/me/regenerate','players/me/claims','players/me/power/request'].includes(suffix)) return {kind:'public'};
    return {kind: method === 'GET' && ['display','calls','categories',''].includes(suffix) ? 'screen' : 'host',game:match[1]};
  }
  const admin = new RegExp('^/admin/(' + uuid + ')(?:/tv-qr\\.svg)?$').exec(path);
  if (admin) return {kind:'host',game:admin[1]};
  const tv = /^\/tv\/([A-Za-z0-9-]+)(?:\/qr\.svg)?$/.exec(path);
  if (tv && method === 'GET') return {kind:'screen',reference:tv[1]};
  return {kind:'host'};
}
