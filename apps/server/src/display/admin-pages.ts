import { commentaryFields, commentaryEditorJs } from '../commentary/commentary-editor.js';
import { appearanceFields, appearanceEditorJs } from './appearance-editor.js';
import { cloudMode, hostContext } from '../hosting/context.js';
import { html } from './theme.js';
import { workspaceCss, workspaceNavigation } from './workspace-theme.js';
import { RULE_LABELS } from '../winners/domain/rules.js';

function escapeHtml(value: string): string {
 return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function hostAccount(): string {
 const host = hostContext.getStore();
 const email = host?.email ?? '';
 const name = host?.name.trim() || email || 'Signed in';
 const initials = name.split(/\s+/u).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();

 return `<section id="host-account" class="workspace-account" aria-label="Signed-in host">
  <input id="key" type="hidden">
  <span class="account-avatar host-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
  <div class="account-identity host-identity"><strong>${escapeHtml(name)}</strong>${email ? `<small>${escapeHtml(email)}</small>` : ''}</div>
  <button id="sign-out" type="button" class="ghost header-action">Sign out</button>
 </section>`;
}

const homeViews = [
 ['games','Games','▦'],
 ['create','Create a game','+'],
] as const;
const gameViews = [
 ['round','Live round','◉'],
 ['players','Players & tickets','▤'],
 ['prizes','Prizes & claims','◇'],
 ['sharing','TV & guest links','↗'],
 ['style','Style & commentary','✦'],
 ['activity','Activity & recovery','◷'],
] as const;
type WorkspaceViews = readonly (readonly [string,string,string])[];

const calledBoard = Array.from({length:90},(_,index)=>`<span class="ball-chip">${index+1}</span>`).join('');
const refreshButton = '<button id="load" type="button" class="ghost header-action">Refresh</button>';

function hostHeader(game: boolean): string {
 return `<header class="workspace-header${game?' game-header':''}">
 <div class="workspace-header-inner host-header-grid${game?' has-game':''}">
  <a class="workspace-brand" href="/admin" aria-label="Tambola host desk, all games"><span class="brand-mark" aria-hidden="true">✦</span><span><span class="brand">TAMBOLA</span><small>${game?'← All games':'Host desk'}</small></span></a>
  ${game?'<label class="host-switch"><span>Switch game</span><select id="switch-game" aria-label="Switch game" disabled><option>Loading…</option></select></label>':''}
  <div class="workspace-header-actions">
   ${cloudMode()?hostAccount():'<button type="button" id="host-key-toggle" class="ghost header-action" aria-controls="host-key-form" aria-expanded="false">Admin key</button>'}
  </div>
  ${game?`<div class="host-mobile-switch"><label>Section<select id="section-picker" aria-label="Host section">${gameViews.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label></div>`:''}
  ${cloudMode()?'':`<form class="host-key-form" id="host-key-form" hidden>
   <label>Local admin key<input id="key" type="password" autocomplete="off" placeholder="Your private host key" required></label>
   <button id="load" type="submit" class="header-action">Unlock ${game?'controls':'games'}</button>
  </form>`}
 </div>
</header>`;
}

function hostRail(views: WorkspaceViews, game: boolean): string {
 return `<aside class="host-rail"><nav aria-label="Host sections">
  ${game?'<a class="view-link all-games" href="/admin"><span class="nav-icon" aria-hidden="true">←</span>All games</a>':''}
  ${views.map(([id,label,icon])=>`<a class="view-link" href="#${id}" data-view-link="${id}"><span class="nav-icon" aria-hidden="true">${icon}</span>${label}${id==='players'||id==='prizes'?`<span id="${id}-nav-count" class="nav-count" hidden></span>`:''}</a>`).join('')}
 </nav></aside>`;
}

const helpers=String.raw`
const $=s=>document.querySelector(s);
const hosted=Boolean($('#host-account'));
const keyBox=$('#key');keyBox.value=hosted?'':sessionStorage.getItem('tambola-admin-key')||'';
const keyForm=$('#host-key-form'),keyToggle=$('#host-key-toggle');
if(hosted){
 const signOut=$('#sign-out');
 signOut.onclick=()=>run(signOut,async()=>{await request('/auth/logout','POST');location.replace('/');});
 try{sessionStorage.removeItem('tambola-admin-key');}catch{}
}else{
 setKeyFormOpen(!keyBox.value);
 keyToggle.onclick=()=>{setKeyFormOpen(keyForm.hidden);if(!keyForm.hidden)keyBox.focus();};
 keyToggle.closest('header').addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!keyForm.hidden)setKeyFormOpen(false);
 });
}
keyBox.oninput=()=>sessionStorage.setItem('tambola-admin-key',keyBox.value);
function say(message){$('#message').textContent=message||'';}
function el(tag,text,className){const node=document.createElement(tag);node.textContent=text??'';if(className)node.className=className;return node;}
function button(label,action,className='ghost small-button'){const node=el('button',label,className);node.type='button';node.onclick=()=>run(node,action);return node;}
const pendingButtons=new Set();
async function request(path,method='GET',body){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetch(path,{method,cache:'no-store',signal:controller.signal,headers:{'content-type':'application/json',...(keyBox.value?{'x-admin-key':keyBox.value}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(hosted&&response.status===401){location.href='/auth/login';throw Error('Please sign in again.');}
 if(!response.ok)throw Error(Array.isArray(data.message)?data.message.join(', '):data.message||'Request failed ('+response.status+')');return data;
 }catch(error){if(error.name==='AbortError')throw Error('Request timed out. Refreshing the last confirmed state.');throw error;}finally{clearTimeout(timeout);}
}
async function run(button,action){if(pendingButtons.has(button))return;pendingButtons.add(button);button.disabled=true;try{await action();}catch(error){say(error.message);}finally{pendingButtons.delete(button);button.disabled=false;if(typeof controls==='function'&&display)controls();}}
async function deleteGame(game){
 const confirmationCode=prompt('Permanently delete "'+game.name+'"? This ends any active play and removes its players, tickets, calls, prizes and history. This cannot be undone in the app. Type '+game.joinCode+' to delete.');
 if(confirmationCode===null)return false;
 if(confirmationCode.trim().toUpperCase()!==game.joinCode){say('Game not deleted. The confirmation code did not match.');return false;}
 await request('/games/'+encodeURIComponent(game.id)+'/admin/game','DELETE',{confirmationCode});return true;
}
function empty(container,message){container.replaceChildren(el('div',message,'empty'));}
function setKeyFormOpen(open){
 if(!keyForm)return;
 if(!open&&keyForm.contains(document.activeElement))keyToggle.focus();
 keyForm.hidden=!open;
 keyToggle.setAttribute('aria-expanded',String(open));
}
function bindHostLoad(action){
 const load=$('#load');
 if(hosted)load.onclick=()=>run(load,action);
 else keyForm.onsubmit=event=>{event.preventDefault();void run(load,action);};
}
function displayStatus(status,stopped){return stopped?'Stopped':({CREATED:'Lobby',RUNNING:'In play',PAUSED:'Paused',COMPLETED:'Completed'})[status]||status;}
function updateBadge(node,status,stopped){node.textContent=displayStatus(status,stopped);node.dataset.state=stopped?'stopped':status.toLowerCase();}
`;

export function homeAdminPage():string {
 return html('Tambola · Host desk',String.raw`
 <style>${workspaceCss}</style>
 ${hostHeader(false)}
 <div class="host-layout">${hostRail(homeViews,false)}<main class="host-content">
 <p id="message" class="notice" role="status"></p>
 <section id="games-view" data-view="games">
  <div class="surface-heading"><div><h1 tabindex="-1" data-view-heading>Games</h1><p class="section-note">Manage your lobbies and completed rounds.</p></div><a class="button" href="#create" data-view-link="create">+ New game</a></div>
  <div class="game-filters"><input id="search" type="search" aria-label="Search games" placeholder="Find a game or code"><select id="filter" aria-label="Filter games"><option value="active">Active games</option><option value="all">All games</option><option value="COMPLETED">Completed</option></select></div>
  <div class="row between game-list-meta"><span id="game-count" class="small" hidden></span><div class="row"><span id="health" class="connection">Checking server…</span>${cloudMode()?refreshButton:''}</div></div>
  <div id="games" class="game-cards"><p class="section-note">${cloudMode()?'Loading your games…':'Use Admin key in the header to unlock your games.'}</p></div>
 </section>
 <section id="create-panel" data-view="create" hidden>
  <header class="section-intro"><h1 tabindex="-1" data-view-heading>Create a game</h1><p class="section-note">Set the draw pace and choose a look for the TV, player ticket, and printout.</p></header>
  <form id="create-form" class="panel form-flow">
   <div class="grid"><label>Seconds between calls<input id="interval" type="number" min="10" max="86400" value="30" required></label></div>
   ${appearanceFields}<div class="row"><button id="create" type="submit">Create game</button><a class="button ghost" href="#games" data-view-link="games">Back to games</a></div>
  </form>
 </section>
 </main></div>`,helpers+workspaceNavigation+appearanceEditorJs+String.raw`
setupWorkspace('games',{'create-panel':'create'});
let games=null;
function render(){
 if(!games)return;
 const list=$('#games'),query=$('#search').value.trim().toLowerCase(),filter=$('#filter').value;list.replaceChildren();
 const visible=games.filter(g=>(filter==='all'||(filter==='active'?g.status!=='COMPLETED':g.status===filter))&&(g.name+' '+g.joinCode).toLowerCase().includes(query));
 $('#game-count').hidden=false;$('#game-count').textContent=visible.length+' '+(visible.length===1?'game':'games');
 for(const game of visible){const card=el('article','','panel game-card');const top=el('div','','row between'),badge=el('span','','pill');updateBadge(badge,game.status,game.emergencyStopped);top.append(badge,el('span',game.joinCode,'code'));card.append(top,el('h2',game.name));
 const metrics=el('div','','metrics');for(const [value,label] of [[game.playerCount,'players'],[game.submittedCount,'submitted'],[game.calledCount,'called']]){const metric=el('div','','metric');metric.append(el('strong',String(value)),el('small',label));metrics.append(metric);}card.append(metrics);
 if(game.recoveredAt)card.append(el('p','Recovered after restart. Review before resuming.','section-note'));
 const link=el('a','Open console','button small-button');link.href='/admin/'+game.id;
 const actions=el('div','','card-actions'),options=el('details');options.append(el('summary','Game options'),button('Delete game…',async()=>{if(await deleteGame(game)){await load();say('Game deleted.');}},'red small-button'));
 actions.append(link,options);card.append(actions);list.append(card);}
 if(!visible.length)empty(list,games.length?'No games match your search and filter.':'Create a game to get the lobby and guest link.');
}
async function load(){if(!hosted&&!keyBox.value)return;const next=await request('/games');if(JSON.stringify(next)!==JSON.stringify(games)){games=next;render();}}
bindHostLoad(async()=>{await load();setKeyFormOpen(false);say('');});$('#filter').onchange=render;$('#search').oninput=render;
$('#create-form').onsubmit=e=>{e.preventDefault();run($('#create'),async()=>{const game=await request('/games','POST',{...appearancePayload(),intervalSeconds:Number($('#interval').value)});location.href='/admin/'+game.id;});};
fetch('/health/ready',{cache:'no-store'}).then(r=>{$('#health').textContent=r.ok?'● Server ready':'Server needs attention';}).catch(()=>$('#health').textContent='Server unavailable');
load().catch(error=>say(error.message));setInterval(()=>load().catch(error=>say(error.message)),15000);
`,'workspace');
}

export function adminPage(_gameId:string):string {
 const rules=Object.entries(RULE_LABELS).map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('');
 return html('Tambola · Game console',String.raw`
 <style>${workspaceCss}
 .workspace .claim-banner{padding:11px 14px;border-color:#ba8960;background:var(--accent-tint)}
 .workspace .power-banner{border-color:#6ba992}.claim-banner strong{font-size:14px;overflow-wrap:anywhere}
 .claim-grid{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:4px;width:min(100%,460px);margin:8px 0;font-variant-numeric:tabular-nums}
 .claim-cell{aspect-ratio:1.45;display:grid;place-items:center;background:var(--occasion-ticket-paper);color:#402636;border-radius:var(--occasion-cell-radius);font-weight:800;font-size:clamp(12px,3.2vw,18px)}
 .claim-cell.empty{background:var(--occasion-line)}.claim-cell.hit{background:#83e5bb;color:#073829}.claim-cell.latest{background:#00e5ff;color:#081d2a}
 .print-dialog{width:min(600px,calc(100% - 24px));max-height:85vh;background:var(--occasion-panel);color:#fff3dc;border:1px solid var(--occasion-line);border-radius:16px;padding:18px}
 .print-dialog::backdrop{background:#000b}.print-options{max-height:42vh;overflow-y:auto;margin:10px 0}
 .workspace .print-option{display:flex;align-items:center;gap:8px;margin:0;padding:8px 4px;color:#fff3dc;border-bottom:1px solid var(--soft-line)}
 .workspace .print-option input{width:20px;height:20px;margin:0;flex:none}.print-option span{min-width:0;overflow-wrap:anywhere}
 </style>
 ${hostHeader(true)}
 <div class="host-layout">${hostRail(gameViews,true)}<main class="host-content">
 <header class="host-title"><h1 id="name">Loading game…</h1><div class="row"><span id="status" class="pill">Connecting</span><span id="game-code" class="code" aria-label="Join code"></span><div class="row host-game-meta"><span data-live-status></span>${cloudMode()?refreshButton:''}</div></div></header>
 <p id="message" role="status" class="notice"></p><p id="recovery-notice" class="notice"></p>
 <section id="claim-banner" class="panel claim-banner" role="alert" hidden><div class="row between"><strong id="claim-message"></strong><button id="claim-review" class="small-button">Review claim</button></div></section>
 <section id="power-banner" class="panel claim-banner power-banner" role="alert" hidden><div class="row between"><strong id="power-message"></strong><button id="power-review" class="small-button">Review Lucky Strike</button></div></section>
 <section id="review-panel" class="panel stack" hidden><div><h2 id="review-title"></h2><p id="review-help" class="section-note"></p></div><div id="review-grid" class="claim-grid"></div><div class="row"><button id="review-confirm">Confirm and resume</button><button id="review-cancel" class="ghost">Cancel review</button></div></section>

 <section id="round" data-view="round">
  <header class="section-intro"><h2 tabindex="-1" data-view-heading>Live round</h2><p class="section-note">Run the draw, check called numbers, or adjust the time between calls.</p></header>
  <div class="round-dashboard" id="controls">
   <section class="panel draw-hero" aria-label="Draw status"><div class="draw-stat"><span class="small">Latest call</span><strong id="latest" class="status-number">—</strong><span id="progress" class="small"></span></div><div class="draw-stat"><span id="timer-label" class="small">Next call in</span><strong id="timer" class="clock">—</strong></div></section>
   <section class="panel round-actions" aria-label="Round actions">
    <div class="row" id="draw-actions"><button id="start" disabled>Start game</button><button id="pause" class="ghost" disabled hidden>Pause</button><button id="resume" disabled hidden>Resume</button><button id="release" class="red" disabled hidden>Release stop</button><button id="next" disabled hidden>Call next now</button></div>
    <p class="section-note" id="start-help" hidden></p>
    <div class="row alert-actions"><button id="stop" class="red small-button" disabled>Emergency stop</button><button id="enable-alerts" class="ghost small-button">Enable claim sound</button></div>
   </section>
  </div>
  <div class="round-dashboard round-tools"><details class="panel section-disclosure"><summary>Round timing & manual call</summary><div class="section-body stack">
    <div class="row"><button id="add-time" class="ghost small-button" disabled>+30 seconds</button><button id="reset-time" class="ghost small-button" disabled>Reset countdown</button></div>
    <div class="forms-inline"><label>Seconds between calls<input id="interval" type="number" value="30" min="10" max="86400"></label><button id="save-interval" class="ghost small-button" disabled>Set interval & reset</button></div>
    <div class="forms-inline toolbar"><label>Uncalled number<input id="manual" placeholder="1–90" type="number" min="1" max="90"></label><button id="manualBtn" class="ghost small-button" disabled>Call this number</button></div>
   </div></details>
   <section class="panel stack"><div><h3>Called numbers</h3><p class="section-note">The filled tile is the latest call.</p></div><div id="round-board" class="round-board" role="group" aria-label="Board of numbers 1 to 90">${calledBoard}</div></section>
  </div>
 </section>

 <section id="players-panel" data-view="players" hidden>
  <header class="section-intro surface-heading"><div><h2 tabindex="-1" data-view-heading>Players & tickets</h2><p class="section-note">Verify each name before approving it. Submitted tickets are ready to print.</p></div><a class="button ghost small-button" href="#sharing" data-view-link="sharing">Invite players</a></header>
  <div class="panel stack"><div class="surface-heading"><div class="game-filters"><input id="player-search" type="search" placeholder="Find a player" aria-label="Find a player"><span id="players-count" class="small"></span></div><button id="print-all" class="ghost small-button" disabled>Print all tickets</button></div><p id="conflicts" class="notice"></p><div id="players" class="workspace-list"></div></div>
 </section>

 <section id="prizes" data-view="prizes" hidden>
  <header class="section-intro"><h2 tabindex="-1" data-view-heading>Prizes & claims</h2><p class="section-note">Set prizes before play, then review claims and tie-breaks as the round progresses.</p></header>
  <p id="auto-eligible" class="notice" role="status"></p>
  <section id="claims-panel" class="panel stack"><div><h3>Claims & eligible tickets</h3><p class="section-note">Claims alert you for review. The earliest qualifying ticket can win automatically.</p></div><div id="claims" class="workspace-list"></div><div><h3>Qualified tickets</h3><div id="eligible" class="workspace-list"></div></div></section>
  <div class="workspace-grid">
   <section id="prizes-panel" class="panel stack"><div class="surface-heading"><div><h3>Prize categories</h3><p class="section-note">Set the winning rule, prize and tie policy.</p></div><span id="categories-count" class="small"></span></div><div id="categories" class="workspace-list"></div>
    <details id="add-prize-panel" class="toolbar section-disclosure" hidden><summary>Add a prize</summary><form id="category-form" class="form-flow"><div class="grid"><label>Name<input id="category-name" maxlength="80" required placeholder="Early Seven"></label><label>Winning rule<select id="category-rule">${rules}</select></label><label>Prize or description<input id="category-prize" maxlength="200" placeholder="Gift hamper"></label><label>Ties<select id="category-policy"><option value="SHARED_PRIZE">Share the prize</option><option value="SUDDEN_DEATH">Sudden-death round</option></select></label></div><button id="add-category">Add category</button></form></details>
   </section>
   <div class="stack"><section id="powers-panel" class="panel stack"><div><h3 tabindex="-1">Lucky Strike requests</h3><p class="section-note">A request pauses play. Approval calls the requested number. Resume when ready.</p></div><div id="power-requests" class="workspace-list"></div></section>
    <section id="rounds-panel" class="panel stack"><div><h3>Sudden-death rounds</h3><p class="section-note">Run the tie-break for prizes configured for sudden death.</p></div><div id="rounds" class="workspace-list"></div></section>
    <section id="winners-panel" class="panel stack"><h3>Declared winners</h3><div id="winners" class="workspace-list"></div></section>
   </div>
  </div>
 </section>

 <section id="access-panel" data-view="sharing" hidden>
  <header class="section-intro"><h2 tabindex="-1" data-view-heading>TV & guest links</h2><p class="section-note">Open the game board on a display. Give players the join link for their phones.</p></header>
  <div class="workspace-grid">
   <section class="panel stack"><div><h3>TV display</h3><p class="section-note">${cloudMode()?'Open the board here or pair another device with a one-use code.':'Open the board on a device on the same Wi-Fi as the host.'}</p></div><div class="share-layout"><img id="tvQr" class="qr" alt="QR code to open the TV display"${cloudMode()?' hidden':''}><div class="wrap-safe"><a id="tvUrl" target="_blank" rel="noopener">Loading…</a><p><a id="tvLink" class="button ghost small-button" target="_blank" rel="noopener">Open TV</a></p>${cloudMode()?'<div class="toolbar stack"><button id="pair-tv" type="button">Pair a TV</button><p id="pair-instructions" class="section-note">On the TV, open /screen. Pairing codes work once and expire after 10 minutes.</p><strong id="pair-code" class="code"></strong><a id="pair-link" target="_blank" rel="noopener" hidden>Open this pairing link</a><details class="section-disclosure"><summary>Manage paired TVs</summary><button id="revoke-tv" class="red small-button">Disconnect all TVs</button></details></div>':''}</div></div></section>
   <section class="panel stack"><div><h3>Player invitations</h3><p class="section-note">Guests enter their name to get a ticket. Approve them in Players &amp; tickets.</p></div><div class="form-flow"><label>Guest join link<input id="guest-url" type="url" readonly></label><div class="row"><a id="joinLink" class="button small-button" target="_blank" rel="noopener">Open guest link</a><button id="copy-guest-link" class="ghost small-button" disabled>Copy guest link</button></div></div></section>
  </div>
 </section>

 <section id="style" data-view="style" hidden>
  <header class="section-intro"><h2 tabindex="-1" data-view-heading>Style & commentary</h2><p class="section-note">Set the occasion for every screen and choose how the TV narrates the game.</p></header>
  <div class="panel"><details id="appearance-panel" class="section-disclosure"><summary>Appearance</summary><form id="appearance-form" class="section-body form-flow">${appearanceFields}<div class="row"><button id="save-appearance">Save appearance</button><span id="appearance-result" class="small" role="status"></span></div></form></details></div>
  <div class="panel">${commentaryFields}</div>
 </section>

 <section id="audit-panel" data-view="activity" hidden>
  <header class="section-intro"><h2 tabindex="-1" data-view-heading>Activity & recovery</h2><p class="section-note">Review host actions, restart recovery and permanent game controls.</p></header>
  <section class="panel stack"><div><h3>Game activity</h3><p class="section-note">After a server restart, an active game comes back paused. Check the latest call before resuming.</p></div><div id="audit" class="workspace-list"></div></section>
  <details id="game-end-panel" class="panel section-disclosure danger-section"><summary>End or delete this game</summary><div class="section-body stack"><p class="section-note">Ending closes play and keeps your records. Deleting removes the game, tickets, calls and history.</p><div class="row"><button id="end" class="red" disabled>End game…</button><button id="delete-game" class="red" disabled>Delete game…</button></div></div></details>
 </section>

 <dialog id="print-dialog" class="print-dialog" aria-labelledby="print-title"><h2 id="print-title">Select tickets for A4</h2><p class="small">Choose the submitted tickets to print. Each sheet holds up to three tickets.</p><div class="row"><button id="print-select-all" class="ghost" type="button">Select all</button><button id="print-select-none" class="ghost" type="button">Deselect all</button><span id="print-count" class="small"></span></div><div id="print-options" class="print-options"></div><p id="print-error" class="notice" role="alert"></p><div class="row"><button id="print-selected" type="button">Preview selected</button><button id="print-cancel" class="ghost" type="button">Cancel</button></div></dialog>
 </main></div>`,helpers+workspaceNavigation+appearanceEditorJs+String.raw`
const id=location.pathname.split('/').filter(Boolean).pop(),root='/games/'+encodeURIComponent(id);
let display=null,players=[],categories=[],refreshPromise=null,queued=false,intervalLoaded=false,serverClock=0,clockAt=0;
let knownClaims=null,knownPowers=null,alertContext=null,alertEnabled=false,pendingClaim=null,loadedGameList=null;
let playerRows,categoryRows;
const req=(path,method='GET',body)=>request(root+path,method,body);
${commentaryEditorJs}
if(!hosted)$('#tvQr').src='/admin/'+encodeURIComponent(id)+'/tv-qr.svg';else{
 $('#tvQr').hidden=true;
 $('#pair-tv').onclick=()=>run($('#pair-tv'),async()=>{const pair=await req('/admin/tv-pair','POST');$('#pair-code').textContent=pair.code.slice(0,5)+' '+pair.code.slice(5);$('#pair-link').href=pair.url;$('#pair-link').hidden=false;$('#tvQr').src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(pair.qr);$('#tvQr').hidden=false;$('#pair-instructions').textContent='On the TV, open '+location.origin+'/screen and enter this code. Or scan the QR with the display device. Valid for 10 minutes, once only.';});
 $('#revoke-tv').onclick=()=>run($('#revoke-tv'),async()=>{if(!confirm('Disconnect every paired TV for this game?'))return;await req('/admin/tv-revoke','POST');$('#pair-code').textContent='';$('#pair-link').hidden=true;$('#tvQr').hidden=true;say('Paired TVs disconnected. Generate a new code to reconnect.');});
}
for(const section of ['appearance-panel','commentary-panel']){
 const details=$('#'+section),key='tambola-panel-'+section;
 try{details.open=localStorage.getItem(key)==='open';}catch{}
 details.addEventListener('toggle',()=>{try{localStorage.setItem(key,details.open?'open':'closed');}catch{}});
}
const openHostView=setupWorkspace('round',{
 'controls':'round','players-panel':'players','prizes-panel':'prizes','claims-panel':'prizes','powers-panel':'prizes','rounds-panel':'prizes','winners-panel':'prizes',
 'appearance-panel':'style','commentary-panel':'style','access-panel':'sharing','audit-panel':'activity','game-end-panel':'activity'
});
async function act(path,body){try{await req(path,'POST',body);}catch(error){await refresh();throw error;}await refresh();say('Saved.');}
function line(container,label,actions=[],detail='',rowId){
 const item=el('div','','desk-item'),copy=el('div','','desk-item-text');copy.append(el('strong',label));
 if(detail)copy.append(el('small',detail));
 item.append(copy);
 const row=el('div','','row'),extra=el('div','','row');
 for(const action of actions)(action.secondary?extra:row).append(button(action.label,action.run,action.className));
 if(row.children.length)item.append(row);
 if(extra.children.length){
  const options=el('details','','row-options');if(rowId)options.dataset.rowId=rowId;
  const summary=el('summary','More actions');summary.setAttribute('aria-label','More actions for '+label);
  options.append(summary,extra);item.append(options);
 }
 container.append(item);
}
function navCount(view,count){const node=$('#'+view+'-nav-count');node.hidden=!count;node.textContent=String(count);}
function rosterDisclosure(list){return new Set(Array.from(list.querySelectorAll('details[open][data-row-id]'),details=>details.dataset.rowId));}
function restoreDisclosures(list,previous){for(const details of list.querySelectorAll('details[data-row-id]'))details.open=previous.has(details.dataset.rowId);}
function renderPlayers(){
 const list=$('#players'),opened=rosterDisclosure(list);list.replaceChildren();const before=display?.game.status==='CREATED';
 for(const player of players.filter(p=>p.name.toLowerCase().includes($('#player-search').value.toLowerCase()))){
  const actions=[];
  if(!player.approved&&player.ticketId&&display.game.status!=='COMPLETED')actions.push({label:'Approve identity',className:'secondary small-button',run:()=>act('/admin/players/'+player.id+'/approve')});
  if(player.ticketStatus==='SUBMITTED')actions.push({label:'Print A4',run:()=>window.printTambolaTickets(id,keyBox.value,player.id)});
  if(before){actions.push({label:'Reissue ticket',secondary:true,run:async()=>{const reason=prompt('Reason for issuing a new ticket? The old ticket becomes invalid.');if(reason)await act('/admin/players/'+player.id+'/reissue',{reason});}});if(player.ticketId)actions.push({label:'Remove from game',secondary:true,className:'red small-button',run:async()=>{if(confirm('Remove '+player.name+' and revoke their ticket?'))await act('/admin/players/'+player.id+'/withdraw');}});}
  actions.push({label:'Reset phone access',secondary:true,run:async()=>{if(!confirm('Release the old phone for '+player.name+'? Verify the person before sharing the new recovery code.'))return;const result=await req('/admin/players/'+player.id+'/reset-access','POST');prompt('Give this recovery code privately to '+player.name+'. Their ticket is saved.',result.recoveryCode);await refresh();}});
  const ticketCode=player.ticketNumber?'T-'+String(player.ticketNumber).padStart(4,'0'):'Withdrawn';
  const status=!player.approved&&player.ticketId?'Awaiting host approval':player.ticketStatus==='SUBMITTED'?'Submitted':player.ticketStatus==='ASSIGNED'?'Draft ticket':'No active ticket';
  line(list,player.name,actions,ticketCode+' · '+status,player.id);
 }
 if(!list.children.length)empty(list,players.length?'No players match this search.':'Share the guest link to invite your first player.');
 const submitted=players.filter(p=>p.ticketStatus==='SUBMITTED').length;
 $('#players-count').textContent=players.filter(p=>p.ticketId).length+' active · '+submitted+' submitted';$('#print-all').disabled=!submitted;restoreDisclosures(list,opened);
}
function renderCategories(){const list=$('#categories'),opened=rosterDisclosure(list);list.replaceChildren();const before=display.game.status==='CREATED';
 for(const category of categories){const actions=[];
  if(before){actions.push({label:category.active?'Disable':'Enable',secondary:true,run:async()=>{await req('/admin/categories/'+category.id,'PATCH',{active:!category.active});await refresh();}});
   actions.push({label:'Edit name / prize',run:async()=>{const name=prompt('Category name',category.name);if(name===null)return;const prizeDescription=prompt('Prize or description',category.prize_description||'');if(prizeDescription===null)return;await req('/admin/categories/'+category.id,'PATCH',{name,prizeDescription});await refresh();}});
   actions.push({label:category.tie_break_policy==='SHARED_PRIZE'?'Use tie-break':'Share ties',secondary:true,run:async()=>{await req('/admin/categories/'+category.id,'PATCH',{tieBreakPolicy:category.tie_break_policy==='SHARED_PRIZE'?'SUDDEN_DEATH':'SHARED_PRIZE'});await refresh();}});
  }else if(category.active&&!category.status&&!display.review){actions.push({label:'Resolve prize',className:'secondary small-button',run:async()=>{if(confirm('Declare the outcome for '+category.name+'?'))await act('/admin/categories/'+category.id+'/resolve');}});}
  const status=category.active?(category.status?.replaceAll('_',' ').toLowerCase()||'Open'):'Disabled';
  const policy=category.tie_break_policy==='SHARED_PRIZE'?'Share ties':'Sudden death';
  line(list,category.name,actions,[status,policy,category.prize_description].filter(Boolean).join(' · '),category.id);
 }$('#categories-count').textContent=categories.filter(c=>c.active).length+' active';$('#add-category').disabled=!before;$('#add-prize-panel').hidden=!before;restoreDisclosures(list,opened);
}
const boardCells=Array.from($('#round-board').children);
let boardState;
function renderBoard(calls){
 const next=calls.map(call=>call.number).join(',');if(next===boardState)return;boardState=next;
 const called=new Set(calls.map(call=>call.number)),latest=calls.at(-1)?.number;
 for(const [index,cell] of boardCells.entries()){
  const number=index+1;cell.classList.toggle('is-called',called.has(number));cell.classList.toggle('is-latest',number===latest);
  cell.setAttribute('aria-label',number+(number===latest?', latest call':called.has(number)?', called':''));
 }
}
function controls(){const game=display.game,stopped=game.emergencyStopped,ended=game.status==='COMPLETED';
 const lobby=game.status==='CREATED',running=game.status==='RUNNING',paused=game.status==='PAUSED',unapproved=display.players.filter(p=>!p.approved).length;
 $('#start').hidden=!lobby||stopped;$('#pause').hidden=!running||stopped;$('#resume').hidden=!paused||stopped;$('#next').hidden=!running||stopped;
 $('#start').disabled=pendingButtons.has($('#start'))||!lobby||stopped||unapproved>0;$('#pause').disabled=pendingButtons.has($('#pause'))||!running;$('#resume').disabled=pendingButtons.has($('#resume'))||!paused||stopped||!!display.review;
 $('#next').disabled=pendingButtons.has($('#next'))||!running||stopped;$('#manualBtn').disabled=pendingButtons.has($('#manualBtn'))||!running||stopped;
 $('#release').hidden=!stopped||game.endedByAdmin;$('#release').disabled=pendingButtons.has($('#release'));$('#end').disabled=pendingButtons.has($('#end'))||game.endedByAdmin;$('#stop').disabled=pendingButtons.has($('#stop'))||stopped;$('#delete-game').disabled=pendingButtons.has($('#delete-game'));
 $('#draw-actions').hidden=Array.from($('#draw-actions').children).every(control=>control.hidden);
 for(const selector of ['#add-time','#reset-time','#save-interval'])$(selector).disabled=ended||stopped||pendingButtons.has($(selector));
 $('#recovery-notice').textContent=game.endedByAdmin?'Game ended by host. Records are retained.':stopped?'EMERGENCY STOP · All draws are frozen. Release the stop, then resume the required game or tie-break.':game.recoveredAt?'Recovered after restart. Check the last number and resume when everyone is ready.':'';
 updateBadge($('#status'),game.status,stopped);$('#game-code').textContent=game.joinCode;$('#name').textContent=game.name;
 $('#start-help').hidden=!lobby||stopped;$('#start-help').textContent=unapproved?'Approve or remove '+unapproved+' waiting '+(unapproved===1?'player':'players')+' before starting.':'Approved draft tickets submit automatically when play starts.';
 $('#latest').textContent=display.calls.at(-1)?.number??'—';$('#progress').textContent=lobby?display.players.length-unapproved+' of '+display.players.length+' approved':display.calls.length+' of 90 called';
 $('#timer-label').textContent=ended?'Countdown':stopped||paused?'Time held':lobby?'Call interval':'Next call in';
 navCount('players',unapproved);
 if(!intervalLoaded){$('#interval').value=game.intervalSeconds;intervalLoaded=true;}
 const tvUrl=location.origin+'/tv/'+encodeURIComponent(game.joinCode);$('#tvLink').href=tvUrl;$('#tvUrl').href=tvUrl;$('#tvUrl').textContent=tvUrl;
 const guestUrl=(display.guestOrigin||location.origin)+'/g/'+encodeURIComponent(game.joinCode);$('#joinLink').href=guestUrl;$('#guest-url').value=guestUrl;$('#copy-guest-link').disabled=false;clock();
}
function secondsLeft(){const game=display?.game;return game?.nextCallAt?Math.max(0,Math.ceil((Date.parse(game.nextCallAt)-(serverClock+performance.now()-clockAt))/1000)):game?.pausedRemainingSeconds??game?.intervalSeconds??0;}
function clock(){if(!display)return;const seconds=secondsLeft();$('#timer').textContent=display.game.status==='COMPLETED'?'Ended':String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
function ticketGrid(grid){const box=el('div','','claim-grid'),called=new Set(display.calls.map(call=>call.number)),latest=display.calls.at(-1)?.number;for(const row of grid)for(const number of row){const cell=el('div',number===null?'':String(number),'claim-cell'+(number===null?' empty':called.has(number)?' hit':'')+(number===latest?' latest':''));box.append(cell);}return box;}
function claimSound(){if(!alertEnabled||!alertContext)return;try{const now=alertContext.currentTime;for(const [index,note] of [880,660,880].entries()){const oscillator=alertContext.createOscillator(),gain=alertContext.createGain();oscillator.frequency.value=note;gain.gain.setValueAtTime(.14,now+index*.2);gain.gain.exponentialRampToValueAtTime(.001,now+index*.2+.18);oscillator.connect(gain);gain.connect(alertContext.destination);oscillator.start(now+index*.2);oscillator.stop(now+index*.2+.2);}}catch{}}
function renderClaims(claims){const pending=claims.filter(claim=>claim.status==='PENDING'),current=new Set(claims.map(claim=>claim.id));if(knownClaims&&pending.some(claim=>!knownClaims.has(claim.id)))claimSound();knownClaims=current;pendingClaim=pending[0]||null;
 $('#claim-banner').hidden=!pendingClaim;$('#claim-message').textContent=pendingClaim?'Claim from '+pendingClaim.name+' · '+pendingClaim.category_name+(pending.length>1?' (+'+(pending.length-1)+' more)':'')+(display.game.status==='PAUSED'?' · Game paused':''):'';$('#claim-review').hidden=!!display.review;
 for(const claim of claims){const item=el('article','','claim-history desk-item');const copy=el('div','','desk-item-text');copy.append(el('strong',claim.name+' · '+claim.category_name),el('small',claim.status.toLowerCase().replaceAll('_',' ')+' · Call '+claim.first_eligible_sequence),ticketGrid(claim.grid));item.append(copy);if(claim.status==='PENDING'&&!display.review)item.append(button('Review claim',()=>act('/admin/claims/'+claim.id+'/review'),'secondary small-button'));$('#claims').append(item);}
 const review=display.review;$('#review-panel').hidden=!review;if(review){$('#review-title').textContent=review.name+' · '+review.category_name+' · T-'+String(review.ticket_number).padStart(4,'0');$('#review-grid').replaceChildren(...ticketGrid(review.grid).children);$('#review-help').textContent='Called numbers are marked. A tie-break or another request can keep play paused after confirmation.';$('#review-confirm').textContent=review.resume_after?'Confirm and resume':'Confirm prize (stay paused)';$('#review-confirm').disabled=display.game.emergencyStopped||pendingButtons.has($('#review-confirm'));}
 $('#auto-eligible').textContent=display.eligibility.length?'Automatically qualified · '+display.eligibility.map(item=>item.category_name+': '+item.name).join(' / '):'';
 return pending.length;
}
function refresh(){if(refreshPromise){queued=true;return refreshPromise;}refreshPromise=(async()=>{do{queued=false;await refreshOnce();}while(queued);})().finally(()=>{refreshPromise=null;});return refreshPromise;}
async function refreshOnce(){try{
 const started=performance.now();display=await req('/display');loadAppearance(display.game);const currentOption=Array.from($('#switch-game').options).find(option=>option.value===display.game.id);if(currentOption)currentOption.textContent=display.game.name+' · '+display.game.joinCode;const received=performance.now();serverClock=Date.parse(display.serverTime)+(received-started)/2;clockAt=received;controls();renderBoard(display.calls);
 if(!hosted&&!keyBox.value){say('Use Admin key in the header to unlock controls.');return;}
 const data=await Promise.all([req('/admin/players'),req('/admin/power-requests'),req('/categories'),req('/admin/claims'),req('/admin/eligible-winners'),req('/admin/audit'),req('/admin/ticket-conflicts')]);
 players=data[0];categories=data[2].map(c=>({...c,status:display.categories.find(x=>x.id===c.id)?.status}));
 const nextPlayers=JSON.stringify([display.game.status,players]);if(nextPlayers!==playerRows){playerRows=nextPlayers;renderPlayers();}
 const nextCategories=JSON.stringify([display.game.status,Boolean(display.review),categories]);if(nextCategories!==categoryRows){categoryRows=nextCategories;renderCategories();}
 $('#conflicts').textContent=data[6].length?'Conflicting tickets found: '+data[6].map(c=>c.tickets.join(', ')).join('; ')+'. Reissue before play.':'';
 for(const target of ['#power-requests','#claims','#eligible','#rounds','#winners','#audit'])$(target).replaceChildren();
 const pendingPowers=data[1].filter(power=>power.status==='PENDING'),powerIds=new Set(data[1].map(power=>power.id));if(knownPowers&&pendingPowers.some(power=>!knownPowers.has(power.id)))claimSound();knownPowers=powerIds;$('#power-banner').hidden=!pendingPowers.length;$('#power-message').textContent=pendingPowers.length?'Lucky Strike from '+pendingPowers[0].playerName+' · '+pendingPowers[0].number+(pendingPowers.length>1?' (+'+(pendingPowers.length-1)+' more)':'')+(display.game.status==='PAUSED'?' · Game paused':''):'';
 for(const power of data[1])line($('#power-requests'),power.playerName,power.status==='PENDING'?[
 {label:'Approve & call',className:'secondary small-button',run:async()=>{if(confirm('Call '+power.number+' for '+power.playerName+'?'))await act('/admin/power-requests/'+power.id+'/approve');}},
 {label:'Reject',run:()=>act('/admin/power-requests/'+power.id+'/reject')}]:[],'Number '+power.number+' · '+power.status.toLowerCase());
 navCount('prizes',renderClaims(data[3])+pendingPowers.length);
 for(const eligible of data[4])line($('#eligible'),eligible.name,[],eligible.category_name+' · Call '+eligible.first_eligible_sequence);
 for(const winner of display.winners)line($('#winners'),winner.category_name,[],winner.name);
 for(const round of display.suddenDeath){const category=categories.find(c=>c.id===round.category_id);if(category)line($('#rounds'),round.category_name,round.status==='RESOLVED'?[]:[{label:round.status==='RUNNING'?'Pause':'Start / resume',run:()=>act('/admin/categories/'+category.id+'/sudden-death/'+(round.status==='RUNNING'?'pause':'start'))}],round.status.toLowerCase().replaceAll('_',' ')+' · '+round.draw_sequence+' draws');}
 for(const event of data[5]){const detail=event.details;const description=event.action==='GAME_UPDATED'?(detail.stopped?'Play stopped':detail.to+' · '+detail.intervalSeconds+' seconds between calls'):(players.find(p=>p.id===detail.playerId)?.name||'Player');line($('#audit'),event.action.replaceAll('_',' ').toLowerCase(),[],new Date(event.created_at).toLocaleTimeString()+' · '+description);}
 const emptyStates={ 'power-requests':'No Lucky Strike requests yet.','claims':'No claims have been submitted.','eligible':'No tickets have qualified yet.','rounds':'No tie-breaks have been scheduled.','winners':'No prizes have been awarded yet.','audit':'Host actions will appear here.' };
 for(const [target,message] of Object.entries(emptyStates))if(!$('#'+target).children.length)empty($('#'+target),message);
 }catch(error){say(error.message);}}
async function loadGames(){
 const games=await request('/games'),select=$('#switch-game'),signature=JSON.stringify(games.map(game=>[game.id,game.name,game.joinCode]));
 if(signature===loadedGameList)return;
 loadedGameList=signature;select.replaceChildren();
 for(const game of games){const option=el('option',game.name+' · '+game.joinCode);option.value=game.id;option.selected=game.id===id;select.append(option);}
 select.disabled=!games.length;
}
$('#switch-game').onchange=()=>location.href='/admin/'+encodeURIComponent($('#switch-game').value);
bindHostLoad(async()=>{await loadGames();setKeyFormOpen(false);say('');await loadCommentary();await refresh();});$('#player-search').oninput=renderPlayers;
$('#copy-guest-link').onclick=()=>run($('#copy-guest-link'),async()=>{
 const field=$('#guest-url');
 try{await navigator.clipboard.writeText(field.value);say('Guest link copied.');}
 catch{field.focus();field.select();say('Guest link selected. Copy it to invite players.');}
});
for(const action of ['start','pause','resume'])$('#'+action).onclick=()=>run($('#'+action),()=>act('/'+action));
$('#stop').onclick=()=>run($('#stop'),()=>act('/admin/stop'));$('#release').onclick=()=>run($('#release'),()=>act('/admin/release-stop'));
$('#appearance-form').onsubmit=e=>{e.preventDefault();run($('#save-appearance'),async()=>{$('#appearance-result').textContent='';const live=['RUNNING','PAUSED'].includes(display.game.status);if(live&&!confirm('Update the appearance on all connected screens during this game?'))return;await req('/admin/appearance','POST',{...appearancePayload(),confirmLive:live});appearanceDirty=false;await refresh();$('#appearance-result').textContent='Appearance saved on all screens.';});};
$('#delete-game').onclick=()=>run($('#delete-game'),async()=>{if(await deleteGame(display.game))location.href='/admin';});
$('#end').onclick=()=>run($('#end'),async()=>{if(prompt('Type '+display.game.joinCode+' to end this game permanently.')===display.game.joinCode)await act('/admin/end');});
$('#next').onclick=()=>run($('#next'),()=>act('/admin/call-next',{expectedSequence:display.calls.length+1}));
$('#add-time').onclick=()=>run($('#add-time'),()=>act('/admin/timer',{seconds:Math.min(86400,secondsLeft()+30)}));
$('#reset-time').onclick=()=>run($('#reset-time'),()=>act('/admin/timer',{seconds:display.game.intervalSeconds}));
$('#save-interval').onclick=()=>run($('#save-interval'),()=>act('/admin/timer',{seconds:Number($('#interval').value),intervalSeconds:Number($('#interval').value)}));
$('#manualBtn').onclick=()=>run($('#manualBtn'),async()=>{const number=Number($('#manual').value);if(confirm('Call '+number+' now?'))await act('/calls/manual',{number});});
$('#category-form').onsubmit=e=>{e.preventDefault();run($('#add-category'),async()=>{await act('/admin/categories',{name:$('#category-name').value,ruleType:$('#category-rule').value,prizeDescription:$('#category-prize').value,tieBreakPolicy:$('#category-policy').value});$('#category-form').reset();});};
function updatePrintSelection(){const count=$$('#print-options input:checked').length;$('#print-count').textContent=count+' selected';$('#print-selected').disabled=count===0;}
function $$(selector){return Array.from(document.querySelectorAll(selector));}
$('#print-all').onclick=()=>{const submitted=players.filter(player=>player.ticketStatus==='SUBMITTED');if(!submitted.length){say('No submitted tickets to print.');return;}$('#print-options').replaceChildren();$('#print-error').textContent='';for(const player of submitted){const label=el('label','','print-option'),box=el('input');box.type='checkbox';box.checked=true;box.value=player.id;box.onchange=updatePrintSelection;label.append(box,el('span',player.name+' · T-'+String(player.ticketNumber).padStart(4,'0')));$('#print-options').append(label);}updatePrintSelection();$('#print-dialog').showModal();};
$('#print-select-all').onclick=()=>{$$('#print-options input').forEach(box=>box.checked=true);updatePrintSelection();};
$('#print-select-none').onclick=()=>{$$('#print-options input').forEach(box=>box.checked=false);updatePrintSelection();};
$('#print-cancel').onclick=()=>$('#print-dialog').close();
$('#print-selected').onclick=()=>{void run($('#print-selected'),async()=>{const selected=$$('#print-options input:checked').map(box=>box.value);$('#print-error').textContent='';try{await window.printTambolaTickets(id,keyBox.value,selected);$('#print-dialog').close();}catch(error){$('#print-error').textContent=error.message;throw error;}}).finally(updatePrintSelection);};
$('#claim-review').onclick=()=>run($('#claim-review'),()=>pendingClaim&&act('/admin/claims/'+pendingClaim.id+'/review'));
$('#power-review').onclick=()=>{openHostView('prizes');$('#powers-panel').scrollIntoView({block:'start'});$('#powers-panel h3').focus({preventScroll:true});};
$('#review-confirm').onclick=()=>run($('#review-confirm'),async()=>{const result=await req('/admin/claims/'+display.review.claim_id+'/confirm','POST');await refresh();say(result.outcome?.status==='SUDDEN_DEATH_PENDING'?'Tie-break required. The main game remains paused.':result.resumed?'Prize confirmed. Game resumed.':'Prize confirmed. Game remains paused.');openHostView(result.outcome?.status==='SUDDEN_DEATH_PENDING'?'prizes':'round');});
$('#review-cancel').onclick=()=>run($('#review-cancel'),()=>act('/admin/claims/'+display.review.claim_id+'/cancel'));
$('#enable-alerts').onclick=()=>{try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){say('Claim sounds are unavailable in this browser.');return;}alertContext??=new Audio();alertEnabled=true;alertContext.resume().then(()=>{claimSound();$('#enable-alerts').textContent='Claim sound enabled';}).catch(()=>say('Click again to enable claim sound.'));}catch{say('Claim sounds are unavailable in this browser.');}};
if(hosted||keyBox.value)loadGames().catch(error=>say(error.message));refresh();setInterval(refresh,5000);setInterval(clock,300);window.addEventListener('tambola:changed',refresh);
`,'workspace',['/print/client.js']);
}
