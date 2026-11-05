export const MILESTONE_5_MIGRATION = `
CREATE TABLE player_powers (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','PENDING','USED')),
  used_at TIMESTAMPTZ,
  UNIQUE(player_id,game_id)
);
CREATE TABLE power_requests (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  requested_number SMALLINT NOT NULL CHECK(requested_number BETWEEN 1 AND 90),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  called_sequence INTEGER,
  UNIQUE(id,game_id)
);
CREATE UNIQUE INDEX one_pending_power_request ON power_requests(player_id) WHERE status='PENDING';
CREATE INDEX power_requests_admin_idx ON power_requests(game_id,status,created_at);
CREATE TABLE power_priority_windows (
  category_id UUID PRIMARY KEY REFERENCES winning_categories(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  power_request_id UUID NOT NULL REFERENCES power_requests(id),
  powered_player_id UUID NOT NULL REFERENCES players(id),
  call_sequence INTEGER NOT NULL CHECK(call_sequence BETWEEN 1 AND 90),
  closes_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE called_numbers DROP CONSTRAINT IF EXISTS called_numbers_call_source_check;
ALTER TABLE called_numbers ADD CONSTRAINT called_numbers_call_source_check
  CHECK(call_source IN ('SCHEDULED','MANUAL','SUPERPOWER'));
ALTER TABLE called_numbers ADD COLUMN power_request_id UUID REFERENCES power_requests(id);
CREATE UNIQUE INDEX called_numbers_one_power_request ON called_numbers(power_request_id)
  WHERE power_request_id IS NOT NULL;
`;
