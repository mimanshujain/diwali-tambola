export const MILESTONE_4_MIGRATION = `
CREATE TABLE winning_categories (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('EARLY_FIVE','FOUR_CORNERS','TOP_LINE','MIDDLE_LINE','BOTTOM_LINE','FULL_HOUSE','SECOND_FULL_HOUSE')),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  max_winners INTEGER NOT NULL DEFAULT 1 CHECK(max_winners BETWEEN 1 AND 100),
  tie_break_policy TEXT NOT NULL DEFAULT 'SHARED_PRIZE' CHECK(tie_break_policy IN ('SHARED_PRIZE','SUDDEN_DEATH')),
  sudden_death_interval_seconds INTEGER NOT NULL DEFAULT 10 CHECK(sudden_death_interval_seconds BETWEEN 2 AND 300),
  sudden_death_ticket_size INTEGER NOT NULL DEFAULT 5 CHECK(sudden_death_ticket_size BETWEEN 1 AND 15),
  UNIQUE(game_id,rule_type), UNIQUE(id,game_id)
);
CREATE TABLE category_eligibility (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL,
  category_id UUID NOT NULL,
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  player_id UUID NOT NULL REFERENCES players(id),
  first_eligible_sequence INTEGER NOT NULL CHECK(first_eligible_sequence BETWEEN 1 AND 90),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(category_id,game_id) REFERENCES winning_categories(id,game_id),
  UNIQUE(category_id,ticket_id)
);
CREATE INDEX category_eligibility_game_idx ON category_eligibility(game_id,category_id,first_eligible_sequence);
CREATE TABLE winner_claims (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id),
  category_id UUID NOT NULL REFERENCES winning_categories(id),
  player_id UUID NOT NULL REFERENCES players(id),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  first_eligible_sequence INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','VALID','REJECTED')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(category_id,ticket_id)
);
CREATE TABLE category_outcomes (
  category_id UUID PRIMARY KEY REFERENCES winning_categories(id),
  game_id UUID NOT NULL REFERENCES games(id),
  tie_break_policy TEXT NOT NULL,
  resolved_sequence INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'RESOLVED' CHECK(status IN ('RESOLVED','SUDDEN_DEATH_PENDING')),
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE winners (
  id UUID PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES winning_categories(id),
  game_id UUID NOT NULL REFERENCES games(id),
  player_id UUID NOT NULL REFERENCES players(id),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category_id,player_id)
);
INSERT INTO winning_categories(id,game_id,rule_type,name,max_winners)
SELECT gen_random_uuid(),g.id,category.rule_type,category.name,category.max_winners
FROM games g CROSS JOIN (VALUES
 ('EARLY_FIVE','Early Five',1),('FOUR_CORNERS','Four Corners',1),
 ('TOP_LINE','Top Line',1),('MIDDLE_LINE','Middle Line',1),('BOTTOM_LINE','Bottom Line',1),
 ('FULL_HOUSE','Full House',1),('SECOND_FULL_HOUSE','Second Full House',1)
) AS category(rule_type,name,max_winners)
ON CONFLICT (game_id,rule_type) DO NOTHING;
`;
