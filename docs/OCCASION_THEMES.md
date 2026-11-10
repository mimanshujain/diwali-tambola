# Occasion themes

New games default to **Classic Celebration**. Choose Classic Celebration, Diwali,
Birthday or Elegant when creating a game, or open **Appearance** in its host console.
Set an event name (1–100 characters) and an optional welcome message (240 characters).
The cards preview the palette for a TV board, phone ticket and printed ticket.
Save applies it to connected screens. Active or paused games require confirmation.
Unsaved edits remain intact during automatic refreshes.

The welcome message appears in the TV lobby and guest header. Final printed tickets
use the event name, theme label and a restrained accent on white paper. Printing
keeps the existing A4 layout, up to three tickets per page. Changing themes does
not change paper size, ticket numbers, calls, prize rules, voice or music settings.

Migration 011 assigns Diwali to existing games and Classic to new games. Appearance
is stored in PostgreSQL with theme version 1 and included in full and privacy-filtered
snapshots. Existing database notifications propagate changes. Unknown theme IDs or
unsupported versions render with Classic as a safe fallback. No external asset
service or additional runtime dependencies are required; this works on the Pi too.

## Extending the catalog

`apps/server/src/display/appearance.ts` owns the curated catalog, shared CSS and
browser application function. Use dark backgrounds with readable text and accents;
QR codes stay black on white, emergency controls stay red, called/latest-number
states retain their distinct colors. Add themes to the catalog rather than cloning
TV or guest pages. Keep immutable versions when future designs need to preserve
older games. Custom uploads, arbitrary CSS, language packs and theme-specific game
rules are outside this first release.

## Verification

The party rehearsal runs `tests/appearance.mjs`: four live themes, phone editing,
TV viewports from 540p to 4K, confirmation/cancellation during play, safe text,
unknown-theme fallback, restart persistence and themed A4 PDF. The migration test
checks existing games remain Diwali. Hosted rehearsal checks owner isolation for
appearance changes and public guest metadata. Run the commands in DEVELOPMENT.md.

For game narration and provider setup, see [COMMENTARY.md](COMMENTARY.md).
