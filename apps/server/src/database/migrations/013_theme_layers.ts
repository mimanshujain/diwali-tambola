export const THEME_LAYERS_MIGRATION = `
ALTER TABLE games ADD COLUMN theme_layers JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(theme_layers) = 'object');
`;
