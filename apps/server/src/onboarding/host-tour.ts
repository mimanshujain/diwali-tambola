interface TourStep {
  view: string;
  target: string;
  title: string;
  description: string;
}

const deskSteps: readonly TourStep[] = [
  {view:'games',target:'#games > :first-child',title:'Find a game',description:'Open a game to run it or check its results. Use the filter to find completed games.'},
  {view:'create',target:'#create-form > .grid',title:'Set the draw pace',description:'Choose how many seconds the game waits between calls. You can adjust the countdown from the game console.'},
  {view:'create',target:'[data-theme-choice="game-night"]',title:'Choose the occasion',description:'Select a preset or customize the colors. The TV, player ticket, and print previews show your choices.'},
  {view:'create',target:'#create',title:'Open your lobby',description:'Name the event and select Create game when you are ready. The game console opens with your guest link and TV controls.'},
];

function consoleSteps(cloud: boolean): readonly TourStep[] {
  return [
    {view:'sharing',target:cloud?'#pair-tv':'#tvLink',title:'Set up the TV and invite guests',description:cloud?'Use Pair a TV to open the board on another screen. Share the separate guest link with players.':'Open the TV link on a display on the same Wi-Fi. Share the guest link with players.'},
    {view:'players',target:'#players-panel [data-view-heading]',title:'Approve players',description:'Approve the names you recognize. Approved draft tickets lock in when the game starts.'},
    {view:'prizes',target:'#prizes-panel h3',title:'Choose the winning patterns',description:'Set prizes and tie rules before you start. Early Five matches any five numbers on one ticket.'},
    {view:'round',target:'.round-actions',title:'Run the draw',description:'Start your lobby here. During play, use Call next now or Pause to manage the pace.'},
    {view:'prizes',target:'#claims-panel h3',title:'Review and confirm claims',description:'When a claim arrives, choose Review claim to see the matching numbers on the ticket. Confirm the prize after checking it.'},
    {view:'style',target:'#appearance-panel summary',title:'Change the look or voice',description:'Appearance sets the theme guests see. Live AI commentary lets you preview how the TV announces calls and winners.'},
    {view:'activity',target:'#game-end-panel summary',title:'Review activity and end the game',description:'Check activity after a restart, or open End or delete this game. Ending a game keeps its saved results.'},
  ];
}

export const hostTourButton = '<button type="button" class="ghost header-action" data-open-host-tour aria-haspopup="dialog" aria-controls="host-tour">Take a tour</button>';

export const hostTourMarkup = `
<dialog id="host-tour" class="host-tour" aria-labelledby="host-tour-title" aria-describedby="host-tour-description">
 <div class="tour-spotlight" aria-hidden="true" hidden></div>
 <section class="tour-card">
  <p class="small" id="host-tour-count"></p>
  <h2 id="host-tour-title" tabindex="-1"></h2>
  <p id="host-tour-description"></p>
  <div class="row between">
   <button type="button" id="host-tour-skip" class="ghost header-action">Skip tour</button>
   <div class="row"><button type="button" id="host-tour-back" class="ghost header-action">Back</button><button type="button" id="host-tour-next" class="header-action">Next</button></div>
  </div>
 </section>
</dialog>`;

export const hostTourCss = `
.workspace .host-tour {
  position:fixed; inset:0; width:100%; height:100%; max-width:none; max-height:none;
  margin:0; padding:0; border:0; overflow:hidden; background:transparent; color:var(--ink);
}
.workspace .host-tour::backdrop { background:transparent; }
.workspace .host-tour.tour-without-target::backdrop { background:#291d2966; }
.tour-spotlight {
  position:absolute; pointer-events:none; border:2px solid var(--plum); border-radius:11px;
  box-shadow:0 0 0 2px var(--gold), 0 0 0 100vmax #291d2966;
}
.tour-card {
  position:absolute; isolation:isolate; width:min(365px,calc(100% - 24px)); max-height:calc(100% - 24px);
  overflow:auto; padding:13px 16px 15px; border:1px solid var(--label-border); border-radius:14px;
  background:var(--card); box-shadow:0 12px 32px #291d2940;
}
.workspace .tour-card h2 { font-size:clamp(20px,5vw,25px); line-height:1.15; margin:4px 0 8px; }
.workspace .tour-card p { margin:0 0 10px; }
.tour-card #host-tour-count { margin-bottom:0; }
.host-workspace #host-tour-next { background:var(--plum); }
`;

