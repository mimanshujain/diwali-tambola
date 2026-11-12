export const HOSTED_ACCOUNTS_MIGRATION = `
CREATE TABLE hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE games ADD COLUMN host_id UUID REFERENCES hosts(id);
CREATE INDEX games_host_created_idx ON games(host_id,created_at DESC);
CREATE TABLE host_sessions (
  token_hash TEXT PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX host_sessions_expiry_idx ON host_sessions(expires_at);
CREATE TABLE oauth_attempts (
  state_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE display_access (
  token_hash TEXT PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('PAIR','SESSION')),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX display_access_game_idx ON display_access(game_id);
CREATE TABLE scheduler_leases (
  name TEXT PRIMARY KEY,
  owner UUID,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO scheduler_leases(name) VALUES ('game'),('sudden-death');
`;
