export const COMMENTARY_DIAGNOSTICS_MIGRATION = `
ALTER TABLE game_commentary_events ADD COLUMN gemini_report JSONB;
`;
