/**
 * Transactional invalidation notifications: PostgreSQL emits a NOTIFY only
 * after the transaction commits. Multiple changes to a game in one transaction
 * coalesce into a single (channel, payload) notification.
 * No tickets, numbers, personal data or admin state are included in payloads.
 */
export const MILESTONE_7_MIGRATION = `
CREATE OR REPLACE FUNCTION tambola_notify_game_change() RETURNS trigger AS $$
DECLARE
  affected_game_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'games' THEN
    affected_game_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    affected_game_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.game_id ELSE NEW.game_id END;
  END IF;
  PERFORM pg_notify('tambola_game_changed', affected_game_id::text);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- All of these tables have a direct game_id except games (which has id).
-- Rounds notify on their own status/draw_sequence changes; each round draw
-- updates its parent round within the same game transaction.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'games', 'called_numbers', 'tickets', 'players',
    'winning_categories', 'category_eligibility', 'winner_claims',
    'category_outcomes', 'winners', 'sudden_death_rounds',
    'player_powers', 'power_requests', 'power_priority_windows'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tambola_live_change ON %I', table_name);
    EXECUTE format(
      'CREATE TRIGGER tambola_live_change AFTER INSERT OR UPDATE OR DELETE ON %I '
      || 'FOR EACH ROW EXECUTE FUNCTION tambola_notify_game_change()', table_name
    );
  END LOOP;
END;
$$;
`;
