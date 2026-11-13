# Occasion themes

Tambola is the app name on the host desk, TV, phone and printed ticket. Set a
separate event name and optional welcome message for each game. The welcome
message appears in the TV lobby and on the guest page.

Choose a starting preset when creating a game or open **Appearance** in its
host console. Presets include Classic Celebration, Elegant, Birthday, Wedding,
Garden Party, Game Night, Team Social, Diwali, Holi, Navratri, Eid, Christmas,
New Year and Halloween.

Mix the preset with any of the 12 palettes, or pick your own primary and
secondary accents. Choose a plain, halo, confetti, stars, lattice, ribbons or
ripples backdrop, set the decoration intensity, and choose soft, crisp or
rounded corners. The app adjusts custom accents for contrast on dark screens
and on white paper. **Reset colors** returns the two accents to the selected
palette. **Reset customizations** restores all defaults for the selected preset.

Switch between **TV board**, **Phone ticket** and **Print** to preview your
choices before saving. Print uses either color trim or black and white, with
the current A4 layout of up to three tickets per page. Save applies the
appearance to connected screens. Running or paused games require confirmation.
Unsaved edits stay in the editor during automatic refreshes.

Presets and overrides are saved per game in PostgreSQL. Migration 013 adds the
override field with an empty default, so existing games retain their event
names and presets. Unknown presets or unsupported theme versions use Classic.
The same appearance resolver drives previews, the live screens and printing.

The catalog lives in `apps/server/src/display/appearance-catalog.ts`. Add new
presets there and use the shared theme tokens for their colors. Keep number
states, emergency actions and QR contrast distinct so the board stays readable.

The party rehearsal checks customization, contrast, live updates, phone and TV
layouts, persistence and A4 output. See [DEVELOPMENT.md](DEVELOPMENT.md) for the
test commands and [COMMENTARY.md](COMMENTARY.md) for narration setup.
