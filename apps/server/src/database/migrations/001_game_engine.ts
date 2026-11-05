export const MILESTONE_2_MIGRATION = `
CREATE TABLE games (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED', 'RUNNING', 'PAUSED', 'COMPLETED')),
  interval_seconds INTEGER NOT NULL DEFAULT 300
    CHECK (interval_seconds BETWEEN 10 AND 86400),
  remaining_numbers SMALLINT[] NOT NULL,
  next_number_sequence INTEGER NOT NULL DEFAULT 1
    CHECK (next_number_sequence BETWEEN 1 AND 91),
  next_ticket_number INTEGER NOT NULL DEFAULT 1 CHECK (next_ticket_number > 0),
  next_call_at TIMESTAMPTZ,
  paused_remaining_seconds INTEGER CHECK (paused_remaining_seconds IS NULL OR paused_remaining_seconds >= 0),
  scheduler_remaining_seconds INTEGER CHECK (scheduler_remaining_seconds IS NULL OR scheduler_remaining_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CHECK (cardinality(remaining_numbers) BETWEEN 0 AND 90),
  CHECK (
    (status = 'RUNNING' AND next_call_at IS NOT NULL)
    OR (status <> 'RUNNING' AND next_call_at IS NULL)
  )
);

CREATE TABLE called_numbers (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  number SMALLINT NOT NULL CHECK (number BETWEEN 1 AND 90),
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 90),
  call_source TEXT NOT NULL CHECK (call_source IN ('SCHEDULED', 'MANUAL')),
  called_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, number),
  UNIQUE (game_id, sequence)
);

CREATE INDEX called_numbers_game_sequence_idx
  ON called_numbers (game_id, sequence);

CREATE TABLE tickets (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ticket_number INTEGER NOT NULL CHECK (ticket_number > 0),
  grid JSONB NOT NULL CHECK (jsonb_typeof(grid) = 'array'),
  numbers SMALLINT[] NOT NULL CHECK (cardinality(numbers) = 15),
  status TEXT NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'ASSIGNED', 'SUBMITTED', 'REVOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, ticket_number)
);

CREATE INDEX tickets_game_status_idx ON tickets (game_id, status);
`;
