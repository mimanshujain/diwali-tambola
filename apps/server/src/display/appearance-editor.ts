import { BACKDROPS, CORNERS, DECOR_LEVELS, PALETTES, PRINT_STYLES, THEMES } from './appearance-catalog.js';

function options(items: readonly { id: string; name: string }[]) {
  return items.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
}

const presets = THEMES.map(theme => {
  const palette = PALETTES.find(item => item.id === theme.palette)!;
  return `<button type="button" class="theme-choice" data-theme-choice="${theme.id}" aria-pressed="false"
    style="--swatch-bg:${palette.background};--swatch-accent:${palette.accent};--swatch-line:${palette.line};--swatch-secondary:${palette.secondary}">
    <span class="theme-symbol" aria-hidden="true">${theme.symbol}</span><span>${theme.name}</span>
    <span class="theme-swatches" aria-hidden="true"><i></i><i></i></span>
  </button>`;
}).join('');

const sampleTicket = [7, null, 24, null, 43, 52, null, 71, null, null, 15, 27, null, null, 57, 66, null, 84, 9, 19, null, 34, 48, null, null, 78, null];
const sampleHits = new Set([7, 15, 24, 34, 43, 52, 78]);
const previews = [
  { id: 'tv', label: 'TV board' },
  { id: 'phone', label: 'Phone ticket' },
  { id: 'print', label: 'Print' },
] as const;

export const appearanceFields = `
<label>Event name<input id="appearance-name" maxlength="100" required value="Tambola" placeholder="Tambola"></label>
<label>Welcome message (optional)<textarea id="appearance-welcome" maxlength="240" rows="2" placeholder="Welcome, everyone. Let’s play!"></textarea></label>
<fieldset class="appearance-group">
  <legend>Occasion preset <span class="small">· ${THEMES.length} options</span></legend>
  <div class="theme-options">${presets}</div>
</fieldset>
<fieldset class="appearance-group">
  <legend>Customize the theme</legend>
  <div class="appearance-settings">
    <label>Palette<select id="appearance-palette"><option value="">Preset palette</option>${options(PALETTES)}</select></label>
    <label>Backdrop<select id="appearance-backdrop"><option value="">Preset backdrop</option>${options(BACKDROPS)}</select></label>
    <label>Decoration intensity<select id="appearance-decor"><option value="">Preset intensity</option>${options(DECOR_LEVELS)}</select></label>
    <label>Corner style<select id="appearance-corners"><option value="">Preset corners</option>${options(CORNERS)}</select></label>
    <label>Primary accent<input type="color" id="appearance-accent"></label>
    <label>Secondary accent<input type="color" id="appearance-secondary"></label>
    <label>Print trim<select id="appearance-print">${options(PRINT_STYLES)}</select></label>
  </div>
  <p class="small">Custom accents are adjusted where needed for readability.</p>
  <div class="row">
    <button type="button" id="appearance-reset-colors" class="ghost small-button">Reset colors</button>
    <button type="button" id="appearance-reset" class="ghost small-button">Reset customizations</button>
  </div>
</fieldset>
<fieldset class="appearance-group">
  <legend>Preview</legend>
  <div class="appearance-preview-tabs" role="group" aria-label="Preview surface">
    ${previews.map(({id,label})=>`<button type="button" class="ghost small-button" data-preview-choice="${id}" aria-controls="appearance-preview-${id}" aria-pressed="${id==='tv'}">${label}</button>`).join('')}
  </div>
  <div id="appearance-previews">
    ${previews.map(({id,label}) => {
      const numbers = id==='tv' ? Array.from({length:90},(_,i)=>i+1) : sampleTicket;
      return `<div id="appearance-preview-${id}" data-preview-surface="${id}" class="appearance-preview preview-${id}${id==='print'?' print-preview':''}" aria-label="${label} preview"${id==='tv'?'':' hidden'}>
        <div class="preview-brand">Tambola</div>
        <strong class="preview-name" data-preview-name>Tambola</strong>
        ${id==='print'?'':`<p class="preview-welcome" data-preview-welcome hidden></p>`}
        <div class="preview-numbers ${id==='tv'?'preview-board':'preview-ticket'}">
          ${numbers.map(n=>`<span class="${id==='tv'?(n===43?'preview-latest':sampleHits.has(n!)?'preview-hit':''):id==='phone'&&n!==null?'preview-filled':''}">${n??''}</span>`).join('')}
        </div>
      </div>`;
    }).join('')}
  </div>
  <p class="small">Printed tickets use white paper with your chosen trim.</p>
</fieldset>
`;

