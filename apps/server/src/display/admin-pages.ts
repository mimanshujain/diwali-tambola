import { html, adminSidebar } from './theme.js';
import { RULE_LABELS } from '../winners/domain/rules.js';

const helpers=String.raw`
const $=s=>document.querySelector(s);
const keyBox=$('#key');keyBox.value=sessionStorage.getItem('tambola-admin-key')||'';
keyBox.oninput=()=>sessionStorage.setItem('tambola-admin-key',keyBox.value);
function say(message){$('#message').textContent=message||'';}
function el(tag,text,className){const node=document.createElement(tag);node.textContent=text??'';if(className)node.className=className;return node;}
function button(label,action,className='ghost small-button'){const node=el('button',label,className);node.type='button';node.onclick=()=>run(node,action);return node;}
async function request(path,method='GET',body){
 const response=await fetch(path,{method,cache:'no-store',headers:{'content-type':'application/json','x-admin-key':keyBox.value},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(Array.isArray(data.message)?data.message.join(', '):data.message||'Request failed ('+response.status+')');return data;
}
async function run(button,action){button.disabled=true;try{await action();}catch(error){say(error.message);}finally{button.disabled=false;if(typeof controls==='function'&&display)controls();}}
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
 <div class="admin-shell">${adminSidebar}<main class="wrap stack" style="width:100%">
 <header class="topbar"><div><div class="eyebrow"><a href="/admin">Host desk</a> / Game console</div><h1 id="name">Loading game…</h1><div class="row"><span id="status" class="pill">—</span><span id="game-code" class="code"></span></div></div><label>Switch game<select id="switch-game" aria-label="Switch game"><option>Loading…</option></select></label></header>
 <div class="panel auth"><label>Admin key<input id="key" type="password" autocomplete="off" placeholder="Your private host key"></label><button id="load">Unlock controls</button></div>
 <p id="message" role="status" class="notice"></p><p id="recovery-notice" class="notice"></p>
 <section id="controls" class="panel controls"><div class="row between"><div><div class="eyebrow">Latest call</div><div id="latest" class="status-number">—</div></div><div><div class="eyebrow">Next call in</div><div id="timer" class="clock">—</div></div><button id="stop" class="kill">■ Emergency stop</button></div>
 <div class="row"><button id="start">Start game</button><button id="pause" class="ghost">Pause</button><button id="resume" class="secondary">Resume</button><button id="release" class="red" hidden>Release stop</button><button id="next" class="secondary">Call next now →</button><span id="progress" class="small"></span></div>
 <div class="toolbar"><div class="row"><button id="add-time" class="ghost">+30 seconds</button><button id="reset-time" class="ghost">Reset countdown</button><label style="margin:0;max-width:180px">Call interval (seconds)<input id="interval" type="number" value="30" min="10" max="86400"></label><button id="save-interval" class="ghost">Set interval & reset</button></div></div>
 <details><summary>Manual call & ending the game</summary><div class="row"><input id="manual" aria-label="Manual number" placeholder="1–90" type="number" min="1" max="90" style="width:110px"><button id="manualBtn" class="ghost">Call this number</button><button id="end" class="red">End game…</button></div><p class="small">Emergency stop freezes all draws, including tie-breaks. End game closes play permanently and retains its records.</p></details></section>
 <div class="admin-grid">
 <details id="players-panel" class="panel" open><summary>Players & tickets <span id="players-count" class="count"></span></summary><div class="section-body"><div class="row"><input id="player-search" type="search" placeholder="Find a player" aria-label="Find a player" style="flex:1"><button id="print-all" class="ghost">Print 4 × 6</button></div><p id="conflicts" class="notice"></p><div id="players" class="list"></div></div></details>
 <details id="prizes-panel" class="panel" open><summary>Prize categories <span id="categories-count" class="count"></span></summary><div class="section-body"><div id="categories" class="list"></div><details><summary>Add a prize</summary><form id="category-form"><label>Name<input id="category-name" maxlength="80" required placeholder="Diwali Early Seven"></label><label>Winning rule<select id="category-rule">${rules}</select></label><label>Prize or description<input id="category-prize" maxlength="200" placeholder="Gift hamper"></label><label>Ties<select id="category-policy"><option value="SHARED_PRIZE">Share the prize</option><option value="SUDDEN_DEATH">Sudden-death round</option></select></label><button id="add-category">Add category</button></form></details><p class="small">Set up and edit prizes before starting. Any Two Lines requires two complete rows. All Odd / All Even requires every matching number on the ticket.</p></div></details>
 <details id="claims-panel" class="panel" open><summary>Claims & eligible tickets</summary><div class="section-body"><div id="claims" class="list"></div><h3>Qualified tickets</h3><div id="eligible" class="list"></div></div></details>
 <details id="powers-panel" class="panel"><summary>Lucky Strike requests</summary><div class="section-body"><div id="power-requests" class="list"></div></div></details>
 <details id="rounds-panel" class="panel"><summary>Sudden-death rounds</summary><div class="section-body"><div id="rounds" class="list"></div></div></details>
 <details id="winners-panel" class="panel" open><summary>Declared winners</summary><div class="section-body"><div id="winners" class="list"></div></div></details>
 <details id="access-panel" class="panel"><summary>TV display & guest access</summary><div class="section-body"><div class="row"><img id="tvQr" class="qr" alt="QR code to open the TV display"><div style="min-width:0;flex:1"><h3>Open the TV display</h3><a id="tvUrl" target="_blank" style="overflow-wrap:anywhere">Loading…</a><p class="small">Scan with your phone on the same Wi-Fi as the Pi.</p><div class="row"><a id="tvLink" class="button ghost" target="_blank">Open TV</a><a id="joinLink" class="button ghost" target="_blank">Guest join link</a></div></div></div></div></details>
 <details id="audit-panel" class="panel"><summary>Activity & recovery</summary><div class="section-body"><p class="small">Game state is saved in PostgreSQL. After an API restart, running games resume here as paused. Review the last call before resuming. Use the supplied backup scripts to protect against storage failure.</p><div id="audit" class="list"></div></div></details>
 </div></main></div>`,helpers+String.raw`
const id=location.pathname.split('/').filter(Boolean).pop(),root='/games/'+encodeURIComponent(id);
let display=null,players=[],categories=[],refreshing=false,queued=false,intervalLoaded=false;
const req=(path,method='GET',body)=>request(root+path,method,body);
$('#tvQr').src='/admin/'+encodeURIComponent(id)+'/tv-qr.svg';
for(const details of document.querySelectorAll('details.panel')){const key='tambola-panel-'+details.id;const saved=localStorage.getItem(key);if(saved!==null)details.open=saved==='open';details.addEventListener('toggle',()=>localStorage.setItem(key,details.open?'open':'closed'));}
async function act(path,body){await req(path,'POST',body);say('Saved.');await refresh();}
function line(container,label,actions=[]){const item=el('div',label,'item');const row=el('div','','row');for(const action of actions)row.append(button(action.label,action.run,action.className));if(actions.length)item.append(row);container.append(item);}
function renderPlayers(){const list=$('#players');list.replaceChildren();const before=display?.game.status==='CREATED';
 for(const player of players.filter(p=>p.name.toLowerCase().includes($('#player-search').value.toLowerCase()))){
  const actions=[];
  if(!player.approved&&player.ticketId&&before)actions.push({label:'Approve identity',className:'secondary small-button',run:()=>act('/admin/players/'+player.id+'/approve')});
  if(player.ticketStatus==='SUBMITTED')actions.push({label:'Print 4 × 6',run:()=>window.printTambolaTickets(id,keyBox.value,player.id)});
  if(before){actions.push({label:'Reissue ticket',run:async()=>{const reason=prompt('Reason for issuing a new ticket? The old ticket becomes invalid.');if(reason)await act('/admin/players/'+player.id+'/reissue',{reason});}});if(player.ticketId)actions.push({label:'Remove from game',run:async()=>{if(confirm('Remove '+player.name+' and revoke their ticket?'))await act('/admin/players/'+player.id+'/withdraw');}});}
  actions.push({label:'Reset access',run:async()=>{if(!confirm('Reset access for '+player.name+'? Verify the person before sharing the new recovery code.'))return;const result=await req('/admin/players/'+player.id+'/reset-access','POST');prompt('Give this recovery code privately to '+player.name+'. Their ticket is saved.',result.recoveryCode);await refresh();}});
  line(list,player.name+' · '+(player.ticketNumber?'T-'+String(player.ticketNumber).padStart(4,'0'):'Withdrawn')+' · '+(!player.approved&&player.ticketId?'Awaiting host approval':player.ticketStatus||'No active ticket'),actions);
 }if(!list.children.length)empty(list,'No matching players.');$('#players-count').textContent=players.filter(p=>p.ticketId).length+' active · '+players.filter(p=>p.ticketStatus==='SUBMITTED').length+' submitted';
}
function renderCategories(){const list=$('#categories');list.replaceChildren();const before=display.game.status==='CREATED';
 for(const category of categories){const actions=[];
  if(before){actions.push({label:category.active?'Disable':'Enable',run:async()=>{await req('/admin/categories/'+category.id,'PATCH',{active:!category.active});await refresh();}});
   actions.push({label:'Edit name / prize',run:async()=>{const name=prompt('Category name',category.name);if(name===null)return;const prizeDescription=prompt('Prize or description',category.prize_description||'');if(prizeDescription===null)return;await req('/admin/categories/'+category.id,'PATCH',{name,prizeDescription});await refresh();}});
   actions.push({label:category.tie_break_policy==='SHARED_PRIZE'?'Use tie-break':'Share ties',run:async()=>{await req('/admin/categories/'+category.id,'PATCH',{tieBreakPolicy:category.tie_break_policy==='SHARED_PRIZE'?'SUDDEN_DEATH':'SHARED_PRIZE'});await refresh();}});
  }else if(category.active&&!category.status){actions.push({label:'Resolve prize',className:'secondary small-button',run:async()=>{if(confirm('Declare the outcome for '+category.name+'?'))await act('/admin/categories/'+category.id+'/resolve');}});}
  line(list,category.name+' · '+(category.active?(category.status||'OPEN'):'Disabled')+(category.prize_description?' · '+category.prize_description:''),actions);
 }$('#categories-count').textContent=categories.filter(c=>c.active).length+' active';$('#add-category').disabled=!before;
}
function controls(){const game=display.game,stopped=game.emergencyStopped,ended=game.status==='COMPLETED';
 $('#start').disabled=game.status!=='CREATED'||stopped||display.players.some(p=>!p.submitted);$('#pause').disabled=game.status!=='RUNNING';$('#resume').disabled=game.status!=='PAUSED'||stopped;
 $('#next').disabled=game.status!=='RUNNING'||stopped;$('#manualBtn').disabled=$('#next').disabled;
 $('#release').hidden=!stopped||game.endedByAdmin;$('#end').disabled=game.endedByAdmin;$('#stop').disabled=stopped;
 for(const selector of ['#add-time','#reset-time','#save-interval'])$(selector).disabled=ended||stopped;
 $('#recovery-notice').textContent=game.endedByAdmin?'Game ended by host. Records are retained.':stopped?'EMERGENCY STOP · All draws are frozen. Release the stop, then resume the required game or tie-break.':game.recoveredAt?'Recovered after restart. Check the last number and resume when everyone is ready.':'';
 $('#status').textContent=stopped?'STOPPED':game.status;$('#game-code').textContent=game.joinCode;$('#name').textContent=game.name;
 $('#latest').textContent=display.calls.at(-1)?.number??'—';$('#progress').textContent=game.status==='CREATED'?display.players.filter(p=>p.submitted).length+' / '+display.players.length+' tickets submitted':display.calls.length+' of 90 called';
 if(!intervalLoaded){$('#interval').value=game.intervalSeconds;intervalLoaded=true;}
 const tvUrl=location.origin+'/tv/'+encodeURIComponent(game.joinCode);$('#tvLink').href=tvUrl;$('#tvUrl').href=tvUrl;$('#tvUrl').textContent=tvUrl;
 $('#joinLink').href=(display.guestOrigin||location.origin)+'/g/'+encodeURIComponent(game.joinCode);clock();
}
function secondsLeft(){const game=display?.game;return game?.nextCallAt?Math.max(0,Math.ceil((new Date(game.nextCallAt)-Date.now())/1000)):game?.pausedRemainingSeconds??game?.intervalSeconds??0;}
function clock(){if(!display)return;const seconds=secondsLeft();$('#timer').textContent=display.game.status==='COMPLETED'?'Ended':String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
async function refresh(){if(refreshing){queued=true;return;}refreshing=true;try{
 display=await req('/display');controls();
 if(!keyBox.value){say('Enter your admin key to unlock controls.');return;}
 const data=await Promise.all([req('/admin/players'),req('/admin/power-requests'),req('/categories'),req('/admin/claims'),req('/admin/eligible-winners'),req('/admin/audit'),req('/admin/ticket-conflicts')]);
 players=data[0];categories=data[2].map(c=>({...c,status:display.categories.find(x=>x.id===c.id)?.status}));renderPlayers();renderCategories();
 $('#conflicts').textContent=data[6].length?'Conflicting tickets found: '+data[6].map(c=>c.tickets.join(', ')).join('; ')+'. Reissue before play.':'';
 for(const target of ['#power-requests','#claims','#eligible','#rounds','#winners','#audit'])$(target).replaceChildren();
 for(const power of data[1])line($('#power-requests'),power.playerName+' · '+power.number+' · '+power.status,power.status==='PENDING'?[
 {label:'Approve & call',run:async()=>{if(confirm('Call '+power.number+' for '+power.playerName+'?'))await act('/admin/power-requests/'+power.id+'/approve');}},
 {label:'Reject',run:()=>act('/admin/power-requests/'+power.id+'/reject')}]:[]);
 for(const claim of data[3])line($('#claims'),claim.name+' · '+claim.status+' · call #'+claim.first_eligible_sequence);
 for(const eligible of data[4])line($('#eligible'),eligible.name+' · '+eligible.category_name+' · call #'+eligible.first_eligible_sequence);
 for(const winner of display.winners)line($('#winners'),winner.category_name+' · '+winner.name);
 for(const round of display.suddenDeath){const category=categories.find(c=>c.id===round.category_id);if(category)line($('#rounds'),round.category_name+' · '+round.status+' · '+round.draw_sequence+' draws',round.status==='RESOLVED'?[]:[{label:round.status==='RUNNING'?'Pause':'Start / resume',run:()=>act('/admin/categories/'+category.id+'/sudden-death/'+(round.status==='RUNNING'?'pause':'start'))}]);}
 for(const event of data[5]){const detail=event.details;const description=event.action==='GAME_UPDATED'?(detail.stopped?'Play stopped':detail.to+' · '+detail.intervalSeconds+' seconds between calls'):(players.find(p=>p.id===detail.playerId)?.name||'Player');line($('#audit'),new Date(event.created_at).toLocaleTimeString()+' · '+event.action.replaceAll('_',' ').toLowerCase()+' · '+description);}
 for(const target of ['#power-requests','#claims','#eligible','#rounds','#winners','#audit'])if(!$(target).children.length)empty($(target),'Nothing here yet.');
 }catch(error){say(error.message);}finally{refreshing=false;if(queued){queued=false;void refresh();}}}
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
$('#print-all').onclick=()=>run($('#print-all'),()=>window.printTambolaTickets(id,keyBox.value));
if(keyBox.value)loadGames().catch(error=>say(error.message));refresh();setInterval(refresh,15000);setInterval(clock,300);window.addEventListener('tambola:changed',refresh);
`,'',['/print/client.js']);
}
