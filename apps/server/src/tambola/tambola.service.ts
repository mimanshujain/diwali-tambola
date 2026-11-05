import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { createShuffledNumbers } from './domain/draw-sequence.js';
import { generateTambolaTicket, type TicketGrid } from './domain/ticket-generator.js';
import { WinnersService } from '../winners/winners.service.js';

export type GameStatus = 'CREATED' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
export type CallSource = 'SCHEDULED' | 'MANUAL' | 'SUPERPOWER';

interface GameRow extends QueryResultRow {
  id: string;
  name: string;
  status: GameStatus;
  interval_seconds: number;
  remaining_numbers: number[];
  next_number_sequence: number;
  next_ticket_number: number;
  next_call_at: Date | null;
  paused_remaining_seconds: number | null;
  scheduler_remaining_seconds: number | null;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

interface CreateGameInput {
  name?: unknown;
  intervalSeconds?: unknown;
}

export interface CalledNumber {
  id: string;
  gameId: string;
  number: number;
  sequence: number;
  source: CallSource;
  calledAt: Date;
}

@Injectable()
export class TambolaService {
  constructor(private readonly database: DatabaseService) {}

  async createGame(input: CreateGameInput): Promise<Record<string, unknown>> {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (name.length < 1 || name.length > 100) {
      throw new BadRequestException('Game name must contain between 1 and 100 characters.');
    }

    const intervalSeconds = input.intervalSeconds === undefined ? 300 : Number(input.intervalSeconds);
    if (!Number.isInteger(intervalSeconds) || intervalSeconds < 10 || intervalSeconds > 86400) {
      throw new BadRequestException('intervalSeconds must be an integer between 10 and 86400.');
    }

    const id = randomUUID();
    await this.database.query(
      `INSERT INTO games (id, name, interval_seconds, remaining_numbers)
       VALUES ($1::uuid, $2, $3, $4::smallint[])`,
      [id, name, intervalSeconds, createShuffledNumbers()],
    );
    await this.database.query(`INSERT INTO winning_categories(id,game_id,rule_type,name)
      SELECT gen_random_uuid(),$1,rule_type,name FROM (VALUES
      ('EARLY_FIVE','Early Five'),('FOUR_CORNERS','Four Corners'),('TOP_LINE','Top Line'),
      ('MIDDLE_LINE','Middle Line'),('BOTTOM_LINE','Bottom Line'),('FULL_HOUSE','Full House'),
      ('SECOND_FULL_HOUSE','Second Full House')) AS defaults(rule_type,name)`,[id]);
    return this.getGame(id);
  }

  async getGame(gameId: string): Promise<Record<string, unknown>> {
    this.assertUuid(gameId);
    const result = await this.database.query<GameRow & { remaining_count: number }>(
      `SELECT id, name, status, interval_seconds, next_number_sequence,
              next_ticket_number, next_call_at, paused_remaining_seconds,
              created_at, started_at, completed_at,
              cardinality(remaining_numbers)::integer AS remaining_count
       FROM games WHERE id = $1::uuid`,
      [gameId],
    );
    const game = result.rows[0];
    if (!game) throw new NotFoundException('Game not found.');

    const calledCount = game.next_number_sequence - 1;
    return {
      id: game.id,
      name: game.name,
      status: game.status,
      intervalSeconds: game.interval_seconds,
      calledCount,
      remainingCount: game.remaining_count,
      nextCallAt: game.next_call_at,
      pausedRemainingSeconds: game.paused_remaining_seconds,
      createdAt: game.created_at,
      startedAt: game.started_at,
      completedAt: game.completed_at,
    };
  }

