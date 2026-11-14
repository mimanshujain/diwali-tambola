import { THEME_LAYERS_MIGRATION } from './migrations/013_theme_layers.js';
import { COMMENTARY_MIGRATION } from './migrations/012_commentary.js';
import { GAME_APPEARANCE_MIGRATION } from './migrations/011_game_appearance.js';
import { cloudMode } from '../hosting/context.js';
import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { HOSTED_ACCOUNTS_MIGRATION } from './migrations/010_hosted_accounts.js';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { MILESTONE_2_MIGRATION } from './migrations/001_game_engine.js';
import { MILESTONE_3_MIGRATION } from './migrations/002_players.js';
import { MILESTONE_4_MIGRATION } from './migrations/003_winner_engine.js';
import { MILESTONE_4B_MIGRATION } from './migrations/004_sudden_death.js';
import { MILESTONE_5_MIGRATION } from './migrations/005_power.js';
import { MILESTONE_7_MIGRATION } from './migrations/006_live_updates.js';
import { PARTY_OPERATIONS_MIGRATION } from './migrations/008_party_operations.js';
import { SHORT_GAME_CODE_MIGRATION } from './migrations/007_short_game_codes.js';
import { PARTY_READINESS_MIGRATION } from './migrations/009_party_readiness.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  readonly pool: Pool;
  private readonly schedulerClient = new AsyncLocalStorage<PoolClient>();
  private readonly schedulerOwner = randomUUID();
  private savepoint = 0;
  private readonly lanRecovered = new Set<string>();
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
    return (this.schedulerClient.getStore() ?? this.pool).query<T>(text, values as any[]);
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const scoped = this.schedulerClient.getStore();
    if (scoped) {
      const name='scheduler_'+(++this.savepoint);
      await scoped.query('SAVEPOINT '+name);
      try {const result=await work(scoped);await scoped.query('RELEASE SAVEPOINT '+name);return result;}
      catch(error){await scoped.query('ROLLBACK TO SAVEPOINT '+name);throw error;}
    }
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

  /** Lease and scheduler effects commit together, fencing overlapping deployments. */
  async schedulerWork(name:string, recover:()=>Promise<void>, work:()=>Promise<void>, stop=false):Promise<void> {
    if(!cloudMode()) {
      if(!stop && !this.lanRecovered.has(name)){await recover();this.lanRecovered.add(name);}
      await work();return;
    }
    await this.transaction(async client => {
      const lease=(await client.query<{owner:string|null;expired:boolean}>(
        'SELECT owner,expires_at<NOW() AS expired FROM scheduler_leases WHERE name=$1 FOR UPDATE'+(stop?'':' SKIP LOCKED'),[name])).rows[0];
      if(!lease || (stop ? lease.owner!==this.schedulerOwner : lease.owner && lease.owner!==this.schedulerOwner && !lease.expired))return;
      const takeover=lease.owner!==this.schedulerOwner;
      await this.schedulerClient.run(client,async()=>{
        if(takeover && !stop)await recover();
        await work();
      });
      await client.query("UPDATE scheduler_leases SET owner=$2,expires_at=NOW()+INTERVAL '15 seconds' WHERE name=$1",[name,stop?null:this.schedulerOwner]);
    });
  }

  async onApplicationShutdown(): Promise<void> {
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
      const shortCode = await client.query('SELECT migration_id FROM schema_migrations WHERE migration_id=$1', ['007_short_game_codes']);
      if (shortCode.rowCount === 0) {
        await client.query(SHORT_GAME_CODE_MIGRATION);
        await client.query('INSERT INTO schema_migrations (migration_id) VALUES ($1)', ['007_short_game_codes']);
      }
      const operations = await client.query('SELECT 1 FROM schema_migrations WHERE migration_id=$1', ['008_party_operations']);
      if (!operations.rowCount) {
        await client.query(PARTY_OPERATIONS_MIGRATION);
        await client.query('INSERT INTO schema_migrations(migration_id) VALUES ($1)', ['008_party_operations']);
      }
      const readiness = await client.query('SELECT 1 FROM schema_migrations WHERE migration_id=$1', ['009_party_readiness']);
      if (!readiness.rowCount) {
        await client.query(PARTY_READINESS_MIGRATION);
        await client.query('INSERT INTO schema_migrations(migration_id) VALUES ($1)', ['009_party_readiness']);
      }
      const hosted = await client.query('SELECT 1 FROM schema_migrations WHERE migration_id=$1', ['010_hosted_accounts']);
      if (!hosted.rowCount) {
        await client.query(HOSTED_ACCOUNTS_MIGRATION);
        await client.query('INSERT INTO schema_migrations(migration_id) VALUES ($1)', ['010_hosted_accounts']);
      }
      const appearance = await client.query('SELECT 1 FROM schema_migrations WHERE migration_id=$1', ['011_game_appearance']);
      if (!appearance.rowCount) {
        await client.query(GAME_APPEARANCE_MIGRATION);
        await client.query('INSERT INTO schema_migrations(migration_id) VALUES ($1)', ['011_game_appearance']);
      }
      const commentary = await client.query('SELECT 1 FROM schema_migrations WHERE migration_id=$1', ['012_commentary']);
      if (!commentary.rowCount) {
        await client.query(COMMENTARY_MIGRATION);
        await client.query('INSERT INTO schema_migrations(migration_id) VALUES ($1)', ['012_commentary']);
      }
      const themeLayers = await client.query('SELECT 1 FROM schema_migrations WHERE migration_id=$1', ['013_theme_layers']);
      if (!themeLayers.rowCount) {
        await client.query(THEME_LAYERS_MIGRATION);
        await client.query('INSERT INTO schema_migrations(migration_id) VALUES ($1)', ['013_theme_layers']);
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
