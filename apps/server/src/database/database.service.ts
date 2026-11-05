import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { MILESTONE_2_MIGRATION } from './migrations/001_game_engine.js';
import { MILESTONE_3_MIGRATION } from './migrations/002_players.js';
import { MILESTONE_4_MIGRATION } from './migrations/003_winner_engine.js';
import { MILESTONE_4B_MIGRATION } from './migrations/004_sudden_death.js';
import { MILESTONE_5_MIGRATION } from './migrations/005_power.js';
import { MILESTONE_7_MIGRATION } from './migrations/006_live_updates.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly pool: Pool;
  private initialization: Promise<void> | null = null;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL must be configured');
    }

    this.pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 5_000,
      max: 8,
      idleTimeoutMillis: 30_000,
    });

    this.pool.on('error', (error: Error) => {
      console.error('Unexpected PostgreSQL pool error', error);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureReady();
  }

  async ping(): Promise<void> {
    await this.ensureReady();
    await this.pool.query('SELECT 1');
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    await this.ensureReady();
    return this.pool.query<T>(text, values as any[]);
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    await this.ensureReady();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private async ensureReady(): Promise<void> {
    this.initialization ??= this.runMigrations();
    await this.initialization;
  }

  private async runMigrations(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize migrations if two API containers are accidentally started together.
      await client.query('SELECT pg_advisory_xact_lock($1)', [73421986]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          migration_id TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      const migrationId = '001_game_engine';
      const existing = await client.query(
        'SELECT migration_id FROM schema_migrations WHERE migration_id = $1',
        [migrationId],
      );
      if (existing.rowCount === 0) {
        await client.query(MILESTONE_2_MIGRATION);
        await client.query(
          'INSERT INTO schema_migrations (migration_id) VALUES ($1)',
          [migrationId],
        );
      }

      const m3 = await client.query(
        'SELECT migration_id FROM schema_migrations WHERE migration_id = $1',
        ['002_players'],
      );
      if (m3.rowCount === 0) {
        await client.query(MILESTONE_3_MIGRATION);
        await client.query('INSERT INTO schema_migrations (migration_id) VALUES ($1)', ['002_players']);
      }
      const m4 = await client.query('SELECT migration_id FROM schema_migrations WHERE migration_id=$1', ['003_winner_engine']);
      if (m4.rowCount === 0) {
        await client.query(MILESTONE_4_MIGRATION);
        await client.query('INSERT INTO schema_migrations (migration_id) VALUES ($1)', ['003_winner_engine']);
      }
      const m4b = await client.query('SELECT migration_id FROM schema_migrations WHERE migration_id=$1', ['004_sudden_death']);
      if (m4b.rowCount === 0) {
        await client.query(MILESTONE_4B_MIGRATION);
        await client.query('INSERT INTO schema_migrations (migration_id) VALUES ($1)', ['004_sudden_death']);
      }
      const m5 = await client.query('SELECT migration_id FROM schema_migrations WHERE migration_id=$1', ['005_power']);
      if (m5.rowCount === 0) {
        await client.query(MILESTONE_5_MIGRATION);
        await client.query('INSERT INTO schema_migrations(migration_id) VALUES ($1)', ['005_power']);
      }
      const m7 = await client.query('SELECT migration_id FROM schema_migrations WHERE migration_id=$1', ['006_live_updates']);
      if (m7.rowCount === 0) {
        await client.query(MILESTONE_7_MIGRATION);
        await client.query('INSERT INTO schema_migrations (migration_id) VALUES ($1)', ['006_live_updates']);
      }
      await client.query('COMMIT');
      console.log('Database migrations are up to date.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
