export const PARTY_READINESS_MIGRATION = `
ALTER TABLE players ADD COLUMN regeneration_count INTEGER NOT NULL DEFAULT 0
  CHECK (regeneration_count BETWEEN 0 AND 3);
UPDATE players p SET regeneration_count=LEAST(3, (
  SELECT count(*)::integer FROM tickets t
  WHERE t.player_id=p.id AND t.status='REVOKED'
    AND NOT EXISTS (SELECT 1 FROM ticket_reissue_history h WHERE h.old_ticket_id=t.id)
));

ALTER TABLE tickets ADD COLUMN eligible_from_sequence INTEGER NOT NULL DEFAULT 1
  CHECK (eligible_from_sequence BETWEEN 1 AND 90);

ALTER TABLE games ADD COLUMN review_claim_id UUID REFERENCES winner_claims(id);
ALTER TABLE games ADD COLUMN review_resume_after BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE tickets t SET status='SUBMITTED',submitted_at=NOW(),
  eligible_from_sequence=LEAST(g.next_number_sequence,90)
FROM games g, players p
WHERE t.game_id=g.id AND t.player_id=p.id AND t.status='ASSIGNED'
  AND p.approved AND g.started_at IS NOT NULL AND g.status IN ('RUNNING','PAUSED');

CREATE OR REPLACE FUNCTION tambola_notify_game_change() RETURNS trigger AS $$
DECLARE
  affected_game_id UUID;
BEGIN
  IF TG_OP='UPDATE' AND TG_TABLE_NAME='games' AND
    (to_jsonb(OLD)-'scheduler_remaining_seconds')=(to_jsonb(NEW)-'scheduler_remaining_seconds') THEN
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND TG_TABLE_NAME='sudden_death_rounds' AND
    (to_jsonb(OLD)-'paused_remaining_seconds')=(to_jsonb(NEW)-'paused_remaining_seconds') THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='games' THEN
    affected_game_id := CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    affected_game_id := CASE WHEN TG_OP='DELETE' THEN OLD.game_id ELSE NEW.game_id END;
  END IF;
  PERFORM pg_notify('tambola_game_changed',affected_game_id::text);
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;
