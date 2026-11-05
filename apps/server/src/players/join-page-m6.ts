/** All guest assets are bundled into the NestJS server: no CDN or extra port. */
export function renderJoinPage(): string {
  return String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diwali Tambola · My ticket</title><style>
:root{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color-scheme:dark;color:#fff4d9;background:#101722}
*{box-sizing:border-box}body{margin:0;padding:18px;background:radial-gradient(circle at top left,#30415a,transparent 45%),#101722}
main{max-width:620px;margin:0 auto}h1{color:#ffcb77;margin:5px 0}h2{font-size:20px}form,section{background:#1b293b;border:1px solid #465671;padding:18px;border-radius:16px;margin:16px 0}
input,button{font:inherit;width:100%;padding:12px;border-radius:9px;margin:7px 0}input{background:#101b2a;color:#fff;border:1px solid #8a9ab0}
button{border:0;background:#ffc267;color:#21180a;font-weight:bold;cursor:pointer}button:disabled{opacity:.5}button.secondary{background:#526780;color:#fff}
#message{color:#ffc8b5;min-height:18px}.ticket{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:3px;margin:20px 0}
.cell{aspect-ratio:1;display:grid;place-items:center;background:#f1eada;color:#161b22;font-weight:800;border-radius:5px;font-size:clamp(12px,3.5vw,22px)}
.cell.empty{background:#374860}.cell.hit{background:#b8e7a2;color:#164221}.stats{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
small{color:#becbda}.badge{font-size:13px;border-radius:20px;background:#37475e;padding:5px 10px}.categories{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.categories button{font-size:13px}
</style></head><body><main><h1>🪔 Diwali Tambola</h1><p id="gameName">Your game, your ticket.</p><p id="message" role="status"></p>
<form id="register"><h2>Join the game</h2><label>Name<input id="name" autocomplete="name" maxlength="80" required></label>
<label>Mobile number with country code<input id="mobile" type="tel" placeholder="15551234567" autocomplete="tel" required></label>
<button>Get my ticket</button><small>One registration per phone number and browser. No SMS verification.</small></form>
<section id="ticket-section" hidden><div class="stats"><h2 id="welcome"></h2><span class="badge" id="status"></span></div>
<p id="ticket-code"></p><div class="ticket" id="ticket"></div><button id="submit">Submit ticket</button>
<button id="regenerate" class="secondary">Try another ticket</button><small>Submitting locks the ticket. Save this browser to return later.</small></section>
<section id="game-section" hidden><div class="stats"><h2>Called numbers</h2><span id="gameStatus" class="badge">—</span></div>
<p id="lastCall">No calls yet</p><div id="callHistory" style="overflow-wrap:anywhere;color:#cfdae9"></div>
<h2>Claim a prize</h2><div id="categories" class="categories"></div>
<h2>✨ Lucky Strike</h2><p class="small" id="powerStatus">One lucky number per player. Ask the admin to approve.</p>
<form id="powerForm"><label>Choose an uncalled number<input id="powerNumber" type="number" min="1" max="90" required></label>
<button id="powerSubmit">Request Lucky Strike</button></form></section>
</main><script>
(function(){
const id=location.pathname.split('/').pop();const root='/games/'+encodeURIComponent(id);const $=s=>document.querySelector(s);
const tk='tambola-token-'+id, dk='tambola-device';let token=localStorage.getItem(tk);
const msg=s=>$('#message').textContent=s||'';
function uuid(){const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);}
let deviceId=localStorage.getItem(dk);if(!deviceId){deviceId=uuid();localStorage.setItem(dk,deviceId);}
async function req(path,method='GET',body){const r=await fetch(root+path,{method,cache:'no-store',headers:{'content-type':'application/json',...(token?{'authorization':'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(Array.isArray(d.message)?d.message.join(', '):d.message||'Request failed');return d;}
let ticket=null,called=new Set();
function show(data){ticket=data.ticket;$('#register').hidden=true;$('#ticket-section').hidden=false;$('#game-section').hidden=false;
$('#welcome').textContent='Hi, '+data.player.name;$('#ticket-code').textContent=data.ticket.displayCode;
const submitted=data.ticket.status==='SUBMITTED';$('#status').textContent=submitted?'Submitted ✓':'Review your ticket';
$('#submit').hidden=submitted;$('#regenerate').hidden=submitted;
renderTicket();msg('');}
function renderTicket(){if(!ticket)return;$('#ticket').replaceChildren();for(const row of ticket.grid){for(const n of row){const cell=document.createElement('div');cell.className='cell'+(n===null?' empty':called.has(n)?' hit':'');cell.textContent=n===null?'':String(n);$('#ticket').appendChild(cell);}}}
$('#register').onsubmit=async e=>{e.preventDefault();try{const d=await req('/players/register','POST',{name:$('#name').value,mobile:$('#mobile').value,deviceId});token=d.token;localStorage.setItem(tk,token);show(d);await refresh();}catch(err){msg(err.message);}};
$('#submit').onclick=async()=>{try{show(await req('/players/me/submit','POST'));await refresh();}catch(e){msg(e.message);}};
$('#regenerate').onclick=async()=>{try{show(await req('/players/me/regenerate','POST'));await refresh();}catch(e){msg(e.message);}};
$('#powerForm').onsubmit=async e=>{e.preventDefault();try{const n=Number($('#powerNumber').value);const r=await req('/players/me/power/request','POST',{number:n});msg('Requested '+r.number+' — waiting for admin approval');await refresh();}catch(err){msg(err.message);}};
async function refresh(){try{const [display,power]=await Promise.all([
 req('/display'),token?req('/players/me/power'):Promise.resolve(null)]);const cat=display.categories;
 $('#gameName').textContent=display.game.name;$('#gameStatus').textContent=display.game.status;
 if(ticket)$('#regenerate').hidden=ticket.status==='SUBMITTED'||display.game.status!=='CREATED';
 called=new Set(display.calls.map(x=>x.number));renderTicket();
 const last=display.calls.at(-1);$('#lastCall').textContent=last?'Latest: '+last.number+' · Called '+display.calls.length+'/90':'No numbers called';
 $('#callHistory').textContent=display.calls.map(x=>x.number).join(' · ');
 const categories=$('#categories');categories.replaceChildren();for(const c of cat){if(!c.active||c.status==='RESOLVED')continue;
 const b=document.createElement('button');b.textContent=c.name;b.className='secondary';b.disabled=!ticket||ticket.status!=='SUBMITTED';
 b.onclick=async()=>{try{await req('/players/me/claims','POST',{categoryId:c.id});msg('Claim sent for '+c.name);}catch(e){msg(e.message);}};categories.appendChild(b);}
 if(power){$('#powerStatus').textContent=power.status==='USED'?'Lucky Strike used ✓':power.status==='PENDING'?'Request pending: '+(power.lastRequest?power.lastRequest.number:''): 'Choose one uncalled number for admin approval.';
 $('#powerSubmit').disabled=power.status!=='AVAILABLE'||display.game.status!=='RUNNING'||!ticket||ticket.status!=='SUBMITTED';}
}catch(e){msg('Connection: '+e.message);}}
if(token){req('/players/me').then(show).then(refresh).catch(e=>msg(e.message+' · Contact the admin if your registration cannot be restored.'));}
refresh();setInterval(refresh,30000);window.addEventListener('tambola:changed',refresh);
})();
</script><script src="/socket.io/socket.io.js"></script><script src="/live/client.js"></script></body></html>`;
}
