export const PARTY_OPERATIONS_MIGRATION = `
ALTER TABLE games ADD COLUMN emergency_stopped BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE games ADD COLUMN ended_by_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE games ADD COLUMN recovered_at TIMESTAMPTZ;
ALTER TABLE players ALTER COLUMN mobile DROP NOT NULL;
ALTER TABLE players ADD COLUMN approved BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE players ADD COLUMN recovery_hash TEXT UNIQUE;

-- Keep existing tickets intact. Legacy conflicts are reported and block starting play.
-- New writes are serialized per game, including writes outside the application.
CREATE INDEX tickets_game_numbers_idx ON tickets(game_id,numbers) WHERE status <> 'REVOKED';
CREATE FUNCTION tambola_unique_ticket() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM games WHERE id=NEW.game_id FOR UPDATE;
  NEW.numbers := ARRAY(SELECT unnest(NEW.numbers) ORDER BY 1);
  IF NEW.status <> 'REVOKED' AND EXISTS (
    SELECT 1 FROM tickets WHERE game_id=NEW.game_id AND id<>NEW.id
      AND status<>'REVOKED' AND numbers=NEW.numbers
  ) THEN
    RAISE EXCEPTION 'Ticket number set already exists in this game' USING ERRCODE='23505',CONSTRAINT='tickets_unique_numbers';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER ticket_number_set_guard BEFORE INSERT OR UPDATE OF numbers,status,game_id ON tickets
  FOR EACH ROW EXECUTE FUNCTION tambola_unique_ticket();

ALTER TABLE winning_categories DROP CONSTRAINT winning_categories_rule_type_check;
ALTER TABLE winning_categories ADD CONSTRAINT winning_categories_rule_type_check CHECK(rule_type IN (
 'EARLY_FIVE','EARLY_SEVEN','EARLY_TEN','FOUR_CORNERS','TOP_LINE','MIDDLE_LINE','BOTTOM_LINE',
 'TWO_LINES','ALL_ODD','ALL_EVEN','FULL_HOUSE','SECOND_FULL_HOUSE'));
ALTER TABLE winning_categories DROP CONSTRAINT winning_categories_game_id_rule_type_key;
CREATE UNIQUE INDEX categories_house_rule_uq ON winning_categories(game_id,rule_type)
  WHERE rule_type IN ('FULL_HOUSE','SECOND_FULL_HOUSE');
ALTER TABLE winning_categories ADD COLUMN prize_description TEXT NOT NULL DEFAULT '' CHECK(length(prize_description)<=200);

CREATE TABLE game_events (
 id BIGSERIAL PRIMARY KEY, game_id UUID NOT NULL REFERENCES games(id),
 action TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX game_events_game_idx ON game_events(game_id,id DESC);
CREATE FUNCTION tambola_audit_game() RETURNS trigger AS $$
BEGIN
 IF OLD.status IS DISTINCT FROM NEW.status OR OLD.interval_seconds IS DISTINCT FROM NEW.interval_seconds
 OR OLD.emergency_stopped IS DISTINCT FROM NEW.emergency_stopped OR OLD.next_call_at IS DISTINCT FROM NEW.next_call_at THEN
   INSERT INTO game_events(game_id,action,details) VALUES(NEW.id,'GAME_UPDATED',jsonb_build_object(
     'from',OLD.status,'to',NEW.status,'stopped',NEW.emergency_stopped,'intervalSeconds',NEW.interval_seconds,
     'nextCallAt',NEW.next_call_at,'endedByAdmin',NEW.ended_by_admin));
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER game_audit AFTER UPDATE ON games FOR EACH ROW EXECUTE FUNCTION tambola_audit_game();
`;
