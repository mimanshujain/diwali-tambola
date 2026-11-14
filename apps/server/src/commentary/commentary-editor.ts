import { browserVoiceJs } from './browser-voice.js';

const innuendoLevels = [
 {label:'Light',description:'A subtle double meaning when it fits.'},
 {label:'Cheeky',description:'A suggestive second meaning that’s easy to catch.'},
 {label:'Bold',description:'A clearly suggestive punchline about the game.'},
];

export const commentaryFields=String.raw`
<details id="commentary-panel" class="panel"><summary>Live AI commentary</summary><div class="section-body">
<form id="commentary-form" class="stack">
 <p class="small">Speak on the TV using live calls and confirmed winners. Host settings apply to this game only. Press Sound on the TV to hear it.</p>
 <label class="row"><input id="commentary-enabled" type="checkbox" style="width:auto"> Enable commentary</label>
 <div class="grid"><label>Language<select id="commentary-language"><option value="en">English</option><option value="hi">Hindi</option></select></label><label>Number call frequency<select id="commentary-calls"><option value="1">Every call</option>${Array.from({length:9},(_,i)=>'<option value="'+(i+2)+'">Every '+(i+2)+' calls</option>').join('')}</select></label></div>
 <div class="grid"><label>Player shout-out interval<input id="commentary-shoutouts" type="number" min="0" max="30" step="1" required><small>Every N calls. Use 0 to turn off.</small></label><label class="row"><input id="commentary-winners" type="checkbox" style="width:auto"> Announce confirmed winners</label></div>
 <div class="grid"><label>Shout-out focus<select id="commentary-focus"><option value="mixed">Mix leaders and fewer calls</option><option value="leaders">Players doing well</option><option value="few">Players with few calls</option></select></label><label>Commentary tone<select id="commentary-tone"><option value="warm">Warm</option><option value="energetic">Energetic</option><option value="playful">Playful</option></select></label></div>
 <div class="grid"><label>Voice source<select id="commentary-provider"><option value="browser">TV browser voice (free)</option><option value="elevenlabs">Cloud voice (ElevenLabs)</option></select></label><label>Accent<select id="commentary-accent"><option value="indian">Indian</option><option value="us">US</option></select></label></div>
 <label>Voice style<select id="commentary-style"><option value="standard">Standard voice</option><option value="licensed">Licensed featured voice</option></select></label><p class="small">Accent depends on a matching voice installed on the TV or configured by the service owner. A featured voice must be licensed and configured by the owner.</p>
 <label class="row"><input id="commentary-family" type="checkbox" style="width:auto"> Family friendly (default; no sexual references)</label>
 <label class="row"><input id="commentary-adult" type="checkbox" style="width:auto" aria-controls="commentary-innuendo-controls"> Allow sexual innuendo (adults only)</label>
 <div id="commentary-innuendo-controls" class="toolbar" hidden>
  <div class="row between"><label for="commentary-innuendo">Innuendo intensity</label><strong id="commentary-innuendo-value">1 of 3 · Light</strong></div>
  <input id="commentary-innuendo" type="range" min="1" max="${innuendoLevels.length}" step="1" value="1" disabled aria-valuetext="1 of ${innuendoLevels.length}, Light" aria-describedby="commentary-innuendo-description" style="accent-color:var(--occasion-accent)">
  <div class="row between small" aria-hidden="true">${innuendoLevels.map(level=>'<span>'+level.label+'</span>').join('')}</div>
  <p id="commentary-innuendo-description" class="small" style="margin:8px 0 0">${innuendoLevels[0].description}</p>
 </div>
 <div class="row"><button id="commentary-save" disabled>Save commentary</button><span id="commentary-status" role="status" class="small"></span></div>
</form>
<section class="toolbar" aria-labelledby="commentary-test-title">
 <h3 id="commentary-test-title">Test commentary</h3>
 <p class="small">Try your draft settings with a fictional game event. The preview plays on this device.</p>
 <div class="grid"><label>Sample event<select id="commentary-scenario">
  <option value="number">Number call</option><option value="match">Player just matched a number</option><option value="near-win">Player one match away</option><option value="slow-start">Player waiting for a first match</option><option value="winner">Confirmed prize winner</option>
 </select></label><label id="commentary-test-number-label">Sample number<input id="commentary-test-number" type="number" min="1" max="90" step="1" value="42" required></label></div>
 <div class="row"><button id="commentary-generate" class="secondary" type="button" disabled>Generate preview</button><span id="commentary-preview-status" class="small" role="status"></span></div>
 <div id="commentary-preview" class="toolbar" hidden>
  <p id="commentary-preview-audience" class="small"></p>
  <div><strong>Game announcement</strong><p id="commentary-preview-script"></p></div>
  <div id="commentary-preview-generated" hidden><strong>Gemini reaction</strong><p id="commentary-preview-reaction"></p></div>
  <p id="commentary-preview-voice" class="small" role="status"></p>
  <audio id="commentary-preview-audio" controls preload="none" aria-label="Cloud voice preview" style="width:100%" hidden></audio>
  <button id="commentary-preview-speak" class="ghost" type="button" hidden>Play browser preview</button>
 </div>
</section>
<div class="row"><p id="commentary-last" class="small" role="status" style="margin:0">Last live announcement loads here.</p><button id="commentary-refresh" class="ghost small-button" type="button">Refresh live status</button></div>
</div></details>`;
export const commentaryEditorJs=String.raw`
${browserVoiceJs}
const innuendoLevels=${JSON.stringify(innuendoLevels)};
let commentaryDirty=false,commentaryLoaded=false;
let previewVersion=0,previewSpeech=null;
const commentaryInputs=['enabled','language','calls','shoutouts','focus','tone','winners','provider','accent','style','family','adult'].map(k=>$('#commentary-'+k));
const innuendoMeter=$('#commentary-innuendo');
const previewButton=$('#commentary-generate'),previewStatus=$('#commentary-preview-status');
const previewAudio=$('#commentary-preview-audio'),previewSpeak=$('#commentary-preview-speak'),previewVoice=$('#commentary-preview-voice');
const geminiReasons={
 no_key:'Set GEMINI_API_KEY on the API server to use Gemini.',invalid_model:'Check GEMINI_MODEL for a valid Gemini text model ID.',
 invalid_key:'Google rejected the API key. Check GEMINI_API_KEY in the server environment.',access_denied:'Google denied access. Check the Gemini API key restrictions and project permissions.',
 model_unavailable:'This model is unavailable to the project. Check GEMINI_MODEL and model access in Google AI Studio.',
 quota:'Gemini reached a request or usage limit. Check the project quota and try again.',billing:'Gemini requires a project or billing change. Check the project in Google AI Studio.',
 payment_required:'Gemini Prepay credits are unavailable. Open the API key’s project in Google AI Studio to set up Prepay or add credits.',
 rejected:'Gemini rejected the request. Check the server model configuration.',unavailable:'Could not reach Gemini or the service had an error. Try again shortly.',
 timeout:'Gemini did not answer before the commentary timeout. Try again.',blocked:'Gemini blocked this sample under its safety settings. Try a different event or audience setting.',
 truncated:'Gemini ended before it finished the line. Try again.',empty:'Gemini returned no usable text. Try again.',filtered:'The app filtered this reply. Try another sample or tone.',
};
function geminiSummary(report){
 if(!report)return 'Source unavailable for older announcements.';
 const model=report.model?' ('+report.model+')':'';
 if(report.status==='generated')return 'Gemini'+model+' added a reaction.';
 const reason=report.httpStatus===402?'payment_required':report.status;
 return 'Scripted fallback'+model+(report.httpStatus?' · Google HTTP '+report.httpStatus:'')+'. '+(geminiReasons[reason]||'Try a new preview.');
}
function updateInnuendoControl(){
 const active=$('#commentary-adult').checked&&!$('#commentary-family').checked;
 const value=Number(innuendoMeter.value),level=innuendoLevels[value-1];
 $('#commentary-innuendo-controls').hidden=!active;
 innuendoMeter.disabled=!active;
 innuendoMeter.setAttribute('aria-valuetext',value+' of 3, '+level.label);
 $('#commentary-innuendo-value').textContent=value+' of 3 · '+level.label;
 $('#commentary-innuendo-description').textContent=level.description;
}
function fillCommentary(c){
 const event=c.lastAnnouncement,kinds={NUMBER:'Number call',SHOUTOUT:'Player shout-out',WINNER:'Winner'};
 $('#commentary-last').textContent=event?'Last live announcement · '+kinds[event.kind]+' · '+new Date(event.at).toLocaleString()+' · '+geminiSummary(event.gemini):'No live announcements yet.';
 if(!commentaryLoaded){previewButton.disabled=false;$('#commentary-save').disabled=false;}
 if(commentaryDirty&&commentaryLoaded)return;
 commentaryLoaded=true;$('#commentary-enabled').checked=c.enabled;$('#commentary-focus').value=c.shoutoutMode;$('#commentary-tone').value=c.tone;$('#commentary-language').value=c.language;$('#commentary-calls').value=String(c.callsEvery);$('#commentary-shoutouts').value=String(c.shoutoutsEvery);$('#commentary-winners').checked=c.announceWinners;$('#commentary-provider').value=c.voiceProvider;$('#commentary-accent').value=c.accent;$('#commentary-style').value=c.voiceStyle;$('#commentary-family').checked=c.familyFriendly;$('#commentary-adult').checked=c.allowSexualReferences;
 innuendoMeter.value=String(c.innuendoIntensity??1);updateInnuendoControl();
 $('#commentary-status').textContent=c.aiAvailable?'Gemini key configured. Generate a preview to verify it.':'Gemini key missing. Scripted commentary is available.';
}
async function loadCommentary(){
 if(!hosted&&!keyBox.value)return;
 try{fillCommentary(await req('/commentary/admin/settings'));}catch(error){$('#commentary-status').textContent=error.message;}
}
function commentaryDraft(){
 return {enabled:$('#commentary-enabled').checked,shoutoutMode:$('#commentary-focus').value,tone:$('#commentary-tone').value,language:$('#commentary-language').value,callsEvery:Number($('#commentary-calls').value),shoutoutsEvery:Number($('#commentary-shoutouts').value),announceWinners:$('#commentary-winners').checked,voiceProvider:$('#commentary-provider').value,accent:$('#commentary-accent').value,voiceStyle:$('#commentary-style').value,familyFriendly:$('#commentary-family').checked,allowSexualReferences:$('#commentary-adult').checked,innuendoIntensity:Number(innuendoMeter.value)};
}
function stopPreviewSpeech(){
 if(previewSpeech){previewSpeech=null;window.speechSynthesis.cancel();}
 previewSpeak.textContent='Play browser preview';
}
function clearPreview(){
 previewVersion++;
 stopPreviewSpeech();
 previewAudio.pause();previewAudio.removeAttribute('src');previewAudio.hidden=true;
 $('#commentary-preview').hidden=true;previewStatus.textContent='';
}
for(const field of commentaryInputs)field.addEventListener('change',()=>{
 commentaryDirty=true;
 if(field.id==='commentary-family'&&field.checked)$('#commentary-adult').checked=false;
 if(field.id==='commentary-adult'&&field.checked){
  if(!confirm('This is for an adults-only gathering. Allow suggestive commentary about the game?'))field.checked=false;
  else $('#commentary-family').checked=false;
 }
 updateInnuendoControl();
 clearPreview();
});
innuendoMeter.oninput=()=>{commentaryDirty=true;updateInnuendoControl();clearPreview();};
$('#commentary-scenario').onchange=()=>{$('#commentary-test-number-label').hidden=$('#commentary-scenario').value!=='number';clearPreview();};
$('#commentary-test-number').oninput=clearPreview;

function showPreview(result,settings){
 previewStatus.textContent=geminiSummary(result.gemini);
 $('#commentary-preview-audience').textContent=settings.familyFriendly?'Family friendly':settings.allowSexualReferences?'Adults only · '+innuendoLevels[settings.innuendoIntensity-1].label+' innuendo':'No sexual references';
 $('#commentary-preview-script').textContent=result.script;
 $('#commentary-preview-generated').hidden=!result.reaction;
 $('#commentary-preview-reaction').textContent=result.reaction||'';
 const voice=result.voice,status=voice.status;
 const voiceReasons={voice_unconfigured:'The selected ElevenLabs voice or key is missing.',rejected:'ElevenLabs rejected the request'+(voice.httpStatus?' (HTTP '+voice.httpStatus+')':'')+'.',timeout:'ElevenLabs timed out.',unavailable:'ElevenLabs audio is unavailable.'};
 const browserHint='The preview uses the voices on this device.';
 previewVoice.textContent=status==='generated'?'ElevenLabs audio is ready to play.':(voiceReasons[status]?voiceReasons[status]+' ':'')+browserHint;
 previewSpeak.hidden=Boolean(voice.audio);
 previewAudio.onerror=()=>{
  if(!previewAudio.getAttribute('src'))return;
  previewAudio.hidden=true;previewSpeak.hidden=false;
  previewVoice.textContent='Cloud audio could not play. '+browserHint;
 };
 if(voice.audio){previewAudio.src='data:audio/mpeg;base64,'+voice.audio;previewAudio.hidden=false;}
 previewSpeak.onclick=()=>{
  if(previewSpeech){stopPreviewSpeech();return;}
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){previewVoice.textContent='Browser speech is unavailable on this device.';return;}
  const speech=new SpeechSynthesisUtterance(result.text);
  speech.lang=commentaryLocale(settings);
  const voice=browserVoice(window.speechSynthesis.getVoices(),speech.lang);
  if(voice)speech.voice=voice;
  const finish=()=>{if(previewSpeech===speech){previewSpeech=null;previewSpeak.textContent='Play browser preview';}};
  speech.onend=finish;
  speech.onerror=()=>{if(previewSpeech===speech)previewVoice.textContent='This browser could not speak the preview. Check its speech voices.';finish();};
  previewSpeech=speech;previewSpeak.textContent='Stop audio';window.speechSynthesis.speak(speech);
 };
 $('#commentary-preview').hidden=false;
}
previewButton.onclick=()=>run(previewButton,async()=>{
 const scenario=$('#commentary-scenario').value,number=$('#commentary-test-number');
 if(!$('#commentary-form').reportValidity()||(scenario==='number'&&!number.reportValidity()))return;
 clearPreview();const version=previewVersion,settings=commentaryDraft();
 previewStatus.textContent='Generating preview…';
 try{
  const result=await req('/commentary/admin/preview','POST',{scenario,settings,...(scenario==='number'?{number:Number(number.value)}:{})});
  if(version===previewVersion)showPreview(result,settings);
 }catch(error){if(version===previewVersion)previewStatus.textContent=error.message;}
});
$('#commentary-refresh').onclick=()=>run($('#commentary-refresh'),loadCommentary);
$('#commentary-panel').addEventListener('toggle',()=>{if($('#commentary-panel').open)void loadCommentary();else clearPreview();});
$('#commentary-form').onsubmit=e=>{e.preventDefault();run($('#commentary-save'),async()=>{
 const draft=commentaryDraft();
 const result=await req('/commentary/admin/settings','POST',draft);
 commentaryDirty=JSON.stringify(commentaryDraft())!==JSON.stringify(draft);fillCommentary(result);
 if(!commentaryDirty)$('#commentary-status').textContent='Commentary saved. '+$('#commentary-status').textContent;
 else $('#commentary-status').textContent='Commentary saved. Newer edits are unsaved.';
});};
loadCommentary();
`;
