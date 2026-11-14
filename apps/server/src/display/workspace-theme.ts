export const workspaceCss = String.raw`
.workspace {
  --workspace-top: 66px;
  --surface: var(--occasion-panel);
  --soft-line: var(--occasion-line);
  --accent-tint: color-mix(in srgb, var(--gold) 10%, var(--occasion-background));
  --sheet: color-mix(in srgb, var(--occasion-background) 53%, var(--occasion-panel));
  color: #fff6e6;
}
.workspace:before { opacity: calc(var(--occasion-decor-opacity) * .5); }
.workspace main { min-width: 0; }
.workspace h1 { font-size: clamp(28px, 4vw, 49px); line-height: 1.06; margin: 0; letter-spacing: -.025em; overflow-wrap: anywhere; }
.workspace .host-title h1 { font-size: clamp(32px, 4vw, 49px); }
.workspace h2 { font-size: 20px; margin: 0; }
.workspace h3 { font-size: 15px; margin: 0 0 7px; }
.workspace p { line-height: 1.5; }
.workspace .muted { color: var(--muted); }
.workspace .small { font-size: 13px; }
.workspace .panel { padding: clamp(14px, 2.5vw, 24px); background: var(--surface); }
.workspace .grid { gap: 12px; }
.workspace .stack { gap: 13px; }
.workspace .row { gap: 8px; }
.workspace button, .workspace .button { padding: 8px 13px; min-height: 42px; line-height: 1.25; text-align: center; }
.workspace button.small-button, .workspace .button.small-button { padding: 7px 11px; min-height: 36px; font-size: 13px; }
.workspace input, .workspace select, .workspace textarea { padding: 9px 11px; min-height: 42px; }
.workspace input[type=checkbox], .workspace input[type=range], .workspace input[type=color] { min-height: 0; }
.workspace label { margin: 6px 0; }
.workspace label.row input { margin: 0; }
.workspace .form-flow { display: grid; gap: 12px; }
.workspace .form-flow > p, .workspace .form-flow > label, .workspace .form-flow > fieldset { margin: 0; }
.workspace .form-flow > button { justify-self: start; }
.workspace .notice { margin: 0; }
.workspace .toolbar { padding-top: 12px; margin-top: 12px; }
.workspace .pill, .workspace .badge { background: var(--accent-tint); border: 1px solid var(--soft-line); font-size: 12px; font-weight: 650; }
.workspace [data-state=running], .workspace [data-state=submitted] { color: var(--teal); }
.workspace [data-state=stopped] { color: #ffb7b7; }
.workspace .section-note { color: var(--muted); font-size: 13px; margin: 0; max-width: 72ch; }
.workspace .surface-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; }
.workspace .surface-heading > * { min-width: 0; }
.workspace .surface-heading p { margin: 5px 0 0; }
.workspace .section-header { margin: 0 0 12px; }
.workspace .empty { padding: 12px; border-radius: 10px; background: var(--sheet); text-align: center; font-size: 13px; }
.workspace .workspace-list { display: grid; gap: 8px; min-width: 0; }
.workspace .section-disclosure { padding: 0; }
.workspace .section-disclosure > summary { padding: 10px 0; min-height: 42px; }
.workspace .panel.section-disclosure > summary { padding: 13px 15px; min-height: 46px; }
.workspace .section-disclosure > .section-body { padding: 0; }
.workspace .panel.section-disclosure > .section-body { padding: 0 15px 15px; }
.workspace .wrap-safe { overflow-wrap: anywhere; }

.workspace-header {
  position: relative; z-index: 2;
  background: color-mix(in srgb, var(--occasion-background) 92%, var(--occasion-panel));
  border-bottom: 1px solid var(--soft-line);
}
.workspace-header-inner {
  margin: auto; max-width: 1560px; min-height: 64px; padding: 7px clamp(10px, 2.6vw, 30px);
  display: flex; align-items: center; justify-content: space-between; gap: 8px 18px;
}
.workspace-brand { display: inline-flex; align-items: center; gap: 9px; min-width: 0; color: inherit; text-decoration: none; }
.workspace-brand .brand { display: block; font-size: 14px; letter-spacing: .07em; line-height: 1.15; }
.workspace-brand small { display: block; line-height: 1.2; margin-top: 2px; }
.brand-mark, .account-avatar {
  display: grid; place-items: center; flex: none;
  width: 36px; height: 36px; border-radius: 10px; background: var(--accent-tint); color: var(--gold);
  border: 1px solid var(--soft-line); font-size: 16px; font-weight: 800;
}
.brand-mark { background: var(--gold); color: var(--occasion-on-accent); border-color: transparent; font-size: 21px; }
.workspace-header-actions { display: flex; align-items: center; gap: 6px 16px; min-width: 0; }
.host-header-grid { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-areas: 'brand game account'; }
.host-header-grid .workspace-brand { grid-area: brand; }
.host-header-grid .workspace-header-actions { grid-area: account; justify-self: end; }
.host-header-grid .host-switch { grid-area: game; justify-self: center; }
.workspace-account { display: flex; align-items: center; gap: 8px; min-width: 0; }
.account-identity { min-width: 0; max-width: 240px; }
.account-identity strong, .account-identity small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; }
.account-identity strong { font-size: 14px; }
.account-avatar { border-radius: 50%; }
.workspace button.header-action, .workspace a.header-action { font-size: 12px; min-height: 36px; padding: 6px 10px; white-space: nowrap; }
.host-switch { display: flex; align-items: center; gap: 8px; margin: 0; min-width: 0; }
.host-switch select { width: clamp(110px, 20vw, 280px); min-height: 36px; margin: 0; text-overflow: ellipsis; }
.host-switch span { white-space: nowrap; }
.host-key { position: relative; }
.host-key > summary { padding: 6px 10px; min-height: 36px; border: 1px solid var(--soft-line); border-radius: var(--occasion-control-radius); font-size: 12px; }
.host-key > summary:after { font-size: 15px; }
.host-key-body {
  position: absolute; right: 0; top: calc(100% + 10px); width: min(300px, calc(100vw - 22px));
  padding: 14px; background: var(--surface); border: 1px solid var(--soft-line);
  border-radius: var(--occasion-panel-radius); box-shadow: 0 12px 32px #0006;
}
.host-key-body p { margin: 9px 0 0; }
.workspace .live-indicator {
  display: inline-flex; gap: 6px; align-items: center; white-space: nowrap;
  color: var(--muted); font-size: 11px;
}
.workspace .live-indicator:before { content: ''; width: 6px; height: 6px; flex: none; background: var(--teal); border-radius: 50%; }

.host-layout {
  display: grid; grid-template-columns: minmax(180px, 214px) minmax(0, 1fr); gap: clamp(14px, 2.8vw, 36px);
  max-width: 1560px; margin: 0 auto; padding: 20px clamp(10px, 2.6vw, 30px) 36px;
}
.host-rail { position: sticky; top: 14px; align-self: start; min-width: 0; }
.host-rail nav { display: grid; gap: 4px; }
.host-rail .all-games { margin-bottom: 9px; }
.workspace [data-view] { min-width: 0; scroll-margin-top: 12px; }
.workspace [data-view-heading]:focus, .workspace #powers-panel h3:focus { outline-offset: 5px; }
.workspace #powers-panel { scroll-margin-top: 12px; }
.view-link {
  display: flex; align-items: center; gap: 9px; padding: 9px 11px; min-height: 43px;
  text-decoration: none; color: var(--muted); border: 1px solid transparent; border-radius: var(--occasion-control-radius);
  font-size: 14px; font-weight: 650; line-height: 1.18;
}
.view-link:hover { color: var(--gold); background: var(--accent-tint); }
.view-link[aria-current] { background: var(--accent-tint); color: var(--gold); border-color: var(--soft-line); }
.nav-icon { width: 19px; flex: none; text-align: center; font-size: 16px; color: var(--gold); }
.nav-count { margin-left: auto; padding: 2px 6px; background: var(--gold); color: var(--occasion-on-accent); border-radius: 7px; font-size: 11px; }
.host-mobile-switch { display: none; grid-area: section; }
.host-title { display: grid; gap: 8px; }
.host-title .code { font-size: 12px; }
.host-game-meta { margin-left: auto; }
.workspace .host-game-meta button { min-height: 30px; }
.host-content { display: grid; gap: 16px; align-content: start; }
.host-content > .notice:empty { margin: 0; }
.section-intro { display: grid; gap: 6px; margin: 0 0 14px; }
.host-content > [data-view] { display: grid; align-content: start; gap: 13px; }
.host-content > [data-view] > .section-intro { margin: 0; }
.workspace .workspace-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.workspace .workspace-grid > * { min-width: 0; }
.game-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.game-filters input { flex: 1 1 190px; width: min(100%, 220px); }
.game-filters select { flex: 1 1 123px; width: min(100%, 146px); }
.game-list-meta { padding: 0 1px; }
.workspace .game-cards { grid-template-columns: repeat(auto-fill, minmax(min(100%, 272px), 1fr)); gap: 12px; }
.workspace .game-card { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.workspace .game-card h2 { margin: 0; overflow-wrap: anywhere; }
.workspace .game-card .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin: 0; }
.workspace .metric { padding: 7px 8px; background: var(--sheet); border-radius: 8px; }
.workspace .metric strong { font-size: 22px; }
.card-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.game-card .card-actions { margin-top: auto; }
.workspace .card-actions details > summary, .workspace .row-options > summary { padding: 7px 10px; font-size: 13px; min-height: 36px; }
.workspace .card-actions details > summary:after, .workspace .row-options > summary:after { font-size: 15px; }
.workspace .card-actions details[open] { flex-basis: 100%; }
.workspace .desk-item { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 12px; padding: 10px 12px; border: 1px solid var(--soft-line); border-radius: var(--occasion-control-radius); background: var(--sheet); }
.workspace .desk-item .row { margin: 0; }
.desk-item-text { flex: 1 1 145px; min-width: 0; }
.desk-item-text strong, .desk-item-text small { display: block; overflow-wrap: anywhere; }
.desk-item-text small { margin-top: 4px; }
.workspace .row-options[open] { flex: 1 1 100%; }
.workspace .row-options[open] .row { padding: 5px 0 1px; }
.round-dashboard { display: grid; gap: 13px; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
.round-dashboard > * { min-width: 0; }
.round-tools { align-items: start; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); }
.workspace .draw-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; padding: 0; overflow: hidden; }
.draw-stat { display: grid; align-content: center; justify-items: start; gap: 5px; padding: clamp(12px, 3vw, 26px); min-width: 0; }
.draw-stat:first-child { background: var(--accent-tint); }
.workspace .draw-stat .status-number, .workspace .draw-stat .clock { color: var(--gold); font-variant-numeric: tabular-nums; line-height: 1; }
.workspace .draw-stat .status-number { font-size: clamp(42px, 7vw, 76px); }
.workspace .draw-stat .clock { font-size: clamp(24px, 4.5vw, 45px); overflow-wrap: anywhere; }
.round-actions { display: grid; align-content: center; gap: 8px; }
.round-actions .alert-actions { border-top: 1px solid var(--soft-line); padding-top: 8px; }
.workspace .forms-inline { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 7px; }
.workspace .forms-inline label { margin: 0; }
.workspace .round-board, .workspace .call-grid { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 4px; }
.workspace .ball-chip { min-width: 0; display: grid; place-items: center; min-height: 21px; padding: 2px 0; background: var(--sheet); border: 1px solid transparent; border-radius: 5px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.workspace .ball-chip.is-called { background: var(--accent-tint); border-color: var(--soft-line); color: var(--gold); font-weight: 750; }
.workspace .ball-chip.is-latest { background: var(--gold); color: var(--occasion-on-accent); font-weight: 800; }
.workspace .share-layout { display: flex; flex-wrap: wrap; gap: 14px; align-items: start; }
.workspace .share-layout > .wrap-safe { flex: 1 1 190px; min-width: 0; }
.workspace .share-layout .qr { width: 146px; height: 146px; }
.workspace .share-layout p { margin: 7px 0; }
.workspace .danger-section { border-color: #a85963; }
.workspace .theme-options { max-height: none; overflow: visible; }
.workspace .appearance-settings input[type=color] { padding: 3px 5px; }
.workspace .theme-choice { min-height: 54px; }
.workspace #commentary-form { gap: 9px; }
.workspace #commentary-form p { margin: 0; }
.workspace #commentary-panel { padding: 0; border: 0; background: transparent; }
.workspace #commentary-panel > summary { padding: 10px 0; }
.workspace #commentary-panel > .section-body { padding: 0; }
.workspace .editor-columns { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); align-items: start; gap: clamp(12px, 2vw, 24px); }
.workspace .editor-columns > * { min-width: 0; }
.workspace .editor-columns .appearance-group:last-child { margin-bottom: 0; }

@media (max-width: 980px) {
  .host-layout { grid-template-columns: 164px minmax(0, 1fr); }
  .view-link { padding-inline: 8px; }
  .round-dashboard, .workspace .editor-columns { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 760px) {
  .host-layout { grid-template-columns: minmax(0, 1fr); gap: 9px; padding-top: 10px; }
  .host-rail { display: none; }
  .host-header-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); grid-template-areas: 'brand account'; row-gap: 5px; }
  .host-header-grid.has-game { grid-template-areas: 'brand account' 'section game'; }
  .workspace-header.game-header, .player-workspace .workspace-header { position: sticky; top: 0; z-index: 20; }
  .workspace [data-view], .workspace #powers-panel { scroll-margin-top: calc(var(--workspace-top) + 12px); }
  .host-mobile-switch { display: block; min-width: 0; }
  .host-mobile-switch label, .host-header-grid .host-switch { display: grid; gap: 2px; margin: 0; width: 100%; font-size: 11px; }
  .host-mobile-switch select, .host-switch select { margin: 0; width: 100%; min-height: 38px; padding-block: 6px; font-size: 14px; }
  .workspace-header-actions { gap: 7px; }
  .account-identity { max-width: clamp(76px, 24vw, 124px); }
  .host-content { gap: 13px; }
}
@media (max-width: 430px) {
  .workspace-header-inner { flex-wrap: wrap; min-height: 57px; column-gap: 6px; }
  .workspace-brand { gap: 6px; }
  .brand-mark, .account-avatar { width: 29px; height: 29px; }
  .brand-mark { font-size: 17px; }
  .workspace-brand small { font-size: 10px; }
  .workspace .workspace-grid { grid-template-columns: minmax(0, 1fr); }
  .workspace .forms-inline { grid-template-columns: minmax(0, 1fr); }
  .workspace .forms-inline button { justify-self: start; }
  .workspace .draw-stat { padding: 11px; }
}
`;

