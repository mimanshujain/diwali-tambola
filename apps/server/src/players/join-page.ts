/** Zero-build guest experience; bundled with the API for LAN hosting. */
export function renderJoinPage(): string {
  return String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tambola · Join</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:#101621;color:#f5f5f5;padding:24px}main{max-width:520px;margin:0 auto}h1{color:#f7bc55}form,section{background:#1b2637;border:1px solid #405066;padding:20px;border-radius:14px;margin:16px 0}input,button{font:inherit;width:100%;padding:12px;border-radius:9px;margin:7px 0}input{border:1px solid #8393ab;background:#fff;color:#111}button{border:0;background:#e7a83d;color:#111;font-weight:bold;cursor:pointer}button:disabled{opacity:.5}button.secondary{background:#8296b3}#message{min-height:20px;color:#ffbeae}.ticket{display:grid;grid-template-columns:repeat(9,1fr);gap:3px;margin:20px 0}.cell{aspect-ratio:1;display:grid;place-items:center;background:#eef0f5;color:#151a24;font-weight:700;border-radius:4px;font-size:clamp(12px,3.7vw,20px)}.cell.empty{background:#3d4a60}small{color:#bec9d7}
</style></head><body><main><h1>Tambola</h1><p>Join the game and get your own ticket.</p>
<div id="message" role="status"></div>
<form id="register"><label>Name<input id="name" autocomplete="name" maxlength="80" required></label><label>Mobile number (with country code)<input id="mobile" type="tel" autocomplete="tel" placeholder="e.g. 15551234567" required></label><button>Get my ticket</button><small>One registration per mobile number and browser. Mobile numbers aren't SMS-verified.</small></form>
<section id="ticket-section" hidden><h2 id="welcome"></h2><p id="ticket-code"></p><div class="ticket" id="ticket"></div><p id="status"></p><button id="submit">Submit ticket</button><button id="regenerate" class="secondary">Try another ticket</button><small>Submit locks your ticket. Keep this browser's storage intact to return later.</small></section>
</main><script>
(() => {
const id = location.pathname.split('/').pop();
const api = '/games/' + encodeURIComponent(id) + '/players';
const tokenKey = 'tambola-token-' + id;
const deviceKey = 'tambola-device';
const $ = s => document.querySelector(s);
const message = (s) => { $('#message').textContent = s || ''; };
function newUuid(){const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
let deviceId=localStorage.getItem(deviceKey);if(!deviceId){deviceId=newUuid();localStorage.setItem(deviceKey,deviceId);}
let token=localStorage.getItem(tokenKey);
async function request(path,method='GET',body){const res=await fetch(api+path,{method,headers:{'content-type':'application/json',...(token?{'authorization':'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const data=await res.json().catch(()=>({}));if(!res.ok){throw Error(typeof data.message==='string'?data.message:JSON.stringify(data.message||'Request failed'));}return data;}
function show(data){$('#register').hidden=true;$('#ticket-section').hidden=false;$('#welcome').textContent='Welcome, '+data.player.name;$('#ticket-code').textContent=data.ticket.displayCode;$('#ticket').replaceChildren();for(const row of data.ticket.grid){for(const value of row){const cell=document.createElement('div');cell.className='cell'+(value===null?' empty':'');cell.textContent=value===null?'':String(value);$('#ticket').appendChild(cell);}}const submitted=data.ticket.status==='SUBMITTED';$('#status').textContent=submitted?'Ticket submitted ✓':'Draft ticket — review and submit';$('#submit').hidden=submitted;$('#regenerate').hidden=submitted;message('');}
$('#register').addEventListener('submit',async e=>{e.preventDefault();message('Registering...');try{const data=await request('/register','POST',{name:$('#name').value,mobile:$('#mobile').value,deviceId});token=data.token;localStorage.setItem(tokenKey,token);show(data);}catch(e){message(e.message);}});
$('#submit').addEventListener('click',async()=>{try{show(await request('/me/submit','POST'));}catch(e){message(e.message);}});
$('#regenerate').addEventListener('click',async()=>{try{show(await request('/me/regenerate','POST'));}catch(e){message(e.message);}});
if(token){request('/me').then(show).catch(e=>{message(e.message+' — contact the admin if your ticket is inaccessible.');});}
})();
</script></body></html>`;
}
