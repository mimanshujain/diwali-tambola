export const PARTY_CLIENT_JS=String.raw`
(()=>{
if(!/^\/tv\/[^/]+$/.test(location.pathname))return;
const css=document.createElement('style');css.textContent=
'@keyframes partyPop{from{opacity:0;transform:scale(.75)}to{opacity:1;transform:scale(1)}}'+
'@keyframes numberGlow{0%{filter:brightness(1.9);transform:scale(1.07)}100%{filter:brightness(1);transform:scale(1)}}'+
'.party-announce{position:fixed;z-index:1000;inset:5% 9%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:3vw;border:4px solid var(--occasion-accent);border-radius:34px;background:linear-gradient(130deg,var(--occasion-background),var(--occasion-panel));box-shadow:0 0 0 200vmax #000a;color:white;animation:partyPop .4s ease-out;pointer-events:none}'+
'.party-announce strong{font-size:clamp(25px,5vw,78px)}.party-announce p{font-size:clamp(19px,3vw,42px);color:var(--occasion-accent)}'+
'.party-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px}.party-toolbar button{font-size:14px}'+
'.spotify-panel{position:fixed;z-index:1300;right:2vw;top:10vh;width:min(460px,94vw);padding:20px;border:1px solid var(--occasion-accent);border-radius:18px;background:var(--occasion-panel);box-shadow:0 12px 40px #000b}.spotify-panel input{width:100%;margin:8px 0}.spotify-panel iframe{width:100%;height:160px;border:0;border-radius:12px;margin-top:12px}.spotify-panel[hidden]{display:none}'+
'@media(prefers-reduced-motion:reduce){.party-announce,.party-number{animation:none!important}}'+
'@media print{.party-announce,.party-toolbar,.spotify-panel{display:none!important}}';
document.head.appendChild(css);
const toolbar=document.createElement('div');toolbar.className='party-toolbar no-print';document.querySelector('header')?.appendChild(toolbar);
const button=(text,handler)=>{const node=document.createElement('button');node.type='button';node.className='ghost';node.textContent=text;node.addEventListener('click',handler);toolbar.appendChild(node);return node;};
const params=new URLSearchParams(location.search);let desiredSound=params.get('sound')==='1',sound=false,context,hindi=params.get('hindi')!=='0';
const soundButton=button('',()=>{if(sound){desiredSound=false;sound=false;stopSpeech();commentaryAudio?.pause();updateSound();}else enableSound();});
const hindiButton=button('',()=>{hindi=!hindi;hindiButton.textContent='Hindi voice '+(hindi?'on':'off');if(!hindi)stopSpeech('classic');});hindiButton.textContent='Hindi voice '+(hindi?'on':'off');
button('Fullscreen',()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.().catch(()=>{});});
function updateSound(){soundButton.textContent=sound?'Sound on':desiredSound?'Press OK for sound':'Sound off · press OK';}
function enableSound(){desiredSound=true;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){soundButton.textContent='Audio unavailable';return;}context??=new Audio();context.onstatechange=()=>{sound=desiredSound&&context.state==='running';updateSound();};const resumed=context.resume();if(resumed?.then)resumed.then(()=>{sound=desiredSound&&context.state==='running';updateSound();if(sound)chime();}).catch(()=>updateSound());sound=context.state==='running';updateSound();}catch{sound=false;updateSound();}}
function chime(){if(!sound||!context)return;try{const now=context.currentTime;for(const [index,note] of [523.25,659.25,783.99].entries()){const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='sine';oscillator.frequency.value=note;gain.gain.setValueAtTime(0,now+index*.14);gain.gain.linearRampToValueAtTime(.06,now+index*.14+.02);gain.gain.exponentialRampToValueAtTime(.001,now+index*.14+.33);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(now+index*.14);oscillator.stop(now+index*.14+.34);}}catch{sound=false;updateSound();}}
updateSound();if(desiredSound)enableSound();
document.addEventListener('keydown',event=>{if(!sound&&['Enter',' '].includes(event.key)&&!['INPUT','TEXTAREA'].includes(event.target?.tagName)){event.preventDefault();enableSound();}});
const numbers=['','एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ','दस','ग्यारह','बारह','तेरह','चौदह','पंद्रह','सोलह','सत्रह','अठारह','उन्नीस','बीस','इक्कीस','बाईस','तेईस','चौबीस','पच्चीस','छब्बीस','सत्ताईस','अट्ठाईस','उनतीस','तीस','इकतीस','बत्तीस','तैंतीस','चौंतीस','पैंतीस','छत्तीस','सैंतीस','अड़तीस','उनतालीस','चालीस','इकतालीस','बयालीस','तैंतालीस','चवालीस','पैंतालीस','छियालीस','सैंतालीस','अड़तालीस','उनचास','पचास','इक्यावन','बावन','तिरपन','चौवन','पचपन','छप्पन','सत्तावन','अट्ठावन','उनसठ','साठ','इकसठ','बासठ','तिरसठ','चौंसठ','पैंसठ','छियासठ','सड़सठ','अड़सठ','उनहत्तर','सत्तर','इकहत्तर','बहत्तर','तिहत्तर','चौहत्तर','पचहत्तर','छिहत्तर','सतहत्तर','अठहत्तर','उन्यासी','अस्सी','इक्यासी','बयासी','तिरासी','चौरासी','पचासी','छियासी','सत्तासी','अट्ठासी','नवासी','नब्बे'];
const special={1:'एक अकेला, सबसे पहला',2:'एक और एक, दो',7:'भाग्यशाली सात',11:'दो डंडे, ग्यारह',22:'दो बत्तखें, बाईस',44:'चोर चोर, चवालीस',55:'दो पंजे, पचपन',66:'दो छक्के, छियासठ',77:'दो सात, सतहत्तर',88:'दो अठन्नी, अट्ठासी',90:'नब्बे पूरे, खेल में खुशियाँ भरपूर'};
// Keep one utterance active until the browser reports completion.
const speechQueue=[];
let activeSpeech=null;
function speakLine(text,lang,kind){
 return new Promise(resolve=>{
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){resolve();return;}
  speechQueue.push({text,lang,kind,resolve});
  speakNext();
 });
}
function speakNext(){
 if(activeSpeech||!speechQueue.length)return;
 const job=speechQueue.shift();
 activeSpeech=job;
 function finish(){
  if(activeSpeech!==job)return;
  clearTimeout(job.timer);
  activeSpeech=null;
  job.resolve();
  speakNext();
 }
 job.finish=finish;
 try{
  const speech=new SpeechSynthesisUtterance(job.text);
  speech.lang=job.lang;
  const voices=window.speechSynthesis.getVoices();
  const locale=job.lang.toLowerCase(),language=locale.split('-')[0];
  const voice=voices.find(v=>v.lang.toLowerCase().replace('_','-')===locale)
   ||voices.find(v=>v.lang.toLowerCase().split(/[-_]/)[0]===language);
  if(voice)speech.voice=voice;
  speech.onend=finish;
  speech.onerror=finish;
  job.speech=speech;
  job.timer=setTimeout(()=>stopActiveSpeech(job),30000);
  window.speechSynthesis.speak(speech);
 }catch{finish();}
}
function stopActiveSpeech(job){
 if(activeSpeech!==job)return;
 if(job.speech)job.speech.onend=job.speech.onerror=null;
 try{window.speechSynthesis.cancel();}finally{job.finish();}
}
function stopSpeech(kind){
 for(let i=speechQueue.length-1;i>=0;i--){
  if(!kind||speechQueue[i].kind===kind)speechQueue.splice(i,1)[0].resolve();
 }
 if(activeSpeech&&(!kind||activeSpeech.kind===kind))stopActiveSpeech(activeSpeech);
}
function announce(number){
 if(commentaryConfig?.enabled||commentaryHalted||!sound||!hindi||!numbers[number])return;
 const words=special[number]||'अगला नंबर, '+numbers[number];
 void speakLine(words+'।','hi-IN','classic');
}
const music=document.createElement('section');music.className='spotify-panel';music.hidden=true;music.setAttribute('aria-label','Spotify music');
const heading=document.createElement('h2');heading.textContent='Spotify music';const instructions=document.createElement('p');instructions.textContent='Paste a Spotify playlist, album or track link. Internet access and playback in Spotify are required.';
const input=document.createElement('input');input.placeholder='https://open.spotify.com/playlist/…';input.setAttribute('aria-label','Spotify link');const feedback=document.createElement('p');feedback.setAttribute('role','status');const actions=document.createElement('div');actions.className='row';
const load=document.createElement('button');load.type='button';load.textContent='Load player';const close=document.createElement('button');close.type='button';close.className='ghost';close.textContent='Close';const stop=document.createElement('button');stop.type='button';stop.className='ghost';stop.textContent='Stop music';actions.append(load,close,stop);music.append(heading,instructions,input,actions,feedback);document.body.append(music);
button('Spotify',()=>{music.hidden=false;input.focus();});close.onclick=()=>{music.hidden=true;};stop.onclick=()=>{music.querySelector('iframe')?.remove();feedback.textContent='Music stopped.';};
load.onclick=()=>{try{const url=new URL(input.value.trim()),match=/^\/(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname);if(url.protocol!=='https:'||url.hostname!=='open.spotify.com'||!match)throw Error('Paste a Spotify playlist, album or track link.');const frame=document.createElement('iframe');frame.title='Spotify player';frame.src='https://open.spotify.com/embed/'+match[1]+'/'+match[2];frame.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';frame.referrerPolicy='no-referrer';music.querySelector('iframe')?.remove();music.append(frame);feedback.textContent='Press play in Spotify. Playback availability depends on your Spotify account.';}catch(error){feedback.textContent=error.message;}};
let commentaryConfig=null,commentaryHalted=false;
let initialized=false,oldWinnerTexts=new Set(),lastNumber='—',overlayTimer;
const celebrate=(title,message)=>{document.querySelector('.party-announce')?.remove();const box=document.createElement('div');box.className='party-announce';box.setAttribute('role','status');const heading=document.createElement('strong');heading.textContent=title;const subtitle=document.createElement('p');subtitle.textContent=message;box.append(heading,subtitle);document.body.appendChild(box);chime();clearTimeout(overlayTimer);overlayTimer=setTimeout(()=>box.remove(),6000);};
window.addEventListener('tambola:qualified',event=>{if(event.detail?.message)celebrate('✨ AUTO-QUALIFIED',event.detail.message);});
function scan(){const latest=document.querySelector('#latest'),number=latest?.textContent?.trim()||'—';const winners=Array.from(document.querySelectorAll('#winners .item'),item=>item.textContent?.trim()||'').filter(Boolean);
 if(initialized){if(number!==lastNumber&&number!=='—'){latest?.classList.remove('party-number');void latest?.offsetWidth;latest?.classList.add('party-number');if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)latest.style.animation='numberGlow .9s ease-out';chime();announce(Number(number));}for(const winner of winners){if(!oldWinnerTexts.has(winner)){celebrate('🎉 WINNER!',winner);break;}}}
 lastNumber=number;oldWinnerTexts=new Set(winners);initialized=true;}
const winnerTarget=document.querySelector('#winners');if(winnerTarget)new MutationObserver(scan).observe(winnerTarget,{childList:true,subtree:true});const numberTarget=document.querySelector('#latest');if(numberTarget)new MutationObserver(scan).observe(numberTarget,{childList:true,characterData:true,subtree:true});scan();
// The TV is the only narrator. The host saves global options; this button controls local sound.
const commentaryId=document.querySelector('[data-game-id]')?.dataset.gameId;
const caption=document.createElement('div');caption.id='commentary-caption';caption.setAttribute('aria-live','polite');caption.hidden=true;document.body.append(caption);
const captionCss=document.createElement('style');captionCss.textContent='#commentary-caption{position:fixed;z-index:900;bottom:2vh;left:15vw;right:15vw;border:1px solid var(--occasion-accent);border-radius:14px;background:var(--occasion-background);color:var(--occasion-accent);padding:10px 16px;font-size:clamp(15px,2.3vh,30px);text-align:center;box-shadow:0 6px 28px #0009;pointer-events:none}#commentary-caption[hidden]{display:none}';document.head.append(captionCss);
let commentaryCursor=0,commentaryInitialized=false,commentaryPolling=false,commentaryQueue=[],commentarySpeaking=false,commentaryAudio=null;
const narrationButton=button('Narration on',()=>{narrationLocal=!narrationLocal;narrationButton.textContent='Narration '+(narrationLocal?'on':'off');if(!narrationLocal){commentaryQueue=[];commentaryAudio?.pause();stopSpeech('commentary');}});
let narrationLocal=true;
function browserNarration(line,settings){
 if(!sound||!narrationLocal||!commentaryConfig?.enabled||commentaryHalted)return;
 const lang=settings.language==='hi'?'hi-IN':settings.accent==='us'?'en-US':'en-IN';
 return speakLine(line,lang,'commentary');
}
async function voiceNarration(event,settings){if(event.audio){try{await new Promise((resolve,reject)=>{const audio=new Audio('/games/'+encodeURIComponent(commentaryId)+'/commentary/'+event.seq+'/audio');commentaryAudio=audio;audio.onended=resolve;audio.onerror=reject;audio.play().catch(reject);setTimeout(()=>{audio.pause();resolve();},13000);});return;}catch{}}await browserNarration(event.text,settings);}
async function drainCommentary(){if(commentarySpeaking)return;commentarySpeaking=true;try{while(commentaryQueue.length){const {event,settings}=commentaryQueue.shift();caption.textContent=event.text;caption.hidden=false;if(sound&&narrationLocal)await voiceNarration(event,settings);else await new Promise(resolve=>setTimeout(resolve,1300));}caption.hidden=true;}finally{commentarySpeaking=false;}}
async function pollCommentary(){if(!commentaryId||commentaryPolling)return;commentaryPolling=true;try{const r=await fetch('/games/'+encodeURIComponent(commentaryId)+'/commentary?after='+commentaryCursor,{cache:'no-store'});if(!r.ok)return;const data=await r.json();const wasEnabled=commentaryConfig?.enabled;commentaryConfig=data.settings;commentaryHalted=data.halted;if(data.settings.enabled&&!wasEnabled)stopSpeech('classic');narrationButton.textContent=data.settings.enabled?'Narration '+(narrationLocal?'on':'off'):'Narration off (host)';narrationButton.disabled=!data.settings.enabled;if(!data.settings.enabled||data.halted){commentaryQueue=[];for(const event of data.events)commentaryCursor=Math.max(commentaryCursor,event.seq);commentaryInitialized=true;commentaryAudio?.pause();stopSpeech(data.halted?undefined:'commentary');caption.hidden=true;return;}
 for(const event of data.events){commentaryCursor=Math.max(commentaryCursor,event.seq);if(commentaryInitialized){if(event.kind==='WINNER')commentaryQueue.unshift({event,settings:data.settings});else commentaryQueue.push({event,settings:data.settings});}}
 commentaryInitialized=true;if(commentaryQueue.length>4)commentaryQueue=commentaryQueue.filter(x=>x.event.kind==='WINNER').concat(commentaryQueue.filter(x=>x.event.kind!=='WINNER').slice(-2));void drainCommentary();
 }catch{}finally{commentaryPolling=false;}}
setInterval(pollCommentary,2500);pollCommentary();
})();`;
