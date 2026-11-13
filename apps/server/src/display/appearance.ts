import { APPEARANCE_CATALOG, type ThemeLayers } from './appearance-catalog.js';

interface GameAppearance {
  themeId?: unknown;
  themeVersion?: number;
  themeLayers?: ThemeLayers;
  welcomeMessage?: string;
}

/** Pure resolver shared by the browser previews and the saved game surfaces. */
export function resolveAppearance(game: GameAppearance, catalog: typeof APPEARANCE_CATALOG) {
  const knownTheme = game.themeVersion === 1 ? catalog.themes.find(theme => theme.id === game.themeId) : undefined;
  const theme = knownTheme ?? catalog.themes[0];
  const layers = knownTheme ? game.themeLayers ?? {} : {};
  const palette = catalog.palettes.find(item => item.id === layers.palette)
    ?? catalog.palettes.find(item => item.id === theme.palette)!;
  const decor = catalog.decor.find(item => item.id === (layers.decor ?? theme.decor)) ?? catalog.decor[0];
  const corners = catalog.corners.find(item => item.id === (layers.corners ?? theme.corners)) ?? catalog.corners[0];

  function rgb(hex: string) {
    return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  }
  function mix(a: string, b: string, amount: number) {
    const other = rgb(b);
    return '#' + rgb(a).map((value, i) => Math.round(value + (other[i] - value) * amount).toString(16).padStart(2, '0')).join('');
  }
  function luminance(hex: string) {
    const [r, g, b] = rgb(hex).map(channel => {
      const value = channel / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    return .2126 * r + .7152 * g + .0722 * b;
  }
  function contrast(a: string, b: string) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }
  function readable(color: string, surfaces: string[], towards: string) {
    for (let step = 0; step < 20; step++) {
      const candidate = mix(color, towards, step / 20);
      if (surfaces.every(surface => contrast(candidate, surface) >= 4.5)) return candidate;
    }
    return towards;
  }

  const validHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  const accentChoice = validHex(layers.accent) ? layers.accent : palette.accent;
  const secondaryChoice = validHex(layers.secondary) ? layers.secondary : palette.secondary;
  const glow = mix(palette.background, palette.glow, decor.glow);
  const glowAlt = mix(palette.background, secondaryChoice, .14 * decor.glow);
  const panelTop = mix(palette.panel, secondaryChoice, .06 * decor.glow);
  const accent = readable(accentChoice, [palette.background, glow, glowAlt, panelTop], '#ffffff');
  const secondary = readable(secondaryChoice, [palette.panel, panelTop], '#ffffff');
  const ink = layers.print === 'mono'
    ? '#292929'
    : readable(validHex(layers.accent) ? accentChoice : palette.ink, ['#ffffff'], '#000000');

  return {
    themeId: theme.id,
    backdrop: layers.backdrop ?? theme.backdrop,
    printStyle: layers.print ?? 'color',
    accentChoice,
    secondaryChoice,
    tokens: {
      background: palette.background,
      panel: palette.panel,
      'panel-top': panelTop,
      accent,
      'on-accent': contrast(accent, '#161216') >= 4.5 ? '#161216' : '#ffffff',
      secondary,
      muted: palette.muted,
      line: palette.line,
      glow,
      'glow-alt': glowAlt,
      ink,
      'ticket-paper': mix('#ffffff', accent, .26),
      'decor-opacity': String(decor.opacity),
      'panel-radius': corners.panel,
      'control-radius': corners.control,
      'cell-radius': corners.cell,
    },
  };
}

const defaultAppearance = resolveAppearance({ themeId: 'classic', themeVersion: 1 }, APPEARANCE_CATALOG);
const defaultTokens = Object.entries(defaultAppearance.tokens).map(([key, value]) => '--occasion-' + key + ':' + value).join(';');

export const APPEARANCE_CLIENT = `
const tambolaAppearanceCatalog = ${JSON.stringify(APPEARANCE_CATALOG)};
const resolveAppearance = ${resolveAppearance.toString()};
window.resolveTambolaAppearance = game => resolveAppearance(game, tambolaAppearanceCatalog);
window.setTambolaAppearance = (element, appearance) => {
 element.dataset.theme = appearance.themeId;
 element.dataset.backdrop = appearance.backdrop;
 element.dataset.printStyle = appearance.printStyle;
 for (const [key,value] of Object.entries(appearance.tokens)) element.style.setProperty('--occasion-'+key,value);
};
window.applyTambolaAppearance = function(game){
 window.setTambolaAppearance(document.documentElement, window.resolveTambolaAppearance(game));
 for (const welcome of document.querySelectorAll('[data-occasion-welcome]')) {
  welcome.textContent = game.welcomeMessage || '';
  welcome.hidden = !game.welcomeMessage;
 }
};
`;

export const APPEARANCE_CSS = `
:root{${defaultTokens};--gold:var(--occasion-accent);--line:var(--occasion-line);--panel:var(--occasion-panel);--muted:var(--occasion-muted)}
[data-backdrop=plain]{--occasion-pattern:none}
[data-backdrop=halo]{--occasion-pattern:radial-gradient(circle at 88% 18%,transparent 0 74px,var(--occasion-secondary) 75px 76px,transparent 77px 105px,var(--occasion-accent) 106px 107px,transparent 108px 142px,var(--occasion-secondary) 143px 144px,transparent 145px)}
[data-backdrop=confetti]{--occasion-pattern:radial-gradient(circle,var(--occasion-secondary) 1px,transparent 2px) 0 0/43px 37px,radial-gradient(circle,var(--occasion-accent) 2px,transparent 3px) 17px 11px/79px 61px}
[data-backdrop=stars]{--occasion-pattern:radial-gradient(circle,var(--occasion-secondary) 1px,transparent 3px) 13px 23px/83px 91px,radial-gradient(circle,var(--occasion-accent) 1px,transparent 2px) 38px 8px/127px 99px}
[data-backdrop=lattice]{--occasion-pattern:repeating-linear-gradient(45deg,transparent 0 29px,var(--occasion-secondary) 30px 31px,transparent 32px 43px),repeating-linear-gradient(-45deg,transparent 0 29px,var(--occasion-secondary) 30px 31px,transparent 32px 43px)}
[data-backdrop=ribbons]{--occasion-pattern:repeating-linear-gradient(128deg,transparent 0 92px,var(--occasion-secondary) 93px 95px,transparent 96px 102px,var(--occasion-accent) 103px 104px,transparent 105px 124px)}
[data-backdrop=ripples]{--occasion-pattern:radial-gradient(ellipse at 9% 100%,transparent 0 80px,var(--occasion-accent) 81px 82px,transparent 83px 113px,var(--occasion-secondary) 114px 116px,transparent 117px 151px,var(--occasion-accent) 152px 154px,transparent 155px)}
[data-occasion-welcome]{overflow-wrap:anywhere;white-space:pre-wrap;max-height:3em;overflow:hidden}
.appearance-group{padding:0;border:0;margin:0 0 16px;min-width:0}
.appearance-group legend{font-size:14px;font-weight:750;color:var(--occasion-accent);margin-bottom:8px}
.theme-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,125px),1fr));gap:8px;max-height:256px;overflow:auto;padding:4px;overscroll-behavior:contain}
button.theme-choice{display:grid;grid-template-columns:auto minmax(0,1fr);align-content:center;justify-content:stretch;justify-items:start;gap:4px 8px;padding:9px 8px;text-align:left;min-width:0;min-height:63px;font-size:12px;background:var(--swatch-bg);color:var(--swatch-accent);border:1px solid var(--swatch-line)}
.theme-choice[aria-pressed=true]{outline:2px solid var(--swatch-accent);outline-offset:1px}
.theme-symbol{font-size:16px;line-height:1.1}
.theme-swatches{grid-column:2;display:flex;gap:4px}
.theme-swatches i{display:block;width:15px;height:4px;border-radius:4px;background:var(--swatch-accent)}
.theme-swatches i+i{background:var(--swatch-secondary)}
.appearance-settings{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,135px),1fr));gap:0 12px}
.appearance-settings label{margin:6px 0}
.appearance-settings input[type=color]{display:block;height:38px;padding:3px 5px}
.appearance-preview-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.appearance-preview-tabs [aria-pressed=true]{background:var(--occasion-accent);color:var(--occasion-on-accent)}
.appearance-preview{position:relative;isolation:isolate;min-width:0;padding:12px;border:1px solid var(--occasion-line);border-radius:var(--occasion-panel-radius);overflow:hidden;background:radial-gradient(ellipse at 90% 0,var(--occasion-glow),transparent 75%),var(--occasion-background);color:#fff3dc;font-size:12px}
.appearance-preview::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:var(--occasion-pattern,none);opacity:var(--occasion-decor-opacity)}
.preview-brand{color:var(--occasion-accent);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.preview-name{display:block;overflow-wrap:anywhere;margin:5px 0 8px;font-size:16px}
.preview-welcome{white-space:pre-wrap;overflow-wrap:anywhere;max-height:3em;overflow:hidden;color:var(--occasion-muted);margin:0 0 8px}
.preview-numbers{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:3px;text-align:center;font-variant-numeric:tabular-nums}
.preview-board{grid-template-columns:repeat(10,minmax(0,1fr))}
.preview-numbers span{display:grid;place-items:center;min-height:19px;border:1px solid var(--occasion-line);border-radius:var(--occasion-cell-radius);background:var(--occasion-panel);font-size:clamp(8px,2vw,11px)}
.preview-numbers .preview-hit{background:var(--occasion-accent);color:var(--occasion-on-accent)}
.preview-numbers .preview-latest{background:#00e5ff;color:#081d2a;border-color:white}
.preview-numbers .preview-filled{background:var(--occasion-ticket-paper);color:#402636}
.preview-phone .preview-numbers{max-width:380px}
.appearance-preview.print-preview{color:#251527;background:white;border:2px solid var(--occasion-ink);border-radius:0}
.print-preview::before{display:none}
.print-preview .preview-brand{color:var(--occasion-ink);border-bottom:1px solid var(--occasion-ink);padding-bottom:4px}
.print-preview .preview-numbers span{background:white;color:#251527;border-color:var(--occasion-ink);border-radius:0}
.print-preview .preview-numbers span:empty{background:#f1f1f1}
textarea{width:100%;padding:11px;color:inherit;background:var(--occasion-background);border:1px solid var(--line);border-radius:9px;resize:vertical}
`;
