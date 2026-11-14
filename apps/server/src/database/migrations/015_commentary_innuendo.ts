export const COMMENTARY_INNUENDO_MIGRATION = `
ALTER TABLE game_commentary_settings ADD COLUMN innuendo_intensity SMALLINT NOT NULL DEFAULT 1
 CHECK (innuendo_intensity BETWEEN 1 AND 3);
`;
