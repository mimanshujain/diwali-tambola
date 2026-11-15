export const COMMENTARY_VOICE_DELIVERY_MIGRATION = `
ALTER TABLE game_commentary_settings ADD COLUMN voice_delivery TEXT NOT NULL DEFAULT 'fast'
 CHECK (voice_delivery IN ('fast', 'expressive'));
ALTER TABLE game_commentary_events ADD COLUMN voice_report JSONB;
`;
