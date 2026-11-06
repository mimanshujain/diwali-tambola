import { html, adminSidebar } from './theme.js';
import { RULE_LABELS } from '../winners/domain/rules.js';

const helpers=String.raw`
const $=s=>document.querySelector(s);
const keyBox=$('#key');keyBox.value=sessionStorage.getItem('tambola-admin-key')||'';
keyBox.oninput=()=>sessionStorage.setItem('tambola-admin-key',keyBox.value);
function say(message){$('#message').textContent=message||'';}
function el(tag,text,className){const node=document.createElement(tag);node.textContent=text??'';if(className)node.className=className;return node;}
function button(label,action,className='ghost small-button'){const node=el('button',label,className);node.type='button';node.onclick=()=>run(node,action);return node;}
const pendingButtons=new Set();
async function request(path,method='GET',body){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetch(path,{method,cache:'no-store',signal:controller.signal,headers:{'content-type':'application/json',...(keyBox.value?{'x-admin-key':keyBox.value}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(Array.isArray(data.message)?data.message.join(', '):data.message||'Request failed ('+response.status+')');return data;
 }catch(error){if(error.name==='AbortError')throw Error('Request timed out. Refreshing the last confirmed state.');throw error;}finally{clearTimeout(timeout);}
}
async function run(button,action){if(pendingButtons.has(button))return;pendingButtons.add(button);button.disabled=true;try{await action();}catch(error){say(error.message);}finally{pendingButtons.delete(button);button.disabled=false;if(typeof controls==='function'&&display)controls();}}
function empty(container,message){container.replaceChildren(el('div',message,'empty'));}
`;

export function homeAdminPage():string {
 return html('Diwali Tambola · Host desk',String.raw`
 <div class="admin-shell"><aside class="sidebar"><div class="brand">🪔 DIWALI<br>TAMBOLA</div><nav aria-label="Admin navigation"><a href="/admin" aria-current="page">All games</a><a href="#create-panel">Create a game</a></nav><small>Welcome to the host desk.<br>Let the festivities begin.</small></aside>
 <main class="wrap stack" style="width:100%"><header class="topbar"><div><div class="eyebrow">The host desk</div><h1>Your evening, in play.</h1><p class="muted">Create, switch and manage your Tambola games.</p></div><span id="health" class="connection">Checking server…</span></header>
 <div class="panel auth"><label>Admin key<input id="key" type="password" autocomplete="off" placeholder="Your private host key"></label><button id="load">Unlock games</button></div>
 <p id="message" class="notice" role="status"></p>
 <section><div class="topbar"><h2>Games <span id="game-count" class="pill">0</span></h2><div class="row"><input id="search" type="search" aria-label="Search games" placeholder="Find a game or code" style="width:230px"><select id="filter" aria-label="Filter games" style="width:170px"><option value="active">Active games</option><option value="all">All games</option><option value="COMPLETED">Completed</option></select></div></div><div id="games" class="game-cards"><p class="muted">Enter your admin key to load your games.</p></div></section>
 <section id="create-panel" class="panel"><div class="eyebrow">A new round of luck</div><h2>Create a game</h2><form id="create-form"><div class="grid"><label>Game name<input id="name" value="Diwali Tambola" maxlength="100" required></label><label>Seconds between calls<input id="interval" type="number" min="10" max="86400" value="30" required></label></div><p class="small">Guests join by name. Approve each player before they submit. Every player receives a private recovery code.</p><button id="create" type="submit">Create game →</button></form></section>
 </main></div>`,helpers+String.raw`
let games=[];
function render(){
 const list=$('#games'),query=$('#search').value.toLowerCase(),filter=$('#filter').value;list.replaceChildren();
 const visible=games.filter(g=>(filter==='all'||(filter==='active'?g.status!=='COMPLETED':g.status===filter))&&(g.name+' '+g.joinCode).toLowerCase().includes(query));
 $('#game-count').textContent=String(visible.length);
 for(const game of visible){const card=el('article','','panel game-card');const top=el('div','','row between');top.append(el('span',game.emergencyStopped?'STOPPED':game.status,'pill'),el('span',game.joinCode,'code'));card.append(top,el('h2',game.name));
 const metrics=el('div','','metrics');for(const [value,label] of [[game.playerCount,'players'],[game.submittedCount,'submitted'],[game.calledCount,'called']]){const metric=el('div','','metric');metric.append(el('strong',String(value)),el('small',label));metrics.append(metric);}card.append(metrics);
 if(game.recoveredAt)card.append(el('p','Recovered after restart · ready for host review','small'));
 const link=el('a','Open console →','button');link.href='/admin/'+game.id;card.append(link);list.append(card);}
 if(!visible.length)empty(list,'No games here yet. Create one below or change the filter.');
}
async function load(){if(!keyBox.value)return;games=await request('/games');render();}
$('#load').onclick=()=>run($('#load'),load);$('#filter').onchange=render;$('#search').oninput=render;
$('#create-form').onsubmit=e=>{e.preventDefault();run($('#create'),async()=>{const game=await request('/games','POST',{name:$('#name').value,intervalSeconds:Number($('#interval').value)});location.href='/admin/'+game.id;});};
fetch('/health/ready',{cache:'no-store'}).then(r=>{$('#health').textContent=r.ok?'● Server ready':'Server needs attention';}).catch(()=>$('#health').textContent='Server unavailable');
load().catch(error=>say(error.message));setInterval(()=>load().catch(error=>say(error.message)),15000);
`);
}

