export const COMMENTARY_VOICE_PROFILES_MIGRATION = `
ALTER TABLE game_commentary_settings ADD COLUMN voice_profile TEXT NOT NULL DEFAULT '';
`;
