export const GAME_APPEARANCE_MIGRATION = `
ALTER TABLE games ADD COLUMN theme_id TEXT NOT NULL DEFAULT 'diwali';
ALTER TABLE games ALTER COLUMN theme_id SET DEFAULT 'classic';
ALTER TABLE games ADD COLUMN theme_version INTEGER NOT NULL DEFAULT 1 CHECK(theme_version > 0);
ALTER TABLE games ADD COLUMN welcome_message TEXT NOT NULL DEFAULT '' CHECK(length(welcome_message)<=240);
`;