export function adminPage(_gameId:string):string {
 const rules=Object.entries(RULE_LABELS).map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('');
 return html('Diwali Tambola · Game console',String.raw`
 <style>.claim-banner{background:#ffdf75;color:#281800;border:3px solid #fff3bb}.claim-banner strong{font-size:clamp(20px,3vw,30px)}.power-banner{background:#91e6cf;border-color:#d4fff2;color:#123629}.claim-grid{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:4px;max-width:620px;margin:10px 0}.claim-cell{aspect-ratio:1.2;display:grid;place-items:center;background:#fff0d4;color:#402636;border-radius:4px;font-weight:800}.claim-cell.empty{background:#59334d}.claim-cell.hit{background:#83e5bb;color:#073829}.claim-cell.latest{background:#00e5ff;color:#081d2a;box-shadow:inset 0 0 0 2px white}.print-dialog{width:min(600px,calc(100vw - 32px));max-height:85vh;background:#2a192e;color:#fff3dc;border:1px solid #80576c;border-radius:16px;padding:22px}.print-dialog::backdrop{background:#000b}.print-options{max-height:42vh;overflow:auto;margin:12px 0}.print-option{display:flex;align-items:center;gap:10px;margin:0;padding:9px 4px;color:#fff3dc;font-size:15px;border-bottom:1px solid #604052}.print-option input{width:20px;height:20px;margin:0;flex:none}.print-option span{min-width:0;overflow-wrap:anywhere}#latest{color:#00e5ff}[hidden]{display:none!important}</style>
 <div class="admin-shell">${adminSidebar}<main class="wrap stack" style="width:100%">
 <header class="topbar"><div><div class="eyebrow"><a href="/admin">Host desk</a> / Game console</div><h1 id="name">Loading game…</h1><div class="row"><span id="status" class="pill">—</span><span id="game-code" class="code"></span></div></div><label>Switch game<select id="switch-game" aria-label="Switch game"><option>Loading…</option></select></label></header>
 <div class="panel auth"><label>Admin key<input id="key" type="password" autocomplete="off" placeholder="Your private host key"></label><button id="load">Unlock controls</button></div>
 <p id="message" role="status" class="notice"></p><p id="recovery-notice" class="notice"></p>
 <section id="claim-banner" class="panel claim-banner" role="alert" hidden><div class="row between"><strong id="claim-message"></strong><button id="claim-review">Review claim</button></div></section>
 <section id="power-banner" class="panel claim-banner power-banner" role="alert" hidden><div class="row between"><strong id="power-message"></strong><button id="power-review">Review Lucky Strike</button></div></section>
 <div class="row"><button id="enable-alerts" class="ghost">Enable claim sound</button><span class="small">Sound needs one click on this device.</span></div>
 <section id="review-panel" class="panel" hidden><div class="eyebrow">Claim review · shown on TV</div><h2 id="review-title"></h2><p id="review-help" class="small"></p><div id="review-grid" class="claim-grid"></div><div class="row"><button id="review-confirm">Confirm and resume</button><button id="review-cancel" class="ghost">Cancel review</button></div></section>
 <p id="auto-eligible" class="notice" role="status"></p>
 <section id="controls" class="panel controls"><div class="row between"><div><div class="eyebrow">Latest call</div><div id="latest" class="status-number">—</div></div><div><div class="eyebrow">Next call in</div><div id="timer" class="clock">—</div></div><button id="stop" class="kill">■ Emergency stop</button></div>
 <div class="row"><button id="start">Start game</button><button id="pause" class="ghost">Pause</button><button id="resume" class="secondary">Resume</button><button id="release" class="red" hidden>Release stop</button><button id="next" class="secondary">Call next now →</button><span id="progress" class="small"></span></div>
 <div class="toolbar"><div class="row"><button id="add-time" class="ghost">+30 seconds</button><button id="reset-time" class="ghost">Reset countdown</button><label style="margin:0;max-width:180px">Call interval (seconds)<input id="interval" type="number" value="30" min="10" max="86400"></label><button id="save-interval" class="ghost">Set interval & reset</button></div></div>
 <details><summary>Manual call & ending the game</summary><div class="row"><input id="manual" aria-label="Manual number" placeholder="1–90" type="number" min="1" max="90" style="width:110px"><button id="manualBtn" class="ghost">Call this number</button><button id="end" class="red">End game…</button></div><p class="small">Emergency stop freezes all draws, including tie-breaks. End game closes play permanently and retains its records.</p></details></section>
 <div class="admin-grid">
 <details id="players-panel" class="panel" open><summary>Players & tickets <span id="players-count" class="count"></span></summary><div class="section-body"><div class="row"><input id="player-search" type="search" placeholder="Find a player" aria-label="Find a player" style="flex:1"><button id="print-all" class="ghost">Print all tickets</button></div><p id="conflicts" class="notice"></p><div id="players" class="list"></div></div></details>
 <details id="prizes-panel" class="panel" open><summary>Prize categories <span id="categories-count" class="count"></span></summary><div class="section-body"><div id="categories" class="list"></div><details><summary>Add a prize</summary><form id="category-form"><label>Name<input id="category-name" maxlength="80" required placeholder="Diwali Early Seven"></label><label>Winning rule<select id="category-rule">${rules}</select></label><label>Prize or description<input id="category-prize" maxlength="200" placeholder="Gift hamper"></label><label>Ties<select id="category-policy"><option value="SHARED_PRIZE">Share the prize</option><option value="SUDDEN_DEATH">Sudden-death round</option></select></label><button id="add-category">Add category</button></form></details><p class="small">Set up and edit prizes before starting. Any Two Lines requires two complete rows. All Odd / All Even requires every matching number on the ticket.</p></div></details>
 <details id="claims-panel" class="panel" open><summary>Claims & eligible tickets</summary><div class="section-body"><p class="small">Eligibility is announced automatically. Claims alert you, but the earliest qualifying ticket wins even without a claim.</p><div id="claims" class="list"></div><h3>Qualified tickets</h3><div id="eligible" class="list"></div></div></details>
 <details id="powers-panel" class="panel"><summary>Lucky Strike requests</summary><div class="section-body"><p class="small">A request pauses play. Approving calls the chosen number without resuming a paused game.</p><div id="power-requests" class="list"></div></div></details>
 <details id="rounds-panel" class="panel"><summary>Sudden-death rounds</summary><div class="section-body"><div id="rounds" class="list"></div></div></details>
 <details id="winners-panel" class="panel" open><summary>Declared winners</summary><div class="section-body"><div id="winners" class="list"></div></div></details>
 <details id="access-panel" class="panel"><summary>TV display & guest access</summary><div class="section-body"><div class="row"><img id="tvQr" class="qr" alt="QR code to open the TV display"><div style="min-width:0;flex:1"><h3>Open the TV display</h3><a id="tvUrl" target="_blank" style="overflow-wrap:anywhere">Loading…</a><p class="small">Scan with your phone on the same Wi-Fi as the Pi.</p><div class="row"><a id="tvLink" class="button ghost" target="_blank">Open TV</a><a id="joinLink" class="button ghost" target="_blank">Guest join link</a></div></div></div></div></details>
 <details id="audit-panel" class="panel"><summary>Activity & recovery</summary><div class="section-body"><p class="small">Game state is saved in PostgreSQL. After an API restart, running games resume here as paused. Review the last call before resuming. Use the supplied backup scripts to protect against storage failure.</p><div id="audit" class="list"></div></div></details>
 </div><dialog id="print-dialog" class="print-dialog" aria-labelledby="print-title"><h2 id="print-title">Select tickets for A4</h2><p class="small">All submitted tickets are selected. Deselect any you do not need; each page holds at most three tickets.</p><div class="row"><button id="print-select-all" class="ghost" type="button">Select all</button><button id="print-select-none" class="ghost" type="button">Deselect all</button><span id="print-count" class="small"></span></div><div id="print-options" class="print-options"></div><p id="print-error" class="notice" role="alert"></p><div class="row"><button id="print-selected" type="button">Preview selected</button><button id="print-cancel" class="ghost" type="button">Cancel</button></div></dialog></main></div>`,helpers+String.raw`
const id=location.pathname.split('/').filter(Boolean).pop(),root='/games/'+encodeURIComponent(id);
let display=null,players=[],categories=[],refreshPromise=null,queued=false,intervalLoaded=false,serverClock=0,clockAt=0;
let knownClaims=null,knownPowers=null,alertContext=null,alertEnabled=false,pendingClaim=null;
const req=(path,method='GET',body)=>request(root+path,method,body);
$('#tvQr').src='/admin/'+encodeURIComponent(id)+'/tv-qr.svg';
for(const details of document.querySelectorAll('details.panel')){const key='tambola-panel-'+details.id;const saved=localStorage.getItem(key);if(saved!==null)details.open=saved==='open';details.addEventListener('toggle',()=>localStorage.setItem(key,details.open?'open':'closed'));}
async function act(path,body){try{await req(path,'POST',body);}catch(error){await refresh();throw error;}await refresh();say('Saved.');}
function line(container,label,actions=[]){const item=el('div',label,'item');const row=el('div','','row');for(const action of actions)row.append(button(action.label,action.run,action.className));if(actions.length)item.append(row);container.append(item);}
function renderPlayers(){const list=$('#players');list.replaceChildren();const before=display?.game.status==='CREATED';
 for(const player of players.filter(p=>p.name.toLowerCase().includes($('#player-search').value.toLowerCase()))){
  const actions=[];
  if(!player.approved&&player.ticketId&&display.game.status!=='COMPLETED')actions.push({label:'Approve identity',className:'secondary small-button',run:()=>act('/admin/players/'+player.id+'/approve')});
  if(player.ticketStatus==='SUBMITTED')actions.push({label:'Print A4',run:()=>window.printTambolaTickets(id,keyBox.value,player.id)});
  if(before){actions.push({label:'Reissue ticket',run:async()=>{const reason=prompt('Reason for issuing a new ticket? The old ticket becomes invalid.');if(reason)await act('/admin/players/'+player.id+'/reissue',{reason});}});if(player.ticketId)actions.push({label:'Remove from game',run:async()=>{if(confirm('Remove '+player.name+' and revoke their ticket?'))await act('/admin/players/'+player.id+'/withdraw');}});}
  actions.push({label:'Release phone / reset access',run:async()=>{if(!confirm('Release the old phone for '+player.name+'? Verify the person before sharing the new recovery code.'))return;const result=await req('/admin/players/'+player.id+'/reset-access','POST');prompt('Give this recovery code privately to '+player.name+'. Their ticket is saved.',result.recoveryCode);await refresh();}});
  line(list,player.name+' · '+(player.ticketNumber?'T-'+String(player.ticketNumber).padStart(4,'0'):'Withdrawn')+' · '+(!player.approved&&player.ticketId?'Awaiting host approval':player.ticketStatus||'No active ticket'),actions);
 }if(!list.children.length)empty(list,'No matching players.');$('#players-count').textContent=players.filter(p=>p.ticketId).length+' active · '+players.filter(p=>p.ticketStatus==='SUBMITTED').length+' submitted';
}
function renderCategories(){const list=$('#categories');list.replaceChildren();const before=display.game.status==='CREATED';
 for(const category of categories){const actions=[];
  if(before){actions.push({label:category.active?'Disable':'Enable',run:async()=>{await req('/admin/categories/'+category.id,'PATCH',{active:!category.active});await refresh();}});
   actions.push({label:'Edit name / prize',run:async()=>{const name=prompt('Category name',category.name);if(name===null)return;const prizeDescription=prompt('Prize or description',category.prize_description||'');if(prizeDescription===null)return;await req('/admin/categories/'+category.id,'PATCH',{name,prizeDescription});await refresh();}});
   actions.push({label:category.tie_break_policy==='SHARED_PRIZE'?'Use tie-break':'Share ties',run:async()=>{await req('/admin/categories/'+category.id,'PATCH',{tieBreakPolicy:category.tie_break_policy==='SHARED_PRIZE'?'SUDDEN_DEATH':'SHARED_PRIZE'});await refresh();}});
  }else if(category.active&&!category.status&&!display.review){actions.push({label:'Resolve prize',className:'secondary small-button',run:async()=>{if(confirm('Declare the outcome for '+category.name+'?'))await act('/admin/categories/'+category.id+'/resolve');}});}
  line(list,category.name+' · '+(category.active?(category.status||'OPEN'):'Disabled')+(category.prize_description?' · '+category.prize_description:''),actions);
 }$('#categories-count').textContent=categories.filter(c=>c.active).length+' active';$('#add-category').disabled=!before;
}
function controls(){const game=display.game,stopped=game.emergencyStopped,ended=game.status==='COMPLETED';
 $('#start').disabled=pendingButtons.has($('#start'))||game.status!=='CREATED'||stopped||display.players.some(p=>!p.approved);$('#start').title=display.players.some(p=>!p.approved)?'Approve or remove waiting players first. Approved drafts submit automatically.':'Approved draft tickets submit automatically when play starts.';$('#pause').disabled=pendingButtons.has($('#pause'))||game.status!=='RUNNING';$('#resume').disabled=pendingButtons.has($('#resume'))||game.status!=='PAUSED'||stopped||!!display.review;
 $('#next').disabled=pendingButtons.has($('#next'))||game.status!=='RUNNING'||stopped;$('#manualBtn').disabled=pendingButtons.has($('#manualBtn'))||game.status!=='RUNNING'||stopped;
 $('#release').hidden=!stopped||game.endedByAdmin;$('#end').disabled=game.endedByAdmin;$('#stop').disabled=stopped;
 for(const selector of ['#add-time','#reset-time','#save-interval'])$(selector).disabled=ended||stopped;
 $('#recovery-notice').textContent=game.endedByAdmin?'Game ended by host. Records are retained.':stopped?'EMERGENCY STOP · All draws are frozen. Release the stop, then resume the required game or tie-break.':game.recoveredAt?'Recovered after restart. Check the last number and resume when everyone is ready.':'';
 $('#status').textContent=stopped?'STOPPED':game.status;$('#game-code').textContent=game.joinCode;$('#name').textContent=game.name;
 $('#latest').textContent=display.calls.at(-1)?.number??'—';$('#progress').textContent=game.status==='CREATED'?display.players.filter(p=>p.approved).length+' / '+display.players.length+' approved · drafts submit at start':display.calls.length+' of 90 called';
 if(!intervalLoaded){$('#interval').value=game.intervalSeconds;intervalLoaded=true;}
 const tvUrl=location.origin+'/tv/'+encodeURIComponent(game.joinCode);$('#tvLink').href=tvUrl;$('#tvUrl').href=tvUrl;$('#tvUrl').textContent=tvUrl;
 $('#joinLink').href=(display.guestOrigin||location.origin)+'/g/'+encodeURIComponent(game.joinCode);clock();
}
function secondsLeft(){const game=display?.game;return game?.nextCallAt?Math.max(0,Math.ceil((Date.parse(game.nextCallAt)-(serverClock+performance.now()-clockAt))/1000)):game?.pausedRemainingSeconds??game?.intervalSeconds??0;}
function clock(){if(!display)return;const seconds=secondsLeft();$('#timer').textContent=display.game.status==='COMPLETED'?'Ended':String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
function ticketGrid(grid){const box=el('div','','claim-grid'),called=new Set(display.calls.map(call=>call.number)),latest=display.calls.at(-1)?.number;for(const row of grid)for(const number of row){const cell=el('div',number===null?'':String(number),'claim-cell'+(number===null?' empty':called.has(number)?' hit':'')+(number===latest?' latest':''));box.append(cell);}return box;}
function claimSound(){if(!alertEnabled||!alertContext)return;try{const now=alertContext.currentTime;for(const [index,note] of [880,660,880].entries()){const oscillator=alertContext.createOscillator(),gain=alertContext.createGain();oscillator.frequency.value=note;gain.gain.setValueAtTime(.14,now+index*.2);gain.gain.exponentialRampToValueAtTime(.001,now+index*.2+.18);oscillator.connect(gain);gain.connect(alertContext.destination);oscillator.start(now+index*.2);oscillator.stop(now+index*.2+.2);}}catch{}}
function renderClaims(claims){const pending=claims.filter(claim=>claim.status==='PENDING'),current=new Set(claims.map(claim=>claim.id));if(knownClaims&&pending.some(claim=>!knownClaims.has(claim.id)))claimSound();knownClaims=current;pendingClaim=pending[0]||null;
 $('#claim-banner').hidden=!pendingClaim;$('#claim-message').textContent=pendingClaim?'Claim from '+pendingClaim.name+' · '+pendingClaim.category_name+(pending.length>1?' (+'+(pending.length-1)+' more)':'')+(display.game.status==='PAUSED'?' · Game paused':''):'';$('#claim-review').hidden=!!display.review;
 for(const claim of claims){const item=el('div','','item');item.append(el('strong',claim.name+' · '+claim.category_name+' · '+claim.status+' · call #'+claim.first_eligible_sequence),ticketGrid(claim.grid));if(claim.status==='PENDING'&&!display.review)item.append(button('Review claim',()=>act('/admin/claims/'+claim.id+'/review'),'secondary small-button'));$('#claims').append(item);}
 const review=display.review;$('#review-panel').hidden=!review;if(review){$('#review-title').textContent=review.name+' · '+review.category_name+' · T-'+String(review.ticket_number).padStart(4,'0');$('#review-grid').replaceChildren(...ticketGrid(review.grid).children);$('#review-help').textContent='Called numbers are marked. The earliest qualifying ticket wins; other requests or a tie-break keep play paused.';$('#review-confirm').textContent=review.resume_after?'Confirm and resume':'Confirm prize (stay paused)';$('#review-confirm').disabled=display.game.emergencyStopped;}
 $('#auto-eligible').textContent=display.eligibility.length?'Automatically qualified · '+display.eligibility.map(item=>item.category_name+': '+item.name).join(' / '):'';
}
function refresh(){if(refreshPromise){queued=true;return refreshPromise;}refreshPromise=(async()=>{do{queued=false;await refreshOnce();}while(queued);})().finally(()=>{refreshPromise=null;});return refreshPromise;}
async function refreshOnce(){try{
 const started=performance.now();display=await req('/display');const received=performance.now();serverClock=Date.parse(display.serverTime)+(received-started)/2;clockAt=received;controls();
 if(!keyBox.value){say('Enter your admin key to unlock controls.');return;}
 const data=await Promise.all([req('/admin/players'),req('/admin/power-requests'),req('/categories'),req('/admin/claims'),req('/admin/eligible-winners'),req('/admin/audit'),req('/admin/ticket-conflicts')]);
 players=data[0];categories=data[2].map(c=>({...c,status:display.categories.find(x=>x.id===c.id)?.status}));renderPlayers();renderCategories();
 $('#conflicts').textContent=data[6].length?'Conflicting tickets found: '+data[6].map(c=>c.tickets.join(', ')).join('; ')+'. Reissue before play.':'';
 for(const target of ['#power-requests','#claims','#eligible','#rounds','#winners','#audit'])$(target).replaceChildren();
 const pendingPowers=data[1].filter(power=>power.status==='PENDING'),powerIds=new Set(data[1].map(power=>power.id));if(knownPowers&&pendingPowers.some(power=>!knownPowers.has(power.id)))claimSound();knownPowers=powerIds;$('#power-banner').hidden=!pendingPowers.length;$('#power-message').textContent=pendingPowers.length?'Lucky Strike from '+pendingPowers[0].playerName+' · '+pendingPowers[0].number+(pendingPowers.length>1?' (+'+(pendingPowers.length-1)+' more)':'')+(display.game.status==='PAUSED'?' · Game paused':''):'';
 for(const power of data[1])line($('#power-requests'),power.playerName+' · '+power.number+' · '+power.status,power.status==='PENDING'?[
 {label:'Approve & call',run:async()=>{if(confirm('Call '+power.number+' for '+power.playerName+'?'))await act('/admin/power-requests/'+power.id+'/approve');}},
 {label:'Reject',run:()=>act('/admin/power-requests/'+power.id+'/reject')}]:[]);
 renderClaims(data[3]);
 for(const eligible of data[4])line($('#eligible'),eligible.name+' · '+eligible.category_name+' · call #'+eligible.first_eligible_sequence);
 for(const winner of display.winners)line($('#winners'),winner.category_name+' · '+winner.name);
 for(const round of display.suddenDeath){const category=categories.find(c=>c.id===round.category_id);if(category)line($('#rounds'),round.category_name+' · '+round.status+' · '+round.draw_sequence+' draws',round.status==='RESOLVED'?[]:[{label:round.status==='RUNNING'?'Pause':'Start / resume',run:()=>act('/admin/categories/'+category.id+'/sudden-death/'+(round.status==='RUNNING'?'pause':'start'))}]);}
 for(const event of data[5]){const detail=event.details;const description=event.action==='GAME_UPDATED'?(detail.stopped?'Play stopped':detail.to+' · '+detail.intervalSeconds+' seconds between calls'):(players.find(p=>p.id===detail.playerId)?.name||'Player');line($('#audit'),new Date(event.created_at).toLocaleTimeString()+' · '+event.action.replaceAll('_',' ').toLowerCase()+' · '+description);}
 for(const target of ['#power-requests','#claims','#eligible','#rounds','#winners','#audit'])if(!$(target).children.length)empty($(target),'Nothing here yet.');
 }catch(error){say(error.message);}}
async function loadGames(){const games=await request('/games'),select=$('#switch-game');select.replaceChildren();for(const game of games){const option=el('option',game.name+' · '+game.joinCode+' · '+game.status);option.value=game.id;option.selected=game.id===id;select.append(option);}}
$('#switch-game').onchange=()=>location.href='/admin/'+encodeURIComponent($('#switch-game').value);
$('#load').onclick=()=>run($('#load'),async()=>{await loadGames();await refresh();});$('#player-search').oninput=renderPlayers;
for(const action of ['start','pause','resume'])$('#'+action).onclick=()=>run($('#'+action),()=>act('/'+action));
$('#stop').onclick=()=>run($('#stop'),()=>act('/admin/stop'));$('#release').onclick=()=>run($('#release'),()=>act('/admin/release-stop'));
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
$('#power-review').onclick=()=>{$('#powers-panel').open=true;$('#powers-panel').scrollIntoView({behavior:'smooth',block:'start'});};
$('#review-confirm').onclick=()=>run($('#review-confirm'),async()=>{const result=await req('/admin/claims/'+display.review.claim_id+'/confirm','POST');await refresh();say(result.outcome?.status==='SUDDEN_DEATH_PENDING'?'Tie-break required; the main game remains paused.':result.resumed?'Prize confirmed; game resumed.':'Prize confirmed; game remains paused.');});
$('#review-cancel').onclick=()=>run($('#review-cancel'),()=>act('/admin/claims/'+display.review.claim_id+'/cancel'));
$('#enable-alerts').onclick=()=>{try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){say('Claim sounds are unavailable in this browser.');return;}alertContext??=new Audio();alertEnabled=true;alertContext.resume().then(()=>{claimSound();$('#enable-alerts').textContent='Claim sound enabled';}).catch(()=>say('Click again to enable claim sound.'));}catch{say('Claim sounds are unavailable in this browser.');}};
if(keyBox.value)loadGames().catch(error=>say(error.message));refresh();setInterval(refresh,5000);setInterval(clock,300);window.addEventListener('tambola:changed',refresh);
`,'',['/print/client.js']);
}
