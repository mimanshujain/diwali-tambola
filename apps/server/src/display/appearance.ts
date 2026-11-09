/** Versioned, curated presentation only; never changes rules or ticket identity. */
export const THEMES = [
 {id:'classic',name:'Classic Celebration',symbol:'✦',background:'#10272b',panel:'#19383c',accent:'#f5d98a',muted:'#c0d4d3',line:'#466365',glow:'#345d60',ink:'#305b60'},
 {id:'diwali',name:'Diwali',symbol:'🪔',background:'#190f24',panel:'#2a192e',accent:'#ffcf78',muted:'#ccb9c5',line:'#664359',glow:'#673144',ink:'#89551e'},
 {id:'birthday',name:'Birthday',symbol:'✧',background:'#271630',panel:'#3d2446',accent:'#ffb8dc',muted:'#dec8e6',line:'#795780',glow:'#75436a',ink:'#86416a'},
 {id:'elegant',name:'Elegant',symbol:'◇',background:'#192128',panel:'#27313a',accent:'#e3d4b3',muted:'#c5ccd2',line:'#59636c',glow:'#414956',ink:'#4d5660'},
] as const;
export function resolveTheme(id:unknown,version=1) {if(version!==1)return THEMES[0];return THEMES.find(t=>t.id===id)??THEMES[0];}
export const APPEARANCE_CLIENT = `
window.tambolaThemes=${JSON.stringify(THEMES)};
window.applyTambolaAppearance=function(game){
 const theme=window.tambolaThemes.find(t=>t.id===game.themeId&&game.themeVersion===1)||window.tambolaThemes[0],style=document.documentElement.style;
 document.documentElement.dataset.theme=theme.id;
 for(const [key,value] of Object.entries(theme))if(key!=='id'&&key!=='name'&&key!=='symbol')style.setProperty('--occasion-'+key,value);
 for(const brand of document.querySelectorAll('[data-occasion-brand]'))brand.textContent=theme.symbol+' '+theme.name;
 for(const welcome of document.querySelectorAll('[data-occasion-welcome]')){welcome.textContent=game.welcomeMessage||'';welcome.hidden=!game.welcomeMessage;}
};
`;
export const APPEARANCE_CSS = `
:root{--occasion-background:#10272b;--occasion-panel:#19383c;--occasion-accent:#f5d98a;--occasion-muted:#c0d4d3;--occasion-line:#466365;--occasion-glow:#345d60;--occasion-ink:#305b60;--gold:var(--occasion-accent);--line:var(--occasion-line);--panel:var(--occasion-panel);--muted:var(--occasion-muted)}
[data-theme=elegant] body:before{display:none}[data-theme=birthday] body:before{border:0;border-radius:12%;transform:rotate(25deg);box-shadow:0 0 0 25px #ffffff08,0 0 0 55px #ffffff08}[data-theme=classic] body:before{border-color:#ffffff20;box-shadow:0 0 0 55px #ffffff05}
[data-occasion-welcome]{overflow-wrap:anywhere;white-space:pre-wrap;max-height:3em;overflow:hidden}
.theme-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}.theme-choice{background:var(--preview-bg);color:var(--preview-accent);border:2px solid var(--preview-line);display:block;text-align:left;min-height:85px}.theme-choice[aria-pressed=true]{outline:3px solid var(--preview-accent);outline-offset:2px}.theme-choice small{display:block;color:inherit;margin-top:5px}.appearance-previews{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:18px 0}.appearance-preview{padding:12px 8px;background:var(--preview-bg);color:var(--preview-accent);border:1px solid var(--preview-line);border-radius:10px;overflow-wrap:anywhere;min-width:0}.appearance-preview strong{display:block;font-size:12px;margin:8px 0}.preview-numbers{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;font-size:12px;text-align:center}.preview-numbers span{border:1px solid currentColor;padding:4px}.preview-board{grid-template-columns:repeat(10,1fr);gap:1px}.preview-ticket{grid-template-columns:repeat(9,1fr);gap:1px}.preview-board span,.preview-ticket span{font-size:6px;padding:2px 0;min-height:9px}.appearance-preview.print-preview{background:white;color:var(--preview-ink);border-radius:0}.appearance-preview p{font-size:11px;margin:8px 0 0}.preview-caption{font-size:11px;font-weight:700}textarea{width:100%;padding:11px;color:inherit;background:var(--occasion-background);border:1px solid var(--line);border-radius:9px;resize:vertical}
`;
