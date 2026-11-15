import { renderTicket, earlyFiveAt, practiceCalls, starterPrizes, playerSteps } from './game-guide.js';
import { renderVideoPreview, videoPreviewCss, videoPreviewJs } from './video-preview.js';

const styles = `
:root{color-scheme:light;--paper:#fbf5e9;--ink:#291d29;--muted:#64545f;--border:#dfd0bf;--gold:#f4bd66;--plum:#42293f;--accent:#653052;--green:#166049;--mint:#a6eed3;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-size:16px;line-height:1.5}
a{color:#63294e;text-underline-offset:.23em}
:focus-visible{outline:3px solid #1b765b;outline-offset:3px}
[hidden]{display:none!important}
h1,h2,h3,p{margin:0}
h1,h2{font-family:"DM Serif Text",Georgia,serif;font-weight:500;line-height:1.08;letter-spacing:-.025em}
h1{font-size:clamp(2.6rem,6.2vw,5.5rem);max-width:12ch}
h2{font-size:clamp(1.65rem,3.7vw,2.7rem)}
h3{font-size:1.03rem}
p,li{overflow-wrap:anywhere}
button,input{font:inherit}
.wrap{width:min(calc(100% - 32px),1160px);margin-inline:auto}
.site-nav{display:flex;align-items:center;justify-content:space-between;gap:.6rem 1rem;flex-wrap:wrap;padding:1.2rem 0;border-bottom:1px solid var(--border)}
.site-nav nav,.actions,.inline{display:flex;align-items:center;flex-wrap:wrap;gap:.55rem 1rem}
.site-nav nav a{font-size:.9rem}
.brand{text-decoration:none;color:var(--ink);font-weight:850;display:inline-flex;align-items:center;gap:8px}
.brand strong{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;color:var(--plum);background:var(--gold)}
.site-footer{border-top:1px solid var(--border);padding:1.15rem 0 1.8rem;margin-top:3rem;font-size:.9rem}
.hero{display:grid;grid-template-columns:1.05fr .95fr;align-items:center;gap:clamp(20px,5vw,72px);padding:clamp(28px,6vw,82px) 0}
.hero-copy,.stack{display:grid;gap:1rem;align-content:start}
.lead{font-size:clamp(1.02rem,2vw,1.21rem);color:var(--muted);max-width:48ch}
.button{display:inline-flex;justify-content:center;align-items:center;gap:.35rem;min-height:44px;padding:.65rem 1rem;border:1px solid var(--plum);border-radius:8px;background:var(--plum);color:white;text-decoration:none;font-weight:720;cursor:pointer}
.button:hover{background:#5c3555}
.button.secondary{background:transparent;color:var(--plum);border-color:#9f828f}
.button.secondary:hover{background:#f4eadf}
.button:disabled{opacity:.55;cursor:default}
.panel{border:1px solid var(--border);border-radius:14px;padding:clamp(.85rem,2.5vw,1.5rem);background:#fffaf2;min-width:0}
.home-grid,.practice-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
.home-grid h2{font-size:clamp(1.55rem,3vw,2rem)}
.home-grid p{color:var(--muted)}
.join-form{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:.6rem;max-width:440px}
label{display:grid;gap:.25rem;font-weight:650;font-size:.9rem}
input{border:1px solid #987c88;border-radius:8px;min-height:44px;background:#fffdf9;color:var(--ink);padding:.54rem .7rem;width:100%;min-width:0}
#code{text-transform:uppercase;letter-spacing:.1em}
.caption{font-size:.86rem;color:var(--muted)}
.kicker{font-size:.8rem;font-weight:750;letter-spacing:.045em;color:var(--accent)}
.learn-ticket{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:clamp(2px,.8vw,5px);font-variant-numeric:tabular-nums}
.learn-cell{display:grid;place-items:center;min-width:0;aspect-ratio:1.1;border:1px solid #ddcabc;border-radius:4px;background:#fffdf8;color:#38273b;font-weight:750;font-size:clamp(.65rem,2.9vw,1.13rem)}
.learn-cell.blank{background:#ede3d7;border-color:transparent}
.learn-cell.matched{background:var(--mint);border-color:#45a689;color:#123b2d;font-weight:850}
.learn-cell.current{border:2px solid #1e654f}
.page-heading{padding:clamp(22px,5vw,45px) 0 18px;display:grid;gap:.65rem}
.page-heading h1{font-size:clamp(2.2rem,5.5vw,4rem);max-width:22ch}
.practice-board{background:#322137;color:#fff1e4;border-color:#654b64}
.practice-board .caption{color:#edd6dc}
.demo-number{color:var(--gold);font-size:clamp(2.7rem,8vw,4.7rem);line-height:1.04;font-weight:800;font-variant-numeric:tabular-nums;font-family:Georgia,serif}
.call-history{display:flex;gap:6px;flex-wrap:wrap;margin:0;padding:0;list-style:none}
.call-history li{display:grid;place-items:center;padding:.16rem .4rem;min-width:1.9rem;font-size:.86rem;border:1px solid #8c7389;border-radius:5px}
.call-history li:last-child{background:var(--gold);color:var(--ink);border-color:var(--gold)}
.practice-panel{margin-top:18px}
.practice-panel h2,.rules-grid h2{font-size:1.45rem}
.practice-controls{margin:16px 0;min-height:48px}
.instructions{display:grid;gap:.4rem;margin:0;padding-left:1.35rem}
.rules-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px}
.rules-grid .panel{padding:clamp(.6rem,1.2vw,.95rem)}
.rules-grid .learn-cell{font-size:clamp(.65rem,1.45vw,.98rem)}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
@media(max-width:760px){
 .hero,.rules-grid{grid-template-columns:minmax(0,1fr)}
 .hero{padding:28px 0;gap:20px}.hero-copy{gap:.75rem}
 .rules-grid{max-width:560px}.rules-grid .learn-cell{font-size:clamp(.65rem,3.5vw,1rem)}
}
@media(max-width:520px){
 .home-grid,.practice-grid{grid-template-columns:minmax(0,1fr)}
 .site-nav{padding:.85rem 0}
 .site-nav nav{gap:.5rem .8rem}
 .site-nav nav a{font-size:.84rem}
 .practice-panel{margin-top:9px}.practice-board{gap:.6rem}
 .practice-board .demo-number{font-size:2.4rem}
 .practice-board .live-label{display:flex;align-items:center;justify-content:space-between;gap:.65rem}
}
@media(max-width:340px){.join-form{grid-template-columns:minmax(0,1fr)}}
`;

