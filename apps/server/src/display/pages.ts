/** Zero-build LAN UI. No CDN, remote assets, or extra browser port required. */
const styles = String.raw`
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#fcf9f2;color-scheme:dark;background:#101722}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 15% 2%,#293a52 0,transparent 36%),#101722}
a{color:#fbc572}button,input,select{font:inherit}button{background:#ffc466;color:#20160c;font-weight:800;border:0;border-radius:10px;padding:12px 18px;cursor:pointer}
button.ghost{background:#273448;color:#fff;border:1px solid #546478}button.red{background:#ed807f;color:#221414}button:disabled{opacity:.45;cursor:not-allowed}
input,select{background:#121a27;border:1px solid #59687a;color:#fff;border-radius:8px;padding:11px;width:100%;min-width:0}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 25px;border-bottom:1px solid #42536a;background:#121c2aee}
.brand{font-weight:900;color:#ffd28a;letter-spacing:.05em}h1,h2,h3{margin:8px 0 16px}h1{font-size:clamp(27px,3vw,44px)}h2{font-size:22px}
.wrap{max-width:1480px;margin:auto;padding:22px}.columns{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px}
.panel{background:#1b2738;border:1px solid #42536a;border-radius:18px;padding:20px;margin-bottom:18px;min-width:0}
.small{font-size:13px;color:#b9c8d9}.muted{color:#b5c5d7}.pill{display:inline-block;border:1px solid #536b7e;background:#27394c;border-radius:20px;padding:5px 11px;font-size:12px}
.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.row>*{flex-shrink:0}.field{min-width:120px;flex:1}label{display:block;font-size:13px;color:#bfd0e0;margin:6px 0}
#message,.message{color:#ffc39d;min-height:20px;margin:7px 0}.board{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:7px}
.ball{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:12px;background:#29374b;border:1px solid #41516a;font-weight:800;font-size:clamp(12px,1.6vw,22px);font-variant-numeric:tabular-nums}
.ball.hit{background:#e7b45a;border-color:#ffda93;color:#221a14}.ball.latest{box-shadow:0 0 0 3px #fff3c6}
.hero{font-size:clamp(90px,17vw,240px);font-weight:1000;line-height:1;color:#ffe0a0;text-align:center;letter-spacing:-.05em;text-shadow:0 12px 80px #ba832052}
.countdown{font-variant-numeric:tabular-nums;font-size:26px;font-weight:700;color:#ffd08a}
.item{border-bottom:1px solid #34475a;padding:10px 0}.item:last-child{border:0}.qr{background:#fff;padding:12px;border-radius:13px;width:min(100%,275px);display:block;margin:auto}
#players,#winners,#powers,#claims,#power-requests,#rounds{max-height:340px;overflow:auto} .admin-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
@media(max-width:850px){.columns,.admin-grid{grid-template-columns:1fr}.wrap{padding:12px}header{padding:14px}.panel{padding:15px}.board{gap:4px}.ball{border-radius:7px;font-size:12px}}
@media print{header,.no-print{display:none!important}body{color:#000;background:#fff}.panel{border:0;background:#fff;color:#000}}
`;
function html(title:string,body:string,js:string):string{
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>'+styles+'</style></head><body>'+body+'<script>'+js+'</script><script src="/socket.io/socket.io.js"></script><script src="/live/client.js"></script><script src="/party/client.js"></script></body></html>';
}
export function tvPage(_gameId:string):string{
  return html('Diwali Tambola · TV',String.raw`
<header><div class="brand">✦ DIWALI TAMBOLA</div><div><span id="gameName">Loading game…</span> &nbsp; <span id="status" class="pill">—</span></div></header>
<div class="wrap columns"><main>
<div class="panel"><div class="row" style="justify-content:space-between"><span class="muted">CURRENT NUMBER</span><span id="countdown" class="countdown">—</span></div><div class="hero" id="latest">—</div><div class="muted" style="text-align:center">Watch for the next call · Called <b id="count">0</b> / 90</div></div>
<div class="panel"><h2>Numbers called</h2><div id="board" class="board"></div><p class="small">New calls are highlighted automatically.</p></div>
<div class="panel"><h2>Prize board</h2><div id="winners"><span class="muted">No winners announced yet.</span></div></div>
</main><aside>
<div class="panel"><h2>Join the game</h2><img id="qr" class="qr" alt="QR code to join Tambola"><div style="text-align:center;margin:14px 0"><div class="small">GAME CODE</div><div id="joinCode" style="font-size:clamp(28px,3.6vw,54px);letter-spacing:.14em;font-weight:900;color:#ffd28a">------</div></div><p class="small" style="overflow-wrap:anywhere;text-align:center" id="joinUrl"></p></div>
<div class="panel"><h2>Players <span id="playerCount" class="pill">0</span></h2><div id="players"></div></div>
<div class="panel"><h2>✨ Lucky Strikes</h2><div id="powers" class="small">No Lucky Strikes yet</div></div>
<div class="panel"><h2>Sudden Death</h2><div id="rounds" class="small">No tie-break round</div></div>
</aside></div>`,String.raw`
(function(){
const id=location.pathname.split('/').pop();const $=s=>document.querySelector(s);let game=null;
$('#qr').src='/tv/'+encodeURIComponent(id)+'/qr.svg';
$('#joinUrl').textContent='Loading game code…';
const board=$('#board');for(let n=1;n<=90;n++){const el=document.createElement('div');el.className='ball';el.id='n'+n;el.textContent=String(n);board.appendChild(el);}
function fill(container,rows,make){container.replaceChildren();if(!rows.length){container.textContent='—';return;}rows.forEach(r=>{const el=document.createElement('div');el.className='item';el.textContent=make(r);container.appendChild(el);});}
async function refresh(){try{
 const r=await fetch('/games/'+encodeURIComponent(id)+'/display',{cache:'no-store'});if(!r.ok)throw Error('Game '+r.status);const s=await r.json();game=s.game;
 $('#gameName').textContent=game.name;$('#status').textContent=game.status;$('#count').textContent=String(s.calls.length);
 $('#joinCode').textContent=game.joinCode;$('#joinUrl').textContent=location.origin+'/g/'+game.joinCode;
 const last=s.calls.length?s.calls[s.calls.length-1]:null;$('#latest').textContent=last?last.number:'—';
 const seen=new Set(s.calls.map(x=>x.number));for(let n=1;n<=90;n++){const el=$('#n'+n);el.className='ball'+(seen.has(n)?' hit':'')+(last&&last.number===n?' latest':'');}
 $('#playerCount').textContent=String(s.players.length);fill($('#players'),s.players,x=>x.name+(x.submitted?' ✓':' · reviewing'));
 fill($('#winners'),s.winners,x=>x.category_name+' · '+x.name);
 fill($('#powers'),s.powerCalls,x=>x.name+' chose '+x.number+' (#'+x.sequence+')');
 fill($('#rounds'),s.suddenDeath,x=>x.category_name+' · '+x.status+' · '+x.draw_sequence+' draws');
}catch(e){$('#status').textContent='Connection lost — retrying';}}
function clock(){if(!game)return;if(game.status!=='RUNNING'||!game.nextCallAt){$('#countdown').textContent=game.status==='PAUSED'?'PAUSED':'—';return;}
 const left=Math.max(0,Math.ceil((new Date(game.nextCallAt).getTime()-Date.now())/1000));
 $('#countdown').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');}
refresh();setInterval(refresh,30000);window.addEventListener('tambola:changed',refresh);setInterval(clock,300);
})();`);
}
export function homeAdminPage():string{
  return html('Diwali Tambola · New Game',String.raw`
<header><div class="brand">✦ TAMBOLA ADMIN</div></header><main class="wrap" style="max-width:700px"><div class="panel"><h1>New game</h1>
<label>Admin key<input id="key" type="password" autocomplete="off" placeholder="From the Pi's .env file"></label>
<label>Game name<input id="name" value="Diwali Tambola"></label>
<label>Seconds between calls<input id="interval" type="number" min="10" max="86400" value="300"></label>
<button id="create">Create game</button><p id="message" role="status"></p><p class="small">The key stays in this browser tab and is not added to URLs.</p></div></main>`,String.raw`
(function(){const $=s=>document.querySelector(s);const k=sessionStorage.getItem('tambola-admin-key');if(k)$('#key').value=k;
$('#create').onclick=async()=>{const key=$('#key').value;sessionStorage.setItem('tambola-admin-key',key);try{
const r=await fetch('/games',{method:'POST',headers:{'content-type':'application/json','x-admin-key':key},body:JSON.stringify({name:$('#name').value,intervalSeconds:Number($('#interval').value)})});
const data=await r.json();if(!r.ok)throw Error(data.message||r.status);location.href='/admin/'+encodeURIComponent(data.id);
}catch(e){$('#message').textContent=String(e.message||e);}};
})();`);
}
export function adminPage(_gameId:string):string{
  return html('Diwali Tambola · Admin',String.raw`
<header><div class="brand">✦ TAMBOLA ADMIN</div><div class="row"><a id="tvLink" target="_blank">TV view</a><a id="joinLink" target="_blank">Guest link</a></div></header>
<div class="wrap"><div class="panel"><h1 id="name">Game control</h1><div class="row"><span id="status" class="pill">—</span><span id="latest" class="small">Last number: —</span><span id="timer" class="small"></span></div>
<label>Admin key <input id="key" type="password" autocomplete="off" placeholder="ADMIN_TOKEN from .env"></label>
<div class="row" style="margin-top:12px"><button data-action="start">Start</button><button data-action="pause" class="ghost">Pause</button><button data-action="resume">Resume</button>
<input id="manual" type="number" min="1" max="90" placeholder="1–90" style="width:100px"><button id="manualBtn" class="ghost">Call number</button></div>
<p id="message" role="status"></p><div class="small">Sensitive operations require the admin key. Confirm manual calls before submission.</div></div>
<div class="admin-grid"><section class="panel"><h2>Registered players</h2><div id="players"></div></section>
<section class="panel"><h2>Lucky Strike requests</h2><div id="power-requests"></div></section>
<section class="panel"><h2>Prize categories</h2><div id="categories"></div></section>
<section class="panel"><h2>Claims</h2><div id="claims"></div><h3>Eligible tickets</h3><div id="eligible"></div></section>
<section class="panel"><h2>Sudden death rounds</h2><div id="rounds"></div></section>
<section class="panel"><h2>Declared winners</h2><div id="winners"></div></section></div>
</div>`,String.raw`
(function(){
const id=location.pathname.split('/').pop();const $=s=>document.querySelector(s);let display=null;
const keyBox=$('#key');keyBox.value=sessionStorage.getItem('tambola-admin-key')||'';
keyBox.oninput=()=>sessionStorage.setItem('tambola-admin-key',keyBox.value);
$('#tvLink').href='/tv/'+encodeURIComponent(id);$('#joinLink').href='/join/'+encodeURIComponent(id);
function say(v){$('#message').textContent=v||'';}
function element(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
function line(container,label,actions){const item=element('div',label);item.className='item';container.appendChild(item);
if(actions)actions.forEach(a=>{const b=element('button',a.label);b.className='ghost';b.style.margin='4px';b.onclick=a.action;item.appendChild(b);});}
async function req(path,method='GET',body,protectedRoute=true){const opts={method,cache:'no-store',headers:{'content-type':'application/json'}};
if(protectedRoute)opts.headers['x-admin-key']=keyBox.value;
if(body!==undefined)opts.body=JSON.stringify(body);
const r=await fetch('/games/'+encodeURIComponent(id)+path,opts);const data=await r.json().catch(()=>({}));
if(!r.ok)throw Error(Array.isArray(data.message)?data.message.join(', '):data.message||('HTTP '+r.status));return data;}
async function action(path,body){try{say('Working...');await req(path,'POST',body);say('Action completed');await refresh();}catch(e){say(e.message);}}
for(const b of document.querySelectorAll('button[data-action]'))b.onclick=()=>action('/'+b.dataset.action);
$('#manualBtn').onclick=()=>{const n=Number($('#manual').value);if(!Number.isInteger(n)||n<1||n>90){say('Enter number 1–90');return;}
if(confirm('Call number '+n+'? This cannot be undone.'))action('/calls/manual',{number:n});};
async function printTicket(playerId){const w=window.open('','_blank');if(!w){say('Allow popups to print');return;}try{
const t=await req('/admin/players/'+encodeURIComponent(playerId)+'/ticket');
const h=w.document;h.open();h.write('<!doctype html><title>Tambola Ticket</title><style>body{font-family:Arial;padding:24px;text-align:center}table{margin:auto;border-collapse:collapse}td{border:2px solid #222;width:48px;height:48px;font-size:22px;font-weight:bold}</style><h2></h2><h3></h3><table></table>');h.close();
h.querySelector('h2').textContent=t.playerName;h.querySelector('h3').textContent='Ticket '+t.ticketNumber;
for(const row of t.grid){const tr=h.createElement('tr');for(const value of row){const td=h.createElement('td');td.textContent=value===null?'':String(value);tr.appendChild(td);}h.querySelector('table').appendChild(tr);}
w.focus();setTimeout(()=>w.print(),300);
}catch(e){w.close();say(e.message);}}
async function refresh(){try{
 display=await req('/display','GET',undefined,false);
 $('#name').textContent=display.game.name;$('#status').textContent=display.game.status;
 $('#joinLink').href='/g/'+encodeURIComponent(display.game.joinCode);
 const last=display.calls.at(-1);$('#latest').textContent='Last number: '+(last?last.number:'—');
 $('#timer').textContent=display.game.nextCallAt?'Next: '+new Date(display.game.nextCallAt).toLocaleTimeString():'';
 $('#winners').replaceChildren();display.winners.forEach(x=>line($('#winners'),x.category_name+' · '+x.name));
 if(!keyBox.value){say('Enter your admin key to load controls');return;}
 const [players,powers,categories,claims,eligible]=await Promise.all([
 req('/admin/players'),req('/admin/power-requests'),req('/categories','GET',undefined,false),req('/admin/claims'),req('/admin/eligible-winners')]);
 $('#players').replaceChildren();for(const p of players)line($('#players'),p.name+' · T-'+p.ticketNumber+' · '+p.ticketStatus,[{label:'Print',action:()=>printTicket(p.id)},
 {label:'Reissue',action:async()=>{const reason=prompt('Reason for reissue?');if(!reason)return;try{await req('/admin/players/'+p.id+'/reissue','POST',{reason});refresh();}catch(e){say(e.message);}}}]);
 $('#power-requests').replaceChildren();for(const p of powers){line($('#power-requests'),p.playerName+' · '+p.number+' · '+p.status,p.status==='PENDING'?[
 {label:'Approve + call',action:()=>{if(confirm('Call '+p.number+' as '+p.playerName+' Lucky Strike?'))action('/admin/power-requests/'+p.id+'/approve');}},
 {label:'Reject',action:()=>action('/admin/power-requests/'+p.id+'/reject')}]:undefined);}
 $('#categories').replaceChildren();for(const c of categories){line($('#categories'),c.name+' · '+c.tie_break_policy+' · '+(c.status||'OPEN'),[
 {label:'Resolve',action:()=>{if(confirm('Declare outcome for '+c.name+'?'))action('/admin/categories/'+c.id+'/resolve');}},
 {label:'Toggle tie policy',action:async()=>{const policy=c.tie_break_policy==='SHARED_PRIZE'?'SUDDEN_DEATH':'SHARED_PRIZE';
 try{await req('/admin/categories/'+c.id,'PATCH',{tieBreakPolicy:policy});refresh();}catch(e){say(e.message);}}}]);}
 $('#claims').replaceChildren();claims.forEach(c=>line($('#claims'),c.name+' · '+c.status+' · sequence '+c.first_eligible_sequence));
 $('#eligible').replaceChildren();eligible.forEach(e=>line($('#eligible'),e.name+' · '+e.category_name+' · #'+e.first_eligible_sequence));
 $('#rounds').replaceChildren();for(const r of display.suddenDeath){const cat=categories.find(c=>c.name===r.category_name);if(!cat)continue;
 line($('#rounds'),r.category_name+' · '+r.status+' · '+r.draw_sequence+' draws',[
 {label:'Start/resume',action:()=>action('/admin/categories/'+cat.id+'/sudden-death/start')},
 {label:'Pause',action:()=>action('/admin/categories/'+cat.id+'/sudden-death/pause')}]);}
}catch(e){say(e.message);}}
refresh();setInterval(refresh,30000);window.addEventListener('tambola:changed',refresh);
})();`);
}