export const appearanceEditorJs = String.raw`
let appearanceTheme='classic',appearanceLayers={},appearanceDirty=false,appearanceLoaded=false;
const appearanceSelects=['palette','backdrop','decor','corners','print'];
const appearanceColors=['accent','secondary'];
function previewAppearance(){
 const appearance=window.resolveTambolaAppearance({themeId:appearanceTheme,themeVersion:1,themeLayers:appearanceLayers});
 for(const panel of document.querySelectorAll('[data-preview-surface]'))window.setTambolaAppearance(panel,appearance);
 for(const choice of document.querySelectorAll('[data-theme-choice]'))choice.setAttribute('aria-pressed',String(choice.dataset.themeChoice===appearanceTheme));
 for(const name of document.querySelectorAll('[data-preview-name]'))name.textContent=$('#appearance-name').value.trim()||'Tambola';
 const message=$('#appearance-welcome').value;
 for(const welcome of document.querySelectorAll('[data-preview-welcome]')){
  welcome.textContent=message;
  welcome.hidden=!message;
 }
 $('#appearance-accent').value=appearance.accentChoice;
 $('#appearance-secondary').value=appearance.secondaryChoice;
}
function updateAppearanceControls(){
 for(const key of appearanceSelects)$('#appearance-'+key).value=appearanceLayers[key]||(key==='print'?'color':'');
 previewAppearance();
}
function changeAppearance(){
 appearanceDirty=true;
 previewAppearance();
}
for(const choice of document.querySelectorAll('[data-theme-choice]'))choice.onclick=()=>{
 appearanceTheme=choice.dataset.themeChoice;
 changeAppearance();
};
for(const key of appearanceSelects){
 const select=$('#appearance-'+key);
 select.addEventListener('change',()=>{
  if(select.value&&(key!=='print'||select.value!=='color'))appearanceLayers[key]=select.value;
  else delete appearanceLayers[key];
  changeAppearance();
 });
}
for(const key of appearanceColors){
 const picker=$('#appearance-'+key);
 picker.addEventListener('input',()=>{appearanceLayers[key]=picker.value;changeAppearance();});
}
for(const input of [$('#appearance-name'),$('#appearance-welcome')])input.addEventListener('input',changeAppearance);
$('#appearance-reset-colors').onclick=()=>{
 delete appearanceLayers.accent;
 delete appearanceLayers.secondary;
 changeAppearance();
};
$('#appearance-reset').onclick=()=>{
 appearanceLayers={};
 appearanceDirty=true;
 updateAppearanceControls();
};
for(const choice of document.querySelectorAll('[data-preview-choice]'))choice.onclick=()=>{
 for(const button of document.querySelectorAll('[data-preview-choice]'))button.setAttribute('aria-pressed',String(button===choice));
 for(const panel of document.querySelectorAll('[data-preview-surface]'))panel.hidden=panel.dataset.previewSurface!==choice.dataset.previewChoice;
};
function appearancePayload(){
 return {name:$('#appearance-name').value,themeId:appearanceTheme,themeLayers:appearanceLayers,welcomeMessage:$('#appearance-welcome').value};
}
function loadAppearance(game){
 window.applyTambolaAppearance(game);
 if(appearanceDirty&&appearanceLoaded)return;
 appearanceLoaded=true;
 appearanceTheme=game.themeId||'classic';
 appearanceLayers={...game.themeLayers};
 $('#appearance-name').value=game.name;
 $('#appearance-welcome').value=game.welcomeMessage||'';
 updateAppearanceControls();
}
updateAppearanceControls();
`;
