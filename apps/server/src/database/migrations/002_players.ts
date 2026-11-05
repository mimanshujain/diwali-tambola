export const MILESTONE_3_MIGRATION = `
CREATE TABLE players (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  mobile TEXT NOT NULL CHECK (mobile ~ '^[0-9]{10,15}$'),
  device_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, mobile),
  UNIQUE (game_id, device_id),
  UNIQUE (id, game_id)
);

ALTER TABLE tickets ADD COLUMN player_id UUID;
ALTER TABLE tickets ADD COLUMN submitted_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN reissued_from_id UUID REFERENCES tickets(id);
ALTER TABLE tickets ADD CONSTRAINT tickets_player_game_fk
  FOREIGN KEY (player_id, game_id) REFERENCES players(id, game_id);
CREATE UNIQUE INDEX tickets_one_active_per_player
  ON tickets (player_id) WHERE player_id IS NOT NULL AND status IN ('ASSIGNED', 'SUBMITTED');
CREATE INDEX tickets_player_idx ON tickets (player_id, created_at DESC);

CREATE TABLE ticket_reissue_history (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  old_ticket_id UUID NOT NULL REFERENCES tickets(id),
  new_ticket_id UUID NOT NULL REFERENCES tickets(id),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 500),
  reissued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