  async startGame(gameId: string): Promise<Record<string, unknown>> {
    this.assertUuid(gameId);
    await this.database.transaction(async (client) => {
      const game = await this.lockGame(client, gameId);
      if (game.status !== 'CREATED' && game.status !== 'PAUSED') {
        throw new ConflictException(`Cannot start a game in ${game.status} state.`);
      }
      const tieBreak = await client.query('SELECT 1 FROM sudden_death_rounds WHERE game_id=$1 AND status<>$2 LIMIT 1',[gameId,'RESOLVED']);
      if(tieBreak.rowCount) throw new ConflictException('Finish the sudden-death round before starting the main game.');
      if (game.remaining_numbers.length === 0) {
        throw new ConflictException('This game has no numbers remaining.');
      }

      const delaySeconds = game.status === 'PAUSED'
        ? Number(game.paused_remaining_seconds ?? game.interval_seconds)
        : game.interval_seconds;

      await client.query(
        `UPDATE games
         SET status = 'RUNNING',
             started_at = COALESCE(started_at, NOW()),
             next_call_at = NOW() + ($2::integer * INTERVAL '1 second'),
             scheduler_remaining_seconds = $2,
             paused_remaining_seconds = NULL
         WHERE id = $1::uuid`,
        [gameId, delaySeconds],
      );
    });
    return this.getGame(gameId);
  }

  async pauseGame(gameId: string): Promise<Record<string, unknown>> {
    this.assertUuid(gameId);
    await this.database.transaction(async (client) => {
      const game = await this.lockGame(client, gameId);
      if (game.status !== 'RUNNING') {
        throw new ConflictException(`Cannot pause a game in ${game.status} state.`);
      }

      const secondsResult = await client.query<{ seconds_left: number }>(
        `SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (next_call_at - NOW()))))::integer AS seconds_left
         FROM games WHERE id = $1::uuid`,
        [gameId],
      );
      const secondsLeft = Number(secondsResult.rows[0]?.seconds_left ?? 0);
      await client.query(
        `UPDATE games SET status = 'PAUSED', next_call_at = NULL,
           paused_remaining_seconds = $2, scheduler_remaining_seconds = NULL
         WHERE id = $1::uuid`,
        [gameId, secondsLeft],
      );
    });
    return this.getGame(gameId);
  }

  async resumeGame(gameId: string): Promise<Record<string, unknown>> {
    return this.startGame(gameId);
  }

  async callManualNumber(gameId: string, rawNumber: unknown): Promise<CalledNumber> {
    const number = Number(rawNumber);
    if (!Number.isInteger(number) || number < 1 || number > 90) {
      throw new BadRequestException('number must be an integer from 1 through 90.');
    }
    const called = await this.callNumber(gameId, 'MANUAL', number);
    if (called === null) {
      throw new ConflictException('No numbers remain available to call.');
    }
    return called;
  }

  async callScheduledNumber(gameId: string): Promise<CalledNumber | null> {
    return this.callNumber(gameId, 'SCHEDULED');
  }

  async listCalls(gameId: string): Promise<CalledNumber[]> {
    this.assertUuid(gameId);
    const game = await this.database.query('SELECT id FROM games WHERE id = $1::uuid', [gameId]);
    if (game.rowCount === 0) throw new NotFoundException('Game not found.');

    const result = await this.database.query<{
      id: string; game_id: string; number: number; sequence: number;
      call_source: CallSource; called_at: Date;
    }>(
      `SELECT id, game_id, number, sequence, call_source, called_at
       FROM called_numbers WHERE game_id = $1::uuid ORDER BY sequence`,
      [gameId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      gameId: row.game_id,
      number: Number(row.number),
      sequence: row.sequence,
      source: row.call_source,
      calledAt: row.called_at,
    }));
  }

  async generateTicket(gameId: string): Promise<Record<string, unknown>> {
    this.assertUuid(gameId);
    const ticketId = randomUUID();
    return this.database.transaction(async (client): Promise<Record<string, unknown>> => {
      const game = await this.lockGame(client, gameId);
      if (game.status === 'COMPLETED') {
        throw new ConflictException('Cannot generate a ticket for a completed game.');
      }

      const ticketNumber = game.next_ticket_number;
      const grid = generateTambolaTicket();
      const numbers = grid.flat()
        .filter((value): value is number => value !== null)
        .sort((left, right) => left - right);

      await client.query(
        `INSERT INTO tickets (id, game_id, ticket_number, grid, numbers)
         VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5::smallint[])`,
        [ticketId, gameId, ticketNumber, JSON.stringify(grid), numbers],
      );
      await client.query(
        'UPDATE games SET next_ticket_number = next_ticket_number + 1 WHERE id = $1::uuid',
        [gameId],
      );
      return {
        id: ticketId,
        gameId,
        ticketNumber,
        displayCode: `T-${String(ticketNumber).padStart(4, '0')}`,
        grid,
        numbers,
        status: 'AVAILABLE',
      };
    });
  }

