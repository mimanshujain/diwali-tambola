import { renderVideoPreview, videoPreviewCss, videoPreviewJs } from './video-preview.js';
import { hostTourButton } from './host-tour.js';

const chapters = [
  {time:0,label:'Create a game',help:'In New game, set the event name, theme, and seconds between calls.'},
  {time:6,label:'Choose prizes',help:'Set winning patterns and tie rules in Prizes & claims before play starts.'},
  {time:13,label:'Pair the TV and invite guests',help:'In TV & guest links, pair the display and copy the guest join link.'},
  {time:21,label:'Approve players',help:'In Players & tickets, approve the names you recognize.'},
  {time:28,label:'Start and run the draw',help:'Start in Live round. Use Call next now or Pause to control the pace.'},
  {time:35,label:'Review a claim',help:'Check the ticket’s highlighted numbers, then select Confirm and resume.'},
  {time:44,label:'End the round',help:'Open Activity & recovery, then End or delete this game. End game keeps the results.'},
];

export const hostGuideButton = '<button type="button" class="ghost header-action" data-open-host-guide aria-haspopup="dialog" aria-controls="host-guide">Host guide</button>';

export function renderHostGuide(cloud: boolean): string {
  const chapterButtons = chapters.map(({time,label,help})=>`<li><button type="button" class="ghost small-button" data-host-chapter="${time}">0:${String(time).padStart(2,'0')} <span>${label}</span></button><p class="section-note">${help}</p></li>`).join('');
  const preview = renderVideoPreview({
    id:'host-walkthrough',file:'host-v2',title:'Tambola host walkthrough',watchLabel:'Watch host walkthrough',
    seconds:48,lazyPoster:true,transcript:chapters.map(chapter=>chapter.help).join(' ').replaceAll('&','&amp;'),
  });
  return `<dialog id="host-guide" class="host-guide" aria-labelledby="host-guide-title">
    <div class="row between"><h2 id="host-guide-title">Host walkthrough</h2><div class="row">${hostTourButton}<form method="dialog"><button class="ghost header-action" type="submit" autofocus>Close</button></form></div></div>
    ${preview}
    ${cloud?'':'<p class="section-note">On your Pi, open the TV link on a screen connected to the same Wi-Fi.</p>'}
    <ol class="host-guide-chapters" aria-label="Walkthrough chapters">${chapterButtons}</ol>
  </dialog>`;
}

export const hostGuideCss = videoPreviewCss + `
.workspace .host-guide{box-sizing:border-box;width:min(720px,calc(100% - 20px));max-height:90vh;max-height:90dvh;padding:clamp(12px,2.8vw,20px);border:1px solid var(--soft-line);border-radius:16px;background:var(--occasion-panel);color:#fff3dc;overflow:auto}
.workspace .host-guide::backdrop{background:#160f1bba}
.workspace .host-guide h2{margin:0;font-size:clamp(20px,5vw,27px)}
.workspace .host-guide .gameplay-preview{margin:12px 0;box-shadow:none}
.host-guide-chapters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0;padding:0;list-style:none}
.host-guide-chapters button{max-width:100%;white-space:normal;text-align:left;justify-content:flex-start;font-variant-numeric:tabular-nums}
.host-guide-chapters p{margin:.33rem 0 0}
@media(max-width:490px){.host-guide-chapters{grid-template-columns:minmax(0,1fr)}}
`;

export const hostGuideJs = videoPreviewJs + String.raw`
(()=>{
 const guide=document.getElementById('host-guide');
 const preview=guide.querySelector('[data-video-preview]');
 for(const trigger of document.querySelectorAll('[data-open-host-guide]')){
  trigger.addEventListener('click',()=>guide.showModal());
 }
 for(const chapter of guide.querySelectorAll('[data-host-chapter]')){
  chapter.addEventListener('click',()=>playVideoPreview(preview,Number(chapter.dataset.hostChapter)));
 }
 guide.addEventListener('close',()=>preview.querySelector('video').pause());
})();
`;
