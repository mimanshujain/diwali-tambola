import { APPEARANCE_CLIENT } from '../display/appearance.js';
import { theme } from '../display/theme.js';
import { workspaceCss, workspaceNavigation } from '../display/workspace-theme.js';

const playerCss = String.raw`
.player-workspace .workspace-header-inner, .player-main, .player-nav { max-width: 900px; margin-inline: auto; }
.player-main { padding: 20px clamp(10px, 3.2vw, 25px) 35px; display: grid; gap: 13px; }
.player-event { display: grid; gap: 7px; }
.player-event .surface-heading { align-items: center; }
.player-event [data-occasion-welcome] { margin: 0; }
.player-nav { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 0 clamp(10px, 3.2vw, 25px) 7px; }
.player-nav .view-link { justify-content: center; text-align: center; min-height: 38px; padding: 7px 4px; }
.player-workspace .account-identity { max-width: clamp(100px, 34vw, 230px); }
.player-entry { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: start; gap: 12px; }
.player-entry > * { min-width: 0; }
.player-main .storage-warning { margin: 0; color: #ffbaba; font-size: 13px; }
.player-summary { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 7px 12px; }
.player-summary p { margin: 0; }
.workspace .player-draw { padding: 9px 13px; background: var(--sheet); }
.player-draw > div { display: flex; align-items: center; gap: 9px; min-width: 0; }
.player-number {
 display: grid; place-items: center; flex: none; width: 37px; height: 37px; border-radius: 50%;
 background: var(--gold); color: var(--occasion-on-accent); font-weight: 800; font-variant-numeric: tabular-nums;
}
.player-ticket { display: grid; gap: 11px; }
.workspace .ticket-paper { border: 1px solid var(--soft-line); padding: clamp(8px, 2vw, 16px); border-radius: var(--occasion-panel-radius); background: var(--sheet); }
.ticket-caption { display: flex; justify-content: space-between; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 7px; }
.ticket-caption .code { font-size: 13px; }
.ticket { display: grid; grid-template-columns: repeat(9,minmax(0,1fr)); gap: clamp(3px, 1vw, 6px); font-variant-numeric: tabular-nums; }
.ticket .cell { min-width: 0; aspect-ratio: 1.15; display: grid; place-items: center; background: var(--occasion-ticket-paper); color: #32273a; border-radius: var(--occasion-cell-radius); font-weight: 800; font-size: clamp(13px, 4.6vw, 29px); }
.ticket .cell.empty { background: color-mix(in srgb, var(--soft-line) 46%, transparent); }
.ticket .cell.hit { background: #98e6c8; color: #103b2d; }
.ticket .cell.latest { box-shadow: inset 0 0 0 2px #fff6e6; }
.ticket-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ticket-actions [hidden] { display: none; }
#ticket-help, #registration-help { margin: 0; }
.player-calls { margin: 0; padding: 0; list-style: none; }
.workspace .player-calls .ball-chip { min-height: 29px; }
.player-calls .empty { grid-column: 1 / -1; }
.recovery-code { font: 15px ui-monospace, monospace; letter-spacing: .04em; overflow-wrap: anywhere; color: var(--gold); margin: 0; }
.player-prize { min-width: 0; }
.player-prize h3 { overflow-wrap: anywhere; margin-bottom: 4px; }
.player-prize p { overflow-wrap: anywhere; margin: 0; }
.player-prize button { flex: none; }
@media (max-width: 580px) {
 .player-entry { grid-template-columns: minmax(0, 1fr); }
 .player-main { padding-top: 11px; }
 .player-event .surface-heading { gap: 5px 9px; }
 .player-workspace .player-event h1 { font-size: clamp(25px, 7vw, 37px); }
 .ticket-actions > button { flex: 1 1 128px; }
 .player-number { width: 33px; height: 33px; }
}
`;