function escapeAttribute(value: string): string {
  return value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

function publicPage(title: string, description: string, body: string, options: {cloud: boolean; script?: string}): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} · Tambola</title><meta name="description" content="${description}"><meta property="og:title" content="${title} · Tambola">
  <meta property="og:description" content="${description}"><style>${styles}${videoPreviewCss}</style></head><body>
  <header class="site-nav wrap"><a href="${options.cloud ? '/' : '/how-to-play'}" class="brand"><strong aria-hidden="true">✦</strong>Tambola</a>
  <nav aria-label="Site navigation"><a href="/how-to-play">How to play</a>${options.cloud?'<a href="/#join">Join a game</a><a href="/admin">Host sign in</a>':'<a href="/practice">Practice round</a>'}</nav></header>
  <main class="wrap">${body}</main>
  <footer class="site-footer wrap"><div class="inline"><a href="/how-to-play">Game rules</a><a href="/practice">Practice round</a>${options.cloud?'<a href="/screen">Connect a TV</a>':''}</div></footer>
  ${options.script?`<script>${options.script}</script>`:''}</body></html>`;
}

function hostRequestUrl(): string | undefined {
  try {
    const url = new URL(process.env.HOST_ACCESS_REQUEST_URL?.trim() ?? '');
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* Hosting invitations remain available through the existing flow. */ }
  return undefined;
}

const joinScript = String.raw`
const form=document.getElementById('join');
form.addEventListener('submit',event=>{
 event.preventDefault();
 const code=document.getElementById('code').value.trim().toUpperCase();
 location.href='/g/'+encodeURIComponent(code);
});

