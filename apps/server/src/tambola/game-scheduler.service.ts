import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { TambolaService } from './tambola.service.js';

@Injectable()
export class GameSchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private lastCheckpointAt = 0;

  constructor(
    private readonly database: DatabaseService,
    private readonly tambola: TambolaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.database.query(`UPDATE games SET review_resume_after=false,recovered_at=NOW()
      WHERE review_resume_after=true`);
    // A server restart never silently consumes the downtime as game time.
    // Games that were RUNNING are restored as PAUSED using the last 5-second checkpoint.
    const recovered = await this.database.query(
      `UPDATE games
       SET status = 'PAUSED', recovered_at=NOW(),
           paused_remaining_seconds = COALESCE(
             scheduler_remaining_seconds,
             GREATEST(0, CEIL(EXTRACT(EPOCH FROM (next_call_at - NOW()))))::integer,
             interval_seconds
           ),
           scheduler_remaining_seconds = NULL,
           next_call_at = NULL
       WHERE status = 'RUNNING'`,
    );
    if ((recovered.rowCount ?? 0) > 0) {
      console.warn(`Recovered ${recovered.rowCount} active game(s) as PAUSED. Resume them from the admin controls.`);
    }

    this.lastCheckpointAt = Date.now();
    this.timer = setInterval(() => {
      void this.tick();
    }, 1_000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    // A graceful shutdown saves the most accurate remaining delay.
    await this.database.query(
      `UPDATE games
       SET status = 'PAUSED',
           paused_remaining_seconds = GREATEST(0, CEIL(EXTRACT(EPOCH FROM (next_call_at - NOW()))))::integer,
           scheduler_remaining_seconds = NULL,
           next_call_at = NULL
       WHERE status = 'RUNNING'`,
    );
  }

  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const dueGames = await this.database.query<{ id: string }>(
        `SELECT id FROM games
         WHERE status = 'RUNNING' AND next_call_at <= NOW()
         ORDER BY next_call_at
         LIMIT 10`,
      );

      for (const game of dueGames.rows) {
        try {
          await this.tambola.callScheduledNumber(game.id);
        } catch (error) {
          console.error(`Scheduled number call failed for game ${game.id}`, error);
        }
      }

      if (Date.now() - this.lastCheckpointAt >= 5_000) {
        await this.database.query(
          `UPDATE games
           SET scheduler_remaining_seconds =
             GREATEST(0, CEIL(EXTRACT(EPOCH FROM (next_call_at - NOW()))))::integer
           WHERE status = 'RUNNING' AND next_call_at IS NOT NULL`,
        );
        this.lastCheckpointAt = Date.now();
      }
    } catch (error) {
      console.error('Game scheduler tick failed', error);
    } finally {
      this.ticking = false;
    }
  }
}