/** Guest UI is served locally, including every style and script. */
export function renderJoinPage():string {
 return String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tambola · Your ticket</title><style>${theme}${workspaceCss}${playerCss}</style></head><body class="workspace player-workspace">
 <header class="workspace-header">
  <div class="workspace-header-inner"><a class="workspace-brand" href="/"><span class="brand-mark" aria-hidden="true">✦</span><span><span class="brand">TAMBOLA</span><small>Player desk</small></span></a>
   <section id="player-account" class="workspace-account" aria-label="Your player" hidden><span id="player-initial" class="account-avatar" aria-hidden="true"></span><div class="account-identity"><strong id="welcome"></strong><small id="player-access"></small></div></section>
  </div>
  <nav id="player-nav" class="player-nav" aria-label="Player sections" hidden><a class="view-link" data-view-link="ticket" href="#ticket">My ticket</a><a class="view-link" data-view-link="calls" href="#calls">Calls</a><a class="view-link" data-view-link="prizes" href="#prizes">Prizes</a></nav>
 </header>
 <main class="player-main">
  <header class="player-event"><div class="surface-heading"><h1 id="gameName">Joining game…</h1><div class="row"><span id="gameStatus" class="badge">Connecting</span><span data-live-status></span></div></div><p data-occasion-welcome class="small" hidden></p></header>
  <p id="message" class="notice" role="status" aria-live="polite"></p><p id="storage-warning" class="storage-warning" hidden>Your browser cannot save this session. Keep your recovery code before closing this page.</p>

  <div id="guest-entry" class="player-entry">
   <form id="register" class="panel form-flow"><h2>Join the game</h2><p class="section-note">Use a name the host can recognize and approve. Save the private recovery code that comes with your ticket.</p><label>Your name<input id="name" autocomplete="name" maxlength="80" placeholder="First and last name" required></label><button id="register-button">Get my ticket</button><p id="registration-help" class="section-note"></p></form>
   <details id="restore-panel" class="panel section-disclosure"><summary>Restore a ticket</summary><form id="restore" class="section-body form-flow"><p class="section-note">Use the code saved when you joined. Ask the host to reset access if you lost it.</p><label>Private recovery code<input id="recovery-input" autocomplete="off" spellcheck="false" required placeholder="32-character code"></label><button id="restore-button" class="ghost">Restore my ticket</button></form></details>
  </div>

  <div id="guest-game" class="stack" hidden>
   <div class="panel player-summary player-draw"><div><span id="player-latest" class="player-number">—</span><span id="lastCall" class="small">Waiting for the first call</span></div><a href="#calls" class="button ghost small-button" data-view-link="calls">Call history</a></div>
   <section id="ticket-section" class="panel player-ticket" data-view="ticket"><div class="surface-heading"><h2 tabindex="-1" data-view-heading>Your ticket</h2><span id="status" class="badge"></span></div><p id="approval" class="notice"></p>
    <div class="ticket-paper"><div class="ticket-caption"><span id="ticket-code" class="code"></span><span id="ticket-matches" class="small"></span></div><div id="ticket" class="ticket" role="group" aria-label="Ticket numbers"></div></div>
    <p id="ticket-help" class="section-note"></p><div id="ticket-actions" class="ticket-actions"><button id="submit">Confirm & submit</button><button id="regenerate" class="ghost">Recreate ticket</button></div>
    <details id="recovery-panel" class="toolbar section-disclosure"><summary>Private recovery code</summary><div class="stack"><p id="recovery-code" class="recovery-code"></p><p class="section-note">Save this code privately. It restores this ticket on another device.</p></div></details>
   </section>
   <section id="game-section" class="stack" data-view="calls" hidden>
    <div class="panel stack"><div><h2 tabindex="-1" data-view-heading>Called numbers</h2><p class="section-note">Numbers appear in draw order. Matches on your ticket are marked automatically.</p></div><ol id="callHistory" class="call-grid player-calls" aria-label="Calls in draw order"></ol></div>
    <details id="lucky-strike" class="panel section-disclosure"><summary>Lucky Strike</summary><div class="section-body stack"><p id="powerStatus" class="section-note"></p><form id="powerForm" class="forms-inline"><label>Your uncalled number<input id="powerNumber" type="number" min="1" max="90" required></label><button id="powerSubmit">Request Lucky Strike</button></form></div></details>
   </section>
   <section id="prize-section" class="panel stack" data-view="prizes" hidden><div><h2 tabindex="-1" data-view-heading>Prizes</h2><p class="section-note">Tambola detects qualifying tickets automatically. Use Claim to alert the host for review.</p></div><p id="claim-help" class="section-note" hidden></p><div id="categories" class="workspace-list"></div></section>
  </div>
 </main><script>${APPEARANCE_CLIENT}
 ${workspaceNavigation}
 (function(){
 const $=s=>document.querySelector(s),id=location.pathname.split('/').filter(Boolean).pop(),root='/games/'+encodeURIComponent(id);
 const openPlayerView=setupWorkspace('ticket');
 const tokenKey='tambola-token-'+id,recoveryKey='tambola-recovery-'+id;
 const memory={};const storage={get(key){try{return localStorage.getItem(key);}catch{return memory[key]||null;}},set(key,value){memory[key]=value;try{localStorage.setItem(key,value);}catch{$('#storage-warning').hidden=false;}},remove(key){delete memory[key];try{localStorage.removeItem(key);}catch{}}};
 let token=storage.get(tokenKey),ticket=null,player=null,game=null,called=new Set(),latest=null,refreshing=false,queued=false,busy=false,powerState=null,rerollsRemaining=3;
 function uuid(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const s=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);}
 let deviceId=storage.get('tambola-device');if(!deviceId){deviceId=uuid();storage.set('tambola-device',deviceId);}
 const message=text=>$('#message').textContent=text||'';
 async function request(path,method='GET',body){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(root+path,{method,cache:'no-store',signal:controller.signal,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok){const error=Error(Array.isArray(data.message)?data.message.join(', '):data.message||'Request failed');error.status=response.status;throw error;}return data;}finally{clearTimeout(timeout);}}
 async function action(button,work){busy=true;button.disabled=true;try{await work();}catch(error){message(error.message);}finally{busy=false;button.disabled=false;render();}}
 const node=(tag,text,className)=>{const element=document.createElement(tag);element.textContent=text;if(className)element.className=className;return element;};
 let renderedTicket,renderedCalls,renderedPrizes;
 function show(data){
  ticket=data.ticket;player=data.player;rerollsRemaining=data.rerollsRemaining??3;
  if(data.token){token=data.token;storage.set(tokenKey,token);}
  if(data.recoveryCode){storage.set(recoveryKey,data.recoveryCode);$('#recovery-panel').open=true;}
  render();
  if(data.token)openPlayerView('ticket');
 }
 function render(){
  const closed=game&&(game.status==='COMPLETED'||game.emergencyStopped),joined=Boolean(ticket&&player);
  $('#guest-entry').hidden=joined;$('#guest-game').hidden=!joined;$('#player-nav').hidden=!joined;$('#player-account').hidden=!joined;
  $('#register-button').disabled=busy||!!closed;
  $('#registration-help').textContent=closed?'Registration is closed while play is stopped or finished.':game?.status==='RUNNING'||game?.status==='PAUSED'?'Your ticket locks immediately. Ask the host to approve it.':'';
  $('#registration-help').hidden=!$('#registration-help').textContent;
  $('#powerSubmit').disabled=busy||!token||!player?.approved||powerState!=='AVAILABLE'||!['RUNNING','PAUSED'].includes(game?.status)||game?.emergencyStopped||ticket?.status!=='SUBMITTED';
  if(!joined)return;
  const submitted=ticket.status==='SUBMITTED',open=game?.status==='CREATED'&&!game?.emergencyStopped;
  $('#welcome').textContent=player.name;$('#player-initial').textContent=Array.from(player.name)[0]?.toUpperCase()||'G';
  $('#player-access').textContent=player.approved?'Approved player':'Awaiting approval';
  $('#ticket-code').textContent=ticket.displayCode;
  const ticketNumbers=ticket.grid.flat().filter(number=>number!==null);
  $('#ticket-matches').textContent=ticketNumbers.filter(number=>called.has(number)).length+' / '+ticketNumbers.length+' matched';
  $('#status').textContent=submitted?'Submitted ✓':'Draft ticket';$('#status').dataset.state=submitted?'submitted':'draft';
  $('#approval').textContent=player.approved?'':submitted?'Ticket saved. Ask the host to approve you before you can win.':'Ask your host to approve your name so you can submit.';
  $('#ticket-actions').hidden=submitted;$('#submit').hidden=submitted;$('#regenerate').hidden=submitted;
  $('#submit').disabled=busy||!token||!player.approved||!open;$('#regenerate').disabled=busy||!token||!open||rerollsRemaining<=0;
  $('#ticket-help').textContent=submitted?(player.approved?'Matches are marked as numbers are called.':'Your ticket becomes eligible on the next call after approval.'):open?rerollsRemaining+' of 3 recreations left. Starting the game submits approved drafts automatically.':'Ticket changes are available in the lobby before play.';
  const ticketState=ticket.id+':'+renderedCalls;
  if(ticketState!==renderedTicket){
   renderedTicket=ticketState;
   $('#ticket').replaceChildren(...ticket.grid.flat().map(number=>{
    if(number===null){const blank=node('div','','cell empty');blank.setAttribute('aria-hidden','true');return blank;}
    const cell=node('div',String(number),'cell'+(called.has(number)?' hit':'')+(number===latest?' latest':''));
    if(called.has(number)){cell.setAttribute('role','img');cell.setAttribute('aria-label',number+(number===latest?', latest match':', matched'));}
    return cell;
   }));
  }
  $('#recovery-code').textContent=storage.get(recoveryKey)||'Ask the host to issue a recovery code for this registration.';
 }
 function showCalls(calls){
  const state=calls.map(call=>call.number).join(',');
  called=new Set(calls.map(call=>call.number));latest=calls.at(-1)?.number??null;
  if(state===renderedCalls)return;
  renderedCalls=state;
  $('#player-latest').textContent=latest??'—';
  $('#lastCall').textContent=latest?'Latest call · '+calls.length+' of 90 called':'Waiting for the first call';
  const history=$('#callHistory');history.replaceChildren();
  for(const call of calls){const tile=node('li',String(call.number),'ball-chip is-called'+(call.number===latest?' is-latest':''));if(call.number===latest)tile.setAttribute('aria-label',call.number+', latest call');history.append(tile);}
  if(!history.children.length)history.append(node('li','The draw history will appear here.','empty'));
 }
 function showPrizes(categories){
  const open=categories.filter(category=>category.active&&category.status!=='RESOLVED');
  const canClaim=Boolean(token&&player?.approved&&ticket?.status==='SUBMITTED'&&!game.endedByAdmin);
  const help=$('#claim-help');help.hidden=canClaim||!open.length;help.textContent=game.endedByAdmin?'The host ended this game.':'Your ticket needs host approval and submission before you can claim.';
  const state=JSON.stringify([open,canClaim]);if(state===renderedPrizes)return;renderedPrizes=state;
  const list=$('#categories');list.replaceChildren();
  for(const category of open){
   const row=node('article','','desk-item player-prize'),text=node('div','','desk-item-text');
   text.append(node('h3',category.name));if(category.prize_description)text.append(node('p',category.prize_description,'section-note'));
   const claim=node('button','Claim','ghost small-button');claim.setAttribute('aria-label','Claim '+category.name);claim.disabled=!canClaim;
   claim.onclick=()=>action(claim,async()=>{await request('/players/me/claims','POST',{categoryId:category.id});message('Claim sent for '+category.name+'. Play pauses for the host to review.');});
   row.append(text,claim);list.append(row);
  }
  if(!open.length)list.append(node('div','There are no open prizes for this game.','empty'));
 }
 $('#register').onsubmit=e=>{e.preventDefault();action($('#register-button'),async()=>{show(await request('/players/register','POST',{name:$('#name').value,deviceId}));message('Ticket created. Save your recovery code and ask the host to approve you.');await refresh();});};
 $('#restore').onsubmit=e=>{e.preventDefault();action($('#restore-button'),async()=>{show(await request('/players/recover','POST',{recoveryCode:$('#recovery-input').value,deviceId}));$('#restore-panel').open=false;$('#recovery-input').value='';message('Your saved ticket is restored.');await refresh();});};
 $('#submit').onclick=()=>action($('#submit'),async()=>{if(!confirm('Submit '+ticket.displayCode+' for '+player.name+'? You cannot recreate it after submission.'))return;const ticketId=ticket.id;show(await request('/players/me/submit','POST',{ticketId}));message('Ticket submitted. Good luck!');await refresh();});
 $('#regenerate').onclick=()=>action($('#regenerate'),async()=>{show(await request('/players/me/regenerate','POST'));message('Here is your new draft. Review before submitting.');});
 $('#powerForm').onsubmit=e=>{e.preventDefault();action($('#powerSubmit'),async()=>{const number=Number($('#powerNumber').value);await request('/players/me/power/request','POST',{number});message('Lucky Strike requested. Play is paused for the host.');await refresh();});};
 async function refresh(){if(refreshing){queued=true;return;}refreshing=true;try{
  const display=await request('/guest-display');game=display.game;window.applyTambolaAppearance(game);$('#gameName').textContent=game.name;
  const badge=$('#gameStatus');badge.textContent=game.emergencyStopped?'Stopped':({CREATED:'Lobby',RUNNING:'In play',PAUSED:'Paused',COMPLETED:'Completed'})[game.status]||game.status;badge.dataset.state=game.emergencyStopped?'stopped':game.status.toLowerCase();
  showCalls(display.calls);
  if(token){try{show(await request('/players/me'));}catch(error){if(error.status===401){token=null;ticket=null;player=null;storage.remove(tokenKey);message('This session expired. Restore your ticket below.');$('#restore-panel').open=true;}else throw error;}}
  render();showPrizes(display.categories);
  if(token){const power=await request('/players/me/power');powerState=power.status;$('#powerStatus').textContent=power.status==='USED'?'You’ve used your Lucky Strike.':power.status==='PENDING'?'Your request is waiting for the host.':!['RUNNING','PAUSED'].includes(game.status)?'Lucky Strike opens during play.':'Ask the host to call one uncalled number.';render();}
 }catch(error){message('Connection · '+(error.name==='AbortError'?'Timed out; retrying':error.message));}finally{refreshing=false;if(queued){queued=false;void refresh();}}}
 refresh();setInterval(refresh,10000);window.addEventListener('tambola:changed',refresh);
 })();
 </script><script src="/socket.io/socket.io.js"></script><script src="/live/client.js"></script></body></html>`;
}
