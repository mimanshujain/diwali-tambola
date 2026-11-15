interface VideoPreview {
  id: string;
  file: string;
  title: string;
  watchLabel: string;
  seconds: number;
  transcript: string;
  lazyPoster?: boolean;
}

export function renderVideoPreview({id,file,title,watchLabel,seconds,transcript,lazyPoster}: VideoPreview): string {
  const path = '/media/gameplay/' + file;
  return `<figure class="gameplay-preview" data-video-preview aria-label="${title}">
    <button class="clip-poster" type="button" id="watch-${id}" aria-controls="${id}-video">
      <img src="${path}.jpg" alt="" width="960" height="540" ${lazyPoster?'loading="lazy"':''}>
      <span class="clip-label"><span class="clip-play" aria-hidden="true"></span><strong>${watchLabel}</strong><small>${seconds} sec</small></span>
    </button>
    <video id="${id}-video" controls playsinline preload="none" hidden tabindex="0" aria-label="${title}" aria-describedby="${id}-transcript" data-src="${path}.mp4"></video>
    <p id="${id}-transcript" class="clip-transcript">${transcript}</p>
    <p class="clip-message" role="status" hidden>Playback is unavailable. <a href="${path}.mp4">Open the video file</a>.</p>
    <noscript><p class="clip-message"><a href="${path}.mp4">${watchLabel}</a></p></noscript>
  </figure>`;
}

export const videoPreviewCss = `
.gameplay-preview{margin:0;min-width:0;border:1px solid #6a4d61;border-radius:16px;overflow:hidden;background:#2a1b2d;box-shadow:0 16px 34px #412a3330}
.gameplay-preview video,.gameplay-preview img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:contain;background:#2a1b2d}
.gameplay-preview .clip-poster{position:relative;display:block;width:100%;border:0;border-radius:0;padding:0;background:#2a1b2d;color:#fff2e4;text-align:left;cursor:pointer}
.gameplay-preview .clip-poster:focus-visible{outline-offset:-4px;outline-color:#fbd790}
.clip-label{display:flex;align-items:center;gap:.65rem;padding:.68rem .9rem}
.clip-label small{margin-left:auto;color:#ead8dd;font-size:.82rem;white-space:nowrap}
.clip-play{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:50%;background:var(--gold,#f4bd66);color:#2a1b2d}
.clip-play::before{content:'';margin-left:2px;width:0;height:0;border-block:6px solid transparent;border-left:9px solid currentColor}
.clip-poster:hover .clip-play{background:#ffe0a3}
.clip-message{padding:.7rem .9rem;color:#f6dfdf}.clip-message a{color:#fbe1a4}
.clip-transcript{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
`;

export const videoPreviewJs = String.raw`
function playVideoPreview(preview,startAt){
 const video=preview.querySelector('video');
 preview.querySelector('.clip-poster').hidden=true;
 video.hidden=false;
 if(!video.hasAttribute('src'))video.src=video.dataset.src;
 if(startAt!==undefined)video.currentTime=startAt;
 video.focus();
 video.play()?.catch(()=>{});
}
for(const preview of document.querySelectorAll('[data-video-preview]')){
 preview.querySelector('.clip-poster').addEventListener('click',()=>playVideoPreview(preview));
 preview.querySelector('video').addEventListener('error',()=>{preview.querySelector('.clip-message').hidden=false;});
}
`;
