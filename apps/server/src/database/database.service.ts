import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL must be configured');
    }

    this.pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 5_000,
      max: 5,
      idleTimeoutMillis: 30_000,
    });

    this.pool.on('error', (error: Error) => {
      console.error('Unexpected PostgreSQL pool error', error);
    });
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
