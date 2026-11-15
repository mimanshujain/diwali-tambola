import { sitePalette } from '../onboarding/site-palette.js';

export const hostThemeCss = `
:root {
  ${sitePalette}
  color-scheme:light;
  background:var(--paper);
  font-family:var(--site-sans);
  --occasion-background:var(--paper);
  --occasion-panel:var(--card);
  --occasion-panel-top:var(--card);
  --occasion-line:var(--border);
  --occasion-muted:var(--muted);
  --occasion-accent:var(--plum);
  --occasion-on-accent:#fffdf9;
  --occasion-panel-radius:14px;
  --occasion-control-radius:8px;
  --line:var(--border);
  --panel:var(--card);
  --teal:var(--green);
}
body.host-workspace { background:var(--paper); color:var(--ink); }
body.host-workspace::before { display:none; }
.host-workspace h1, .host-workspace h2 { font-family:var(--site-serif); font-weight:500; }
.host-workspace h1, .host-workspace h2, .host-workspace h3 { color:var(--ink); }
.host-workspace a { color:var(--accent); }
.host-workspace :focus-visible { outline-color:var(--focus); }
.host-workspace input:not([type=checkbox]):not([type=range]):not([type=color]),
.host-workspace select, .host-workspace textarea { background:var(--input); border-color:var(--label-border); color:var(--ink); }
.host-workspace button.ghost, .host-workspace .button.ghost {
  background:var(--input); border-color:var(--border); color:var(--plum);
}
.host-workspace a.button:not(.ghost) { color:var(--occasion-on-accent); }
.host-workspace button:not([class]), .host-workspace .button:not(.ghost) { background:var(--plum); }
.host-workspace button:not([class]):hover, .host-workspace .button:not(.ghost):hover { background:var(--plum-hover); }
.host-workspace .workspace-header { background:var(--paper); }
.host-workspace .workspace-brand .brand, .host-workspace .workspace-brand { color:var(--ink); }
.host-workspace .brand-mark { background:var(--gold); color:var(--plum); }
.host-workspace .account-avatar { background:var(--accent-tint); color:var(--plum); }
.host-workspace .view-link { color:var(--muted); }
.host-workspace .view-link[aria-current], .host-workspace .view-link:hover { color:var(--plum); }
.host-workspace .nav-icon, .host-workspace .code, .host-workspace .metric strong { color:var(--accent); }
.host-workspace .nav-count { background:var(--gold); color:var(--plum); }
.host-workspace .notice { background:#fff0d8; color:#5c3809; border-color:#d5a663; }
.host-workspace .pill, .host-workspace .badge, .host-workspace details > summary:after { color:var(--plum); }
.host-workspace [data-state=running], .host-workspace [data-state=submitted] { color:var(--green); }
.host-workspace [data-state=stopped] { color:#852a3c; }
.host-workspace .draw-stat .status-number, .host-workspace .draw-stat .clock { color:var(--plum); }
.host-workspace .ball-chip.is-called { color:var(--plum); }
.host-workspace .ball-chip.is-latest { background:var(--plum); color:var(--occasion-on-accent); }
.host-workspace .appearance-preview-tabs button[aria-pressed=true] { background:var(--plum); color:var(--occasion-on-accent); }
.host-workspace .host-guide, .host-workspace .print-dialog { color:var(--ink); }
.host-workspace .print-option { color:var(--ink); }
.host-workspace .print-dialog::backdrop, .host-workspace .host-guide::backdrop { background:#291d296b; }
`;
