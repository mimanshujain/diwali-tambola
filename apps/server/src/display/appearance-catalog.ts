/** Dark palettes keep the TV board legible across occasions. */
export const PALETTES = [
  { id: 'lagoon', name: 'Teal & gold', background: '#10272b', panel: '#19383c', accent: '#f5d98a', secondary: '#79d9c1', muted: '#c0d4d3', line: '#466365', glow: '#345d60', ink: '#305b60' },
  { id: 'amethyst', name: 'Plum & amber', background: '#190f24', panel: '#2a192e', accent: '#ffcf78', secondary: '#f597bd', muted: '#ccb9c5', line: '#664359', glow: '#673144', ink: '#89551e' },
  { id: 'rose', name: 'Berry & pink', background: '#271630', panel: '#3d2446', accent: '#ffb8dc', secondary: '#c9a1ff', muted: '#dec8e6', line: '#795780', glow: '#75436a', ink: '#86416a' },
  { id: 'slate', name: 'Slate & champagne', background: '#192128', panel: '#27313a', accent: '#e3d4b3', secondary: '#b4c7de', muted: '#c5ccd2', line: '#59636c', glow: '#414956', ink: '#4d5660' },
  { id: 'marigold', name: 'Wine & marigold', background: '#2b1018', panel: '#421c28', accent: '#ffd58d', secondary: '#ff96a0', muted: '#edd0d3', line: '#82545b', glow: '#623146', ink: '#862746' },
  { id: 'prism', name: 'Indigo & coral', background: '#1c1734', panel: '#2d2448', accent: '#ffc1a6', secondary: '#90f3d6', muted: '#e0d3f6', line: '#6a5a8d', glow: '#523f6f', ink: '#704265' },
  { id: 'jade', name: 'Jade & mint', background: '#102920', panel: '#1b3c30', accent: '#b7f4ce', secondary: '#ffde92', muted: '#c4decc', line: '#547660', glow: '#345c44', ink: '#32604a' },
  { id: 'pine', name: 'Pine & cranberry', background: '#12251c', panel: '#20382b', accent: '#fbe0ae', secondary: '#ff9f9a', muted: '#d1dfcf', line: '#556f58', glow: '#445941', ink: '#8a3b43' },
  { id: 'midnight', name: 'Midnight & silver', background: '#111c31', panel: '#1c2d45', accent: '#d0e5ff', secondary: '#e2c3ff', muted: '#c7d6eb', line: '#4a6382', glow: '#344b74', ink: '#395582' },
  { id: 'ember', name: 'Charcoal & pumpkin', background: '#24191b', panel: '#39282b', accent: '#ffc080', secondary: '#ff957a', muted: '#e5cfcb', line: '#795851', glow: '#673b33', ink: '#864521' },
  { id: 'electric', name: 'Navy & lime', background: '#152235', panel: '#24374d', accent: '#ddf89f', secondary: '#9bd7ff', muted: '#cfdeeb', line: '#506d83', glow: '#304d64', ink: '#365d47' },
  { id: 'blossom', name: 'Forest & blush', background: '#202b25', panel: '#2d4137', accent: '#ffd1ce', secondary: '#c6e69e', muted: '#d7e3d3', line: '#627862', glow: '#475c47', ink: '#75474c' },
] as const;

export const BACKDROPS = [
  { id: 'plain', name: 'Plain' },
  { id: 'halo', name: 'Halos' },
  { id: 'confetti', name: 'Confetti' },
  { id: 'stars', name: 'Stars' },
  { id: 'lattice', name: 'Lattice' },
  { id: 'ribbons', name: 'Ribbons' },
  { id: 'ripples', name: 'Ripples' },
] as const;

export const DECOR_LEVELS = [
  { id: 'quiet', name: 'Subtle', opacity: .10, glow: .62 },
  { id: 'balanced', name: 'Balanced', opacity: .18, glow: 1 },
  { id: 'vivid', name: 'Vivid', opacity: .29, glow: 1 },
] as const;

export const CORNERS = [
  { id: 'soft', name: 'Soft', panel: '17px', control: '11px', cell: '7px' },
  { id: 'crisp', name: 'Crisp', panel: '7px', control: '5px', cell: '3px' },
  { id: 'round', name: 'Rounded', panel: '23px', control: '22px', cell: '12px' },
] as const;

export const PRINT_STYLES = [
  { id: 'color', name: 'Color trim' },
  { id: 'mono', name: 'Black and white' },
] as const;

