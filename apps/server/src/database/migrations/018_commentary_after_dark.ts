export const COMMENTARY_AFTER_DARK_MIGRATION = `
ALTER TABLE game_commentary_settings
 DROP CONSTRAINT game_commentary_settings_innuendo_intensity_check,
 ADD CONSTRAINT game_commentary_settings_innuendo_intensity_check CHECK (innuendo_intensity BETWEEN 1 AND 4);
`;
