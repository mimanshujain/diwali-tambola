import type { PoolClient } from 'pg';

export async function pauseForPlayerRequest(
  client: PoolClient, gameId: string, resumeAfterReview: boolean,
): Promise<void> {
  await client.query(`UPDATE games SET status='PAUSED',
    paused_remaining_seconds=CASE WHEN next_call_at IS NOT NULL THEN
      GREATEST(0,CEIL(EXTRACT(EPOCH FROM(next_call_at-clock_timestamp()))))::integer
      ELSE COALESCE(scheduler_remaining_seconds,interval_seconds) END,
    next_call_at=NULL,scheduler_remaining_seconds=NULL,review_resume_after=$2
    WHERE id=$1 AND status='RUNNING'`,[gameId,resumeAfterReview]);
  await client.query(`UPDATE sudden_death_rounds SET status='PAUSED',
    paused_remaining_seconds=CASE WHEN next_call_at IS NOT NULL THEN
      GREATEST(0,CEIL(EXTRACT(EPOCH FROM(next_call_at-clock_timestamp()))))::integer
      ELSE COALESCE(paused_remaining_seconds,interval_seconds) END,
    next_call_at=NULL WHERE game_id=$1 AND status='RUNNING'`,[gameId]);
}