  /** Used by approval inside the SAME database transaction as spending the token. */
  async callPowerNumberLocked(
    client: PoolClient, gameId: string, number: number, powerRequestId: string,
  ): Promise<CalledNumber> {
    this.assertUuid(gameId);
    const game = await this.lockGame(client, gameId);
    if (game.status !== 'RUNNING') throw new ConflictException('Resume the game before approving Lucky Strike.');
    const result = await this.performCallLocked(client, gameId, game, 'SUPERPOWER', number, powerRequestId);
    if (!result) throw new ConflictException('No numbers available for Lucky Strike.');
    return result;
  }

  private async callNumber(
    gameId: string, source: CallSource, requestedNumber?: number,
  ): Promise<CalledNumber | null> {
    this.assertUuid(gameId);
    return this.database.transaction(async client => {
      const game = await this.lockGame(client, gameId);
      if (game.status !== 'RUNNING') {
        if (source === 'SCHEDULED') return null;
        throw new ConflictException(`Cannot call a number while the game is ${game.status}.`);
      }
      if (source === 'SCHEDULED') {
        const due = await client.query<{is_due: boolean}>(
          'SELECT (next_call_at <= NOW()) AS is_due FROM games WHERE id=$1::uuid', [gameId]);
        if (!due.rows[0]?.is_due) return null;
      }
      return this.performCallLocked(client, gameId, game, source, requestedNumber);
    });
  }

  private async performCallLocked(
    client: PoolClient, gameId: string, game: GameRow, source: CallSource,
    requestedNumber?: number, powerRequestId?: string,
  ): Promise<CalledNumber | null> {
    const remaining = (game.remaining_numbers ?? []).map(Number);
    if (!remaining.length) {
      await client.query(`UPDATE games SET status='COMPLETED', next_call_at=NULL,
        scheduler_remaining_seconds=NULL,paused_remaining_seconds=NULL,completed_at=NOW()
        WHERE id=$1`, [gameId]);
      return null;
    }
    const number = requestedNumber ?? remaining[0];
    if (!remaining.includes(number)) throw new ConflictException(`Number ${number} was already called.`);
    const after = remaining.filter(n => n !== number);
    const sequence = game.next_number_sequence;
    const id = randomUUID();
    const saved = await client.query<{called_at: Date}>(
      `INSERT INTO called_numbers(id,game_id,number,sequence,call_source,power_request_id)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING called_at`,
      [id,gameId,number,sequence,source,powerRequestId ?? null]);
    if (!after.length) {
      await client.query(`UPDATE games SET remaining_numbers=$2::smallint[],
        next_number_sequence=next_number_sequence+1,status='COMPLETED',next_call_at=NULL,
        scheduler_remaining_seconds=NULL,paused_remaining_seconds=NULL,completed_at=NOW()
        WHERE id=$1`, [gameId,after]);
    } else {
      await client.query(`UPDATE games SET remaining_numbers=$2::smallint[],
        next_number_sequence=next_number_sequence+1,
        next_call_at=NOW()+(interval_seconds * INTERVAL '1 second'),
        scheduler_remaining_seconds=interval_seconds WHERE id=$1`,[gameId,after]);
    }
    await WinnersService.snapshot(client, gameId, sequence);
    return {id,gameId,number,sequence,source,calledAt:saved.rows[0].called_at};
  }

  private async lockGame(client: PoolClient, gameId: string): Promise<GameRow> {
    const result = await client.query<GameRow>(
      'SELECT * FROM games WHERE id = $1::uuid FOR UPDATE',
      [gameId],
    );
    const game = result.rows[0];
    if (!game) throw new NotFoundException('Game not found.');
    return game;
  }

  private assertUuid(value: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new BadRequestException('gameId must be a valid UUID.');
    }
  }
}