type PaletteId = typeof PALETTES[number]['id'];
type BackdropId = typeof BACKDROPS[number]['id'];
type DecorId = typeof DECOR_LEVELS[number]['id'];
type CornerId = typeof CORNERS[number]['id'];
type PrintId = typeof PRINT_STYLES[number]['id'];

interface Theme {
  id: string;
  name: string;
  symbol: string;
  palette: PaletteId;
  backdrop: BackdropId;
  decor: DecorId;
  corners: CornerId;
}

// Existing IDs are kept so saved games continue to resolve their presets.
export const THEMES = [
  { id: 'classic', name: 'Classic Celebration', symbol: '✦', palette: 'lagoon', backdrop: 'halo', decor: 'quiet', corners: 'soft' },
  { id: 'elegant', name: 'Elegant', symbol: '◇', palette: 'slate', backdrop: 'plain', decor: 'quiet', corners: 'crisp' },
  { id: 'birthday', name: 'Birthday', symbol: '✺', palette: 'rose', backdrop: 'confetti', decor: 'balanced', corners: 'round' },
  { id: 'wedding', name: 'Wedding', symbol: '❦', palette: 'marigold', backdrop: 'lattice', decor: 'balanced', corners: 'soft' },
  { id: 'garden-party', name: 'Garden Party', symbol: '❀', palette: 'blossom', backdrop: 'ripples', decor: 'quiet', corners: 'round' },
  { id: 'game-night', name: 'Game Night', symbol: '✜', palette: 'electric', backdrop: 'ribbons', decor: 'balanced', corners: 'crisp' },
  { id: 'team-social', name: 'Team Social', symbol: '◈', palette: 'midnight', backdrop: 'ribbons', decor: 'quiet', corners: 'soft' },
  { id: 'diwali', name: 'Diwali', symbol: '🪔', palette: 'amethyst', backdrop: 'halo', decor: 'balanced', corners: 'soft' },
  { id: 'holi', name: 'Holi', symbol: '✸', palette: 'prism', backdrop: 'confetti', decor: 'vivid', corners: 'round' },
  { id: 'navratri', name: 'Navratri', symbol: '❋', palette: 'marigold', backdrop: 'ribbons', decor: 'vivid', corners: 'round' },
  { id: 'eid', name: 'Eid', symbol: '☾', palette: 'jade', backdrop: 'lattice', decor: 'quiet', corners: 'soft' },
  { id: 'christmas', name: 'Christmas', symbol: '❄', palette: 'pine', backdrop: 'stars', decor: 'balanced', corners: 'soft' },
  { id: 'new-year', name: 'New Year', symbol: '✷', palette: 'midnight', backdrop: 'stars', decor: 'vivid', corners: 'crisp' },
  { id: 'halloween', name: 'Halloween', symbol: '◆', palette: 'ember', backdrop: 'ripples', decor: 'balanced', corners: 'crisp' },
] as const satisfies readonly Theme[];

export interface ThemeLayers {
  palette?: PaletteId;
  accent?: string;
  secondary?: string;
  backdrop?: BackdropId;
  decor?: DecorId;
  corners?: CornerId;
  print?: PrintId;
}

const choices = {
  palette: PALETTES.map(option => option.id),
  backdrop: BACKDROPS.map(option => option.id),
  decor: DECOR_LEVELS.map(option => option.id),
  corners: CORNERS.map(option => option.id),
  print: PRINT_STYLES.map(option => option.id),
} satisfies Record<string, readonly string[]>;

export function parseThemeLayers(input: unknown): ThemeLayers | null {
  if (input === undefined) return {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const layers: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string') return null;
    if (key === 'accent' || key === 'secondary') {
      if (!/^#[0-9a-f]{6}$/i.test(value)) return null;
      layers[key] = value.toLowerCase();
    } else {
      if (!Object.hasOwn(choices, key) || !(choices[key as keyof typeof choices] as readonly string[]).includes(value)) return null;
      layers[key] = value;
    }
  }
  return layers as ThemeLayers;
}

export function resolveTheme(id: unknown, version = 1) {
  return version === 1 ? THEMES.find(theme => theme.id === id) ?? THEMES[0] : THEMES[0];
}

export const APPEARANCE_CATALOG = { themes: THEMES, palettes: PALETTES, decor: DECOR_LEVELS, corners: CORNERS };