const client = String.raw`
function bindHostTour(steps,openView){
 const tour=document.getElementById('host-tour');
 const card=tour.querySelector('.tour-card'),spotlight=tour.querySelector('.tour-spotlight');
 const title=document.getElementById('host-tour-title'),description=document.getElementById('host-tour-description');
 const count=document.getElementById('host-tour-count'),next=document.getElementById('host-tour-next'),back=document.getElementById('host-tour-back');
 let stepIndex=0,target=null,opener=null,savedUrl='',savedScroll=0,layoutFrame=0;
 const clamp=(value,min,max)=>Math.min(Math.max(value,min),Math.max(min,max));

 function placeCard(){
  if(!tour.open)return;
  const width=tour.clientWidth,height=tour.clientHeight,gutter=12;
  const rect=target?.getBoundingClientRect();
  const visible=rect&&rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<height;
  spotlight.hidden=!visible;
  tour.classList.toggle('tour-without-target',!visible);
  let x=(width-card.offsetWidth)/2,y=(height-card.offsetHeight)/2;
  if(visible){
   const left=clamp(rect.left-5,4,width-4),top=clamp(rect.top-5,4,height-4);
   const right=clamp(rect.right+5,left,width-4),bottom=clamp(rect.bottom+5,top,height-4);
   Object.assign(spotlight.style,{left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
   x=left;
   const below=bottom+10,above=top-card.offsetHeight-10;
   y=below+card.offsetHeight+gutter<=height?below:above>=gutter?above:height-card.offsetHeight-gutter;
  }
  card.style.left=clamp(x,gutter,width-card.offsetWidth-gutter)+'px';
  card.style.top=clamp(y,gutter,height-card.offsetHeight-gutter)+'px';
 }

 function layout(){
  cancelAnimationFrame(layoutFrame);
  layoutFrame=requestAnimationFrame(placeCard);
 }

 function showStep(){
  const step=steps[stepIndex];
  openView(step.view,{replace:true,focus:false});
  target=Array.from(document.querySelectorAll(step.target)).find(element=>element.getClientRects().length>0)??null;
  target?.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
  count.textContent='Step '+(stepIndex+1)+' of '+steps.length;
  title.textContent=step.title;
  description.textContent=step.description;
  back.hidden=stepIndex===0;
  next.textContent=stepIndex===steps.length-1?'Done':'Next';
  title.focus({preventScroll:true});
  layout();
 }

 for(const trigger of document.querySelectorAll('[data-open-host-tour]')){
  trigger.addEventListener('click',()=>{
   const guide=trigger.closest('dialog');
   savedUrl=location.href;savedScroll=scrollY;
   opener=guide?document.querySelector('[data-open-host-guide]'):trigger;
   if(guide?.open)guide.close();
   stepIndex=0;
   tour.showModal();
   showStep();
  });
 }
 back.addEventListener('click',()=>{if(stepIndex>0){stepIndex--;showStep();}});
 next.addEventListener('click',()=>{if(stepIndex+1===steps.length){tour.close();return;}stepIndex++;showStep();});
 document.getElementById('host-tour-skip').addEventListener('click',()=>tour.close());
 tour.addEventListener('close',()=>{
  if(location.href!==savedUrl){
   history.replaceState(history.state,'',savedUrl);
   window.dispatchEvent(new Event('hashchange'));
  }
  window.scrollTo(0,savedScroll);
  opener?.focus({preventScroll:true});
 });
 window.addEventListener('resize',()=>{if(tour.open)layout();});
 window.addEventListener('scroll',()=>{if(tour.open)layout();},{passive:true});
}
`;

export function hostTourScript(page: 'desk' | 'game', cloud: boolean): string {
  const steps = page === 'desk' ? deskSteps : consoleSteps(cloud);
  return client + 'bindHostTour(' + JSON.stringify(steps) + ',openHostView);';
}