// Hash links keep view changes local, including in-progress forms and live updates.
export const workspaceNavigation = String.raw`
function setupWorkspace(defaultView,aliases={}){
 const views=Array.from(document.querySelectorAll('[data-view]'));
 const routeLinks=Array.from(document.querySelectorAll('[data-view-link]'));
 const picker=document.querySelector('#section-picker');
 function currentView(){
  const hash=location.hash.slice(1),key=Object.hasOwn(aliases,hash)?aliases[hash]:hash;
  return views.some(view=>view.dataset.view===key)?key:defaultView;
 }
 function renderView(focus){
  const key=currentView();
  for(const view of views)view.hidden=view.dataset.view!==key;
  const hash=location.hash.slice(1);
  if(Object.hasOwn(aliases,hash)){
   const anchor=document.getElementById(hash);
   if(anchor?.matches('details'))anchor.open=true;
  }
  for(const link of routeLinks){
   if(link.dataset.viewLink===key)link.setAttribute('aria-current','page');
   else link.removeAttribute('aria-current');
  }
  if(picker)picker.value=key;
  if(focus){
   window.scrollTo(0,0);
   views.find(view=>view.dataset.view===key)?.querySelector('[data-view-heading]')?.focus({preventScroll:true});
  }
 }
 function openView(key){
  if(!views.some(view=>view.dataset.view===key))return;
  if(currentView()!==key)history.pushState(null,'','#'+key);
  renderView(true);
 }
 for(const link of routeLinks)link.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();openView(link.dataset.viewLink);
 });
 if(picker)picker.addEventListener('change',()=>openView(picker.value));
 window.addEventListener('hashchange',()=>renderView(true));
 const header=document.querySelector('.game-header, .player-workspace .workspace-header');
 if(header&&typeof ResizeObserver==='function')new ResizeObserver(()=>{
  document.body.style.setProperty('--workspace-top',header.offsetHeight+'px');
 }).observe(header);
 renderView(false);
 return openView;
}
`;
