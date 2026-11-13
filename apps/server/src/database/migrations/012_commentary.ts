export const COMMENTARY_MIGRATION = `
CREATE TABLE game_commentary_settings (
 game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
 enabled BOOLEAN NOT NULL DEFAULT FALSE,
 language TEXT NOT NULL DEFAULT 'en' CHECK(language IN ('en','hi')),
 tone TEXT NOT NULL DEFAULT 'warm' CHECK(tone IN ('warm','energetic','playful')),
 calls_every INTEGER NOT NULL DEFAULT 1 CHECK(calls_every BETWEEN 1 AND 10),
 shoutouts_every INTEGER NOT NULL DEFAULT 5 CHECK(shoutouts_every BETWEEN 0 AND 30),
 shoutout_mode TEXT NOT NULL DEFAULT 'mixed' CHECK(shoutout_mode IN ('mixed','leaders','few')),
 announce_winners BOOLEAN NOT NULL DEFAULT TRUE,
 family_friendly BOOLEAN NOT NULL DEFAULT TRUE,
 allow_sexual_references BOOLEAN NOT NULL DEFAULT FALSE,
 accent TEXT NOT NULL DEFAULT 'indian' CHECK(accent IN ('indian','us')),
 voice_provider TEXT NOT NULL DEFAULT 'browser' CHECK(voice_provider IN ('browser','elevenlabs')),
 voice_style TEXT NOT NULL DEFAULT 'standard' CHECK(voice_style IN ('standard','licensed')),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (NOT (family_friendly AND allow_sexual_references))
);
CREATE TABLE game_commentary_events (
 seq BIGSERIAL PRIMARY KEY,
 game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
 event_key TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('NUMBER','WINNER','SHOUTOUT')),
 language TEXT NOT NULL CHECK(language IN ('en','hi')),
 text TEXT NOT NULL DEFAULT '',
 audio BYTEA,
 status TEXT NOT NULL CHECK(status IN ('PROCESSING','READY')) DEFAULT 'PROCESSING',
 lease_until TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '30 seconds',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(game_id,event_key)
);
CREATE INDEX game_commentary_events_game_seq ON game_commentary_events(game_id,seq);
`;
