/** M7 acceptance test with Node 26 built-in WebSocket; no test packages required.
 * Run from within the API container, e.g.:
 *   sudo docker compose exec -T api node --input-type=module - < tests/m7-live.mjs
 * Optional: --clients=25 (when executing as a file in the container).
 */
import assert from 'node:assert/strict';

const root = 'http://127.0.0.1:3000';
const adminKey = process.env.ADMIN_TOKEN;
assert(adminKey, 'ADMIN_TOKEN is required in test environment');
const countArg = process.argv.find(x => x.startsWith('--clients='));
const clients = countArg ? Number(countArg.split('=')[1]) : Number(process.env.M7_TEST_CLIENTS ?? '1');
assert(Number.isInteger(clients) && clients >= 1 && clients <= 50, 'clients must be 1..50');

async function api(path, method='GET', body, auth=true) {
  const response = await fetch(root+path, {
    method,
    headers:{'content-type':'application/json',...(auth?{'x-admin-key':adminKey}:{})},
    body:body === undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(12_000),
  });
  const raw=await response.text();
  assert(response.ok, `${method} ${path}: HTTP ${response.status}: ${raw.slice(0,200)}`);
  return raw ? JSON.parse(raw) : undefined;
}

function watch(gameId) {
  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(`ws://127.0.0.1:3000/socket.io/?EIO=4&transport=websocket`);
    let ready=false;let closed=false;const changes=[];const waiters=[];
    const timeout=setTimeout(()=>reject(new Error('Socket.IO game:joined timed out')),10_000);
    const watcher={
      socket,
      nextChange(ms=10_000){
        if(changes.length)return Promise.resolve(changes.shift());
        return new Promise((yes,no)=>{
          const t=setTimeout(()=>{const i=waiters.indexOf(accept);if(i>=0)waiters.splice(i,1);no(new Error('Missing game:changed notification'));},ms);
          function accept(packet){clearTimeout(t);yes(packet);}
          waiters.push(accept);
        });
      },
      close(){if(!closed){closed=true;socket.close();}},
    };
    socket.onmessage=({data})=>{
      const packet=String(data);
      if(packet==='2'){socket.send('3');return;}
      if(packet.startsWith('0')){socket.send('40');return;}
      if(packet.startsWith('40')){socket.send('42'+JSON.stringify(['game:join',{gameId}]));return;}
      if(!packet.startsWith('42'))return;
      let event;
      try{event=JSON.parse(packet.slice(2));}catch{return;}
      if(event[0]==='game:joined' && !ready){ready=true;clearTimeout(timeout);resolve(watcher);}
      if(event[0]==='game:error'){clearTimeout(timeout);reject(new Error(JSON.stringify(event[1])));}
      if(event[0]==='game:changed'){
        const change=event[1];
        assert.deepEqual(Object.keys(change),['gameId'], 'Private state leaked on public socket');
        if(waiters.length)waiters.shift()(change);else changes.push(change);
      }
    };
    socket.onerror=()=>{if(!ready){clearTimeout(timeout);reject(new Error('WebSocket failed to connect'));}};
    socket.onclose=()=>{closed=true;if(!ready){clearTimeout(timeout);reject(new Error('Socket closed before joining game'));}};
  });
}

console.log('[1/5] Health and browser live scripts');
await api('/health/ready');
for(const url of ['/socket.io/socket.io.js','/live/client.js']){
  const response=await fetch(root+url,{signal:AbortSignal.timeout(10_000)});
  assert.equal(response.status,200, `${url} is not served`);
}
console.log('[2/5] Create an isolated game');
const game = await api('/games', 'POST', {name:'M7 Live Test',intervalSeconds:300});
assert(game.id);
const watchers=[];
try{
  console.log(`[3/5] Join ${clients} Socket.IO watcher(s)`);
  for(let i=0;i<clients;i+=10){
    const group=await Promise.all(Array.from({length:Math.min(10,clients-i)},()=>watch(game.id)));
    watchers.push(...group);
  }
  console.log('[4/5] Start game; verify post-commit notification to every watcher');
  await api(`/games/${game.id}/start`,'POST');
  for(const p of await Promise.all(watchers.map(w=>w.nextChange())))assert.equal(p.gameId,game.id);
  console.log('[5/5] Manual call; verify notifications and authoritative snapshot');
  await api(`/games/${game.id}/calls/manual`,'POST',{number:47});
  for(const p of await Promise.all(watchers.map(w=>w.nextChange())))assert.equal(p.gameId,game.id);
  const snapshot=await api(`/games/${game.id}/display`,'GET',undefined,false);
  assert.equal(snapshot.calls.length,1);
  assert.equal(snapshot.calls[0].number,47);
  console.log(`PASS — M7 live synchronization for ${clients} watcher(s); game ${game.id}`);
}finally{
  await api(`/games/${game.id}/pause`,'POST').catch(()=>undefined);
  for(const watcher of watchers)watcher.close();
}
