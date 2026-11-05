/**
 * Add stable short join codes to all games without changing the UUID primary key.
 * Existing games receive unique, deterministic base-32 codes. New games receive
 * cryptographically generated codes, protected by the same unique constraint.
 */
export const SHORT_GAME_CODE_MIGRATION = `
ALTER TABLE games ADD COLUMN IF NOT EXISTS join_code TEXT;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
  FROM games WHERE join_code IS NULL
), encoded AS (
  SELECT id, (
    SELECT string_agg(
      substr(
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
        ((floor((n + 1000000)::numeric / power(32, pos))::bigint % 32)::integer + 1),
        1
      ),
      '' ORDER BY pos DESC
    ) FROM generate_series(0, 5) AS pos
  ) AS code
  FROM numbered
)
UPDATE games AS g SET join_code = encoded.code
FROM encoded WHERE g.id = encoded.id;

ALTER TABLE games ADD CONSTRAINT games_join_code_format
  CHECK (join_code ~ '^[A-HJ-NP-Z2-9]{6}$');
ALTER TABLE games ALTER COLUMN join_code SET NOT NULL;
ALTER TABLE games ADD CONSTRAINT games_join_code_uq UNIQUE (join_code);
`;
