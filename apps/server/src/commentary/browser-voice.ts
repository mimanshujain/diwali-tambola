export const browserVoiceJs=String.raw`
function commentaryLocale(settings){
 return settings.language==='hi'?'hi-IN':settings.accent==='us'?'en-US':'en-IN';
}
function browserVoice(voices,lang){
 const locale=lang.toLowerCase(),language=locale.split('-')[0];
 return voices.find(voice=>voice.lang.toLowerCase().replace('_','-')===locale)
  ||voices.find(voice=>voice.lang.toLowerCase().split(/[-_]/)[0]===language);
}
`;
