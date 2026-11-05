/** Same-origin Socket.IO client; scheduled full refresh remains the fallback. */
export const LIVE_CLIENT_JS = String.raw`
(function(){
  const parts = location.pathname.split('/').filter(Boolean);
  const reference = (parts[0] === 'tv' && document.querySelector('[data-game-id]')?.dataset.gameId) || parts[1];
  const gameId = parts.length === 2 && /^(tv|join|admin)$/.test(parts[0]) ? reference?.toLowerCase() : null;
  if (!gameId || !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(gameId)) return;
  const status = document.createElement('div');
  status.id = 'live-indicator'; status.setAttribute('role', 'status');
  status.style.cssText='position:fixed;bottom:10px;right:10px;padding:6px 10px;background:#182739;color:#d6e7f7;border:1px solid #4e6377;border-radius:15px;font:12px system-ui;z-index:99;pointer-events:none';
  status.textContent = 'Connecting'; document.body.append(status);
  let timer = null;
  function refreshSoon(){if(timer)return;timer=setTimeout(function(){timer=null;window.dispatchEvent(new Event('tambola:changed'));},120);}
  if(typeof io !== 'function') {status.textContent='Polling fallback';return;}
  const socket=io({path:'/socket.io',transports:['websocket','polling'],reconnection:true,reconnectionDelay:500,reconnectionDelayMax:5000,timeout:10000});
  socket.on('connect',function(){socket.emit('game:join',{gameId});});
  socket.on('game:joined',function(){status.textContent='Live connected';refreshSoon();});
  socket.on('game:changed',function(payload){if(payload && payload.gameId===gameId)refreshSoon();});
  socket.on('game:error',function(){status.textContent='Live unavailable · polling';});
  socket.on('disconnect',function(){status.textContent='Reconnecting · polling';});
  socket.on('connect_error',function(){status.textContent='Polling fallback';});
  window.addEventListener('focus',refreshSoon);
  window.addEventListener('online',refreshSoon);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)refreshSoon();});
})();`;