`;

export function renderLaunchPage(): string {
  const requestLabel = hostRequestUrl() ? 'Request host access' : 'How to host';

  return publicPage('Host Tambola on your TV','A live Tambola and Housie game for parties. Try a practice round, then invite guests to scan a QR code and play on their phones.',`
  <section class="hero">
   <div class="hero-copy"><h1>Host Tambola on your TV.</h1><p class="lead">Guests scan a QR code and play on their phones. Tambola, also called Housie, is a 90-ball bingo-style game for birthdays, Diwali, and nights with friends.</p>
    <div class="actions"><a class="button" href="/practice">Try a practice round</a><a class="button secondary" href="/host">${requestLabel}</a></div>
   </div>
   ${renderVideoPreview({
     id:'gameplay',file:'overview-v1',title:'Tambola gameplay video',watchLabel:'Watch gameplay',seconds:25,
     transcript:'A guest scans the TV QR, enters their name, and gets a ticket. Numbers called on the TV highlight matches on the phone. At five matches the host checks and confirms Early Five.',
   })}
  </section>
  <div class="home-grid">
   <section class="panel stack"><h2>Join a game</h2><p>Use the six-character game code on your host’s TV or invitation. Joining is account-free.</p>
    <form class="join-form" id="join"><label>Game code<input id="code" maxlength="6" minlength="6" pattern="[A-HJ-NP-Za-hj-np-z2-9]{6}" title="Enter the six-character game code" required autocapitalize="characters" autocomplete="off" placeholder="ABC234"></label><button class="button">Join game</button></form>
   </section>
   <section class="panel stack"><h2>Winning patterns</h2><p>See which numbers need to match for Early Five, Top Line, and Full House.</p><div class="actions"><a href="/how-to-play">Read the rules and see winning tickets</a></div></section>
  </div>`,{cloud:true,script:joinScript+videoPreviewJs});
}

export function renderHostInvitationPage(): string {
  const request = hostRequestUrl();
  return publicPage('Host your own Tambola','See what you need to run a Tambola party and request pilot host access.',`
  <header class="page-heading"><h1>Host your own Tambola</h1><p class="lead">Run the game from your phone. Guests scan the shared screen to get a ticket.</p></header>
  <div class="home-grid"><section class="panel stack"><h2>Get host access</h2><p>Hosted games are available by invitation. Sign in with the Google account on your invitation. Tambola stores your account ID, name, and email to manage your games.</p>
    <div class="actions">${request?`<a class="button" href="${escapeAttribute(request)}">Request host access</a><a href="/admin">Already invited? Sign in</a>`:'<a class="button" href="/admin">Sign in with a host invitation</a><a href="/practice">Try a practice round</a>'}</div>
  </section><section class="panel stack"><h2>Before the party</h2><ol class="instructions"><li>Set your prizes and how often to call a number.</li><li>Open the board on a TV or laptop and test its sound.</li><li>Send the guest link, then approve each guest as they join.</li></ol><a href="/how-to-play">Share the rules with your guests</a></section></div>`,{cloud:true});
}

export function renderRulesPage(cloud: boolean): string {
  const patterns = starterPrizes.map(prize=>`<article class="panel stack"><h2>${prize.label}</h2><p>${prize.help}</p>${renderTicket(prize.numbers,prize.label+' example ticket')}</article>`).join('');
  return publicPage('How to play Tambola and Housie','Learn to join a Tambola game, read your ticket, and recognize Early Five, Top Line, and Full House.',`
  <header class="page-heading"><h1>How to play Tambola</h1><p class="lead">Each ticket has 15 numbers. The game calls numbers from 1 to 90, one at a time. Match the right numbers to win a prize.</p><div class="actions"><a class="button" href="/practice">Try a practice round</a></div></header>
  <section class="panel stack" aria-labelledby="player-steps"><h2 id="player-steps">Playing on your phone</h2><ol class="instructions">${playerSteps.map(step=>'<li>'+step+'</li>').join('')}</ol><p>The host chooses which prizes are active. Tambola spots qualifying tickets as the numbers are called. Use <strong>Claim</strong> to alert the host for review. The host confirms the result.</p></section>
  <section class="rules-grid" aria-label="Example winning patterns">${patterns}</section>
  <section class="panel stack practice-panel"><h2>Joining after the first call</h2><p>Ask the host to approve you. Your ticket becomes eligible for prizes from the next call after approval.</p></section>`,{cloud});
}

const practiceScript = String.raw`
(function(){
 const calls=${JSON.stringify(practiceCalls)},winningCall=${JSON.stringify(earlyFiveAt)};
 const get=id=>document.getElementById(id);
 const call=get('practice-next'),review=get('practice-review'),confirm=get('practice-confirm'),reset=get('practice-reset');
 const status=get('practice-status'),latest=get('practice-latest'),history=get('practice-history'),count=get('practice-matches');
 const cells=new Map(Array.from(document.querySelectorAll('#practice-ticket [data-number]'),cell=>[Number(cell.dataset.number),cell]));
 const matched=new Set();
 let index=0;
 function draw(){
  const number=calls[index++];
  const entry=document.createElement('li');
  entry.textContent=String(number);
  history.append(entry);
  latest.textContent=String(number);
  cells.forEach(cell=>cell.classList.remove('current'));
  const cell=cells.get(number);
  if(cell){
   cell.classList.add('matched','current');
   cell.setAttribute('aria-label',number+' matched');
   matched.add(number);
  }
  count.textContent=matched.size+' / 5 matches';
  const won=index===winningCall;
  status.textContent=won?'You matched five numbers. This ticket qualifies for Early Five!':cell?number+' is on the ticket. '+matched.size+' of five matches.':number+' is not on this ticket. Call another number.';
  if(won){call.hidden=true;review.hidden=false;review.focus();}
 }
 call.addEventListener('click',draw);
 review.addEventListener('click',()=>{
  review.hidden=true;get('practice-check').hidden=false;confirm.focus();
  status.textContent='The host checks the five matched numbers before awarding Early Five.';
 });
 confirm.addEventListener('click',()=>{
  get('practice-check').hidden=true;get('practice-complete').hidden=false;
  status.hidden=true;
  get('practice-complete').focus();
 });
 reset.addEventListener('click',()=>{
  index=0;matched.clear();history.replaceChildren();latest.textContent='—';count.textContent='0 / 5 matches';
  cells.forEach(cell=>{cell.classList.remove('matched','current');cell.removeAttribute('aria-label');});
  review.hidden=true;get('practice-check').hidden=true;get('practice-complete').hidden=true;call.hidden=false;
  status.hidden=false;status.textContent='Call a number to see whether it’s on this ticket.';call.focus();
 });
})();
`;

export function renderPracticePage(cloud: boolean): string {
  return publicPage('Practice round','Learn Tambola with a sample ticket. Call six numbers and see how a host confirms an Early Five win.',`
  <header class="page-heading"><h1>Try a practice round</h1><p class="lead">You’re both the caller and the player in this sample game. Match any five numbers to qualify for Early Five.</p></header>
  <div class="practice-grid">
   <section class="panel stack practice-board" aria-labelledby="practice-board-heading">
    <div class="live-label"><h2 id="practice-board-heading">Last number called</h2><div class="demo-number" id="practice-latest">—</div></div>
    <ul class="call-history" id="practice-history" aria-label="Numbers called"></ul>
   </section>
   <section id="practice-ticket" class="panel stack" aria-labelledby="practice-ticket-heading">
    <div class="inline"><h2 id="practice-ticket-heading">Your sample ticket</h2><span id="practice-matches" class="caption">0 / 5 matches</span></div>
    ${renderTicket([],'Your sample ticket')}
   </section>
  </div>
  <div class="actions practice-controls">
   <button type="button" class="button" id="practice-next">Call next number</button>
   <button type="button" class="button" id="practice-review" hidden>Review the prize</button>
   <button type="button" class="button secondary" id="practice-reset">Restart practice</button>
  </div>
  <p id="practice-status" role="status">Call a number to see whether it’s on this ticket.</p>
  <section id="practice-check" class="panel stack practice-panel" hidden><h2>Host prize review</h2><p>Tambola found five matching numbers. The host checks the ticket and confirms Early Five. In a real game, tapping Claim also alerts the host.</p><div><button class="button" type="button" id="practice-confirm">Confirm practice winner</button></div></section>
  <section id="practice-complete" class="panel stack practice-panel" tabindex="-1" hidden><h2>You won Early Five</h2><div class="actions">${cloud?'<a class="button" href="/host">Host your own game</a>':''}<a href="/how-to-play">See more winning patterns</a></div></section>`,{cloud,script:practiceScript});
}
