/** Browser-only enhancements. No external assets, no dependencies, no game state mutation. */
export const PARTY_CLIENT_JS=String.raw`
(()=>{
const route=location.pathname;
const isTV=/^\/tv\/[^/]+$/.test(route);
if(!isTV)return;
const css=document.createElement('style');css.textContent=
'@keyframes partyPop{from{opacity:0;transform:scale(.75)}to{opacity:1;transform:scale(1)}}'+
'@keyframes numberGlow{0%{filter:brightness(1.9);transform:scale(1.07)}100%{filter:brightness(1);transform:scale(1)}}'+
'.party-announce{position:fixed;z-index:1000;inset:5% 9%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:3vw;border:4px solid #ffe6a3;border-radius:34px;background:linear-gradient(130deg,#242c58,#56274f);box-shadow:0 0 0 200vmax #000a;color:white;animation:partyPop .4s ease-out;pointer-events:none}'+
'.party-announce strong{font-size:clamp(25px,5vw,78px)}.party-announce p{font-size:clamp(19px,3vw,42px);color:#ffe5a8}'+
'.party-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px}.party-toolbar button{font-size:14px}'+
'@media(prefers-reduced-motion:reduce){.party-announce,.party-number{animation:none!important}}'+
'@media print{.party-announce,.party-toolbar{display:none!important}}';
document.head.appendChild(css);
const toolbar=document.createElement('div');toolbar.className='party-toolbar no-print';
const b=(txt,fn)=>{const x=document.createElement('button');x.type='button';x.className='ghost';x.textContent=txt;x.addEventListener('click',fn);toolbar.appendChild(x);return x;};
let sound=false;let ctx;
function chime(){if(!sound)return;try{ctx??=new (window.AudioContext||window.webkitAudioContext)();
const now=ctx.currentTime;for(const [i,n] of [523.25,659.25,783.99].entries()){
const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=n;gain.gain.setValueAtTime(0,now+i*.14);gain.gain.linearRampToValueAtTime(.06,now+i*.14+.02);gain.gain.exponentialRampToValueAtTime(.001,now+i*.14+.33);osc.connect(gain);gain.connect(ctx.destination);osc.start(now+i*.14);osc.stop(now+i*.14+.34);
}}catch{sound=false;}}
if(isTV){
const spot=document.querySelector('header');
const toggle=b('Sound off',()=>{sound=!sound;toggle.textContent='Sound '+(sound?'on':'off');if(sound)chime();});
b('Fullscreen',()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.().catch(()=>{});});
spot?.appendChild(toolbar);
let initialized=false, oldWinnerTexts=new Set(), lastNumber='—', overlayTimer;
const celebrate=(title,message)=>{document.querySelector('.party-announce')?.remove();const box=document.createElement('div');box.className='party-announce';box.setAttribute('role','status');const heading=document.createElement('strong');heading.textContent=title;const subtitle=document.createElement('p');subtitle.textContent=message;box.append(heading,subtitle);document.body.appendChild(box);chime();clearTimeout(overlayTimer);overlayTimer=setTimeout(()=>box.remove(),6000);};
function scan(){const latest=document.querySelector('#latest');const number=latest?.textContent?.trim()||'—';
const winners=Array.from(document.querySelectorAll('#winners .item'),x=>x.textContent?.trim()||'').filter(Boolean);
if(initialized){if(number!==lastNumber&&number!=='—'){latest?.classList.remove('party-number');void latest?.offsetWidth;latest?.classList.add('party-number');if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)latest.style.animation='numberGlow .9s ease-out';chime();}
for(const winner of winners){if(!oldWinnerTexts.has(winner)){celebrate('🎉 WINNER!',winner);break;}}}
lastNumber=number;oldWinnerTexts=new Set(winners);initialized=true;}
const target=document.querySelector('#winners');if(target)new MutationObserver(scan).observe(target,{childList:true,subtree:true});
const numberTarget=document.querySelector('#latest');if(numberTarget)new MutationObserver(scan).observe(numberTarget,{childList:true,characterData:true,subtree:true});
scan();
}
})();`;
