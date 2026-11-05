export const MILESTONE_4B_MIGRATION = `
CREATE TABLE sudden_death_rounds (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  category_id UUID NOT NULL UNIQUE REFERENCES winning_categories(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PAUSED' CHECK (status IN ('PAUSED','RUNNING','RESOLVED')),
  interval_seconds INTEGER NOT NULL CHECK (interval_seconds BETWEEN 2 AND 300),
  ticket_size INTEGER NOT NULL CHECK (ticket_size BETWEEN 1 AND 15),
  remaining_numbers SMALLINT[] NOT NULL,
  draw_sequence INTEGER NOT NULL DEFAULT 0 CHECK (draw_sequence BETWEEN 0 AND 90),
  next_call_at TIMESTAMPTZ,
  paused_remaining_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT round_timer_consistency CHECK (
    (status = 'RUNNING' AND next_call_at IS NOT NULL) OR
    (status <> 'RUNNING' AND next_call_at IS NULL)
  )
);
CREATE TABLE sudden_death_entries (
  round_id UUID NOT NULL REFERENCES sudden_death_rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  numbers SMALLINT[] NOT NULL,
  PRIMARY KEY(round_id, player_id),
  UNIQUE(round_id, ticket_id)
);
CREATE TABLE sudden_death_calls (
  round_id UUID NOT NULL REFERENCES sudden_death_rounds(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 90),
  number SMALLINT NOT NULL CHECK (number BETWEEN 1 AND 90),
  called_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(round_id, sequence),
  UNIQUE(round_id, number)
);
CREATE INDEX sudden_death_due_idx ON sudden_death_rounds(next_call_at) WHERE status='RUNNING';
`;

