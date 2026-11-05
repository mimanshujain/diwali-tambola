import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { generateTambolaTicket } from '../tambola/domain/ticket-generator.js';

export function normalizeMobile(value: unknown): string {
  if (typeof value !== 'string') throw new BadRequestException('mobile must be a string');
  const digits = value.replace(/[\s()+.-]/g, '');
  if (!/^\d{10,15}$/.test(digits)) {
    throw new BadRequestException('mobile must contain 10-15 digits (country code recommended)');
  }
  return digits;
}

export function normalizeName(value: unknown): string {
  if (typeof value !== 'string') throw new BadRequestException('name is required');
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new BadRequestException('name must be 1-80 printable characters');
  }
  return name;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' ||
      !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
  return value;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface PlayerRow extends QueryResultRow {
  id: string;
  game_id: string;
  name: string;
  mobile: string;
  created_at: Date;
}
interface TicketRow extends QueryResultRow {
  id: string;
  game_id: string;
  ticket_number: number;
  grid: (number | null)[][];
  numbers: number[];
  status: string;
  submitted_at: Date | null;
  created_at: Date;
}

@Injectable()
export class PlayersService {
  constructor(private readonly database: DatabaseService) {}

  checkAdmin(adminKey: string | undefined): void {
    const configured = process.env.ADMIN_TOKEN;
    if (!configured || !adminKey) throw new UnauthorizedException('Admin credential required');
    const left = createHash('sha256').update(adminKey).digest();
    const right = createHash('sha256').update(configured).digest();
    if (!timingSafeEqual(left, right)) throw new UnauthorizedException('Invalid admin credential');
  }

  async register(gameIdRaw: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const gameId = uuid(gameIdRaw, 'gameId');
    const name = normalizeName(input?.name);
    const mobile = normalizeMobile(input?.mobile);
    const deviceId = uuid(input?.deviceId, 'deviceId');
    const token = randomBytes(32).toString('base64url');
    const playerId = randomUUID();

    try {
      const result = await this.database.transaction(async (client) => {
        const game = await this.lockGame(client, gameId);
        if (game.status === 'COMPLETED') throw new ConflictException('Registration is closed');
        const found = await client.query(
          'SELECT id FROM players WHERE game_id = $1 AND (mobile = $2 OR device_id = $3)',
          [gameId, mobile, deviceId],
        );
        if (found.rowCount) throw new ConflictException('This phone number or device is already registered for this game');
        await client.query(
          `INSERT INTO players (id,game_id,name,mobile,device_id,token_hash)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [playerId, gameId, name, mobile, deviceId, hashToken(token)],
        );
        const ticket = await this.createTicket(client, gameId, playerId, Number(game.next_ticket_number));
        return { player: { id: playerId, name }, ticket };
      });
      return { ...result, token };
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('This phone number or device is already registered');
      }
      throw error;
    }
  }

  async me(gameIdRaw: string, authorization?: string): Promise<Record<string, unknown>> {
    const gameId = uuid(gameIdRaw, 'gameId');
    const player = await this.requirePlayer(gameId, authorization);
    const ticket = await this.findActiveTicket(player.id);
    return { player: { id: player.id, name: player.name }, ticket };
  }

  async submit(gameIdRaw: string, authorization?: string): Promise<Record<string, unknown>> {
    const gameId = uuid(gameIdRaw, 'gameId');
    const player = await this.requirePlayer(gameId, authorization);
    await this.database.transaction(async client => {
      // Serialize ticket submission and reissue using the same player row lock.
      await client.query('SELECT id FROM players WHERE id = $1 FOR UPDATE', [player.id]);
      const result = await client.query<TicketRow>(
        `SELECT * FROM tickets WHERE player_id = $1 AND status IN ('ASSIGNED','SUBMITTED') FOR UPDATE`,
        [player.id],
      );
      const ticket = result.rows[0];
      if (!ticket) throw new NotFoundException('No active ticket');
      if (ticket.status === 'ASSIGNED') {
        await client.query(
          `UPDATE tickets SET status = 'SUBMITTED', submitted_at = NOW() WHERE id = $1`, [ticket.id],
        );
      }
    });
    return this.me(gameId, authorization);
  }

  async regenerate(gameIdRaw: string, authorization?: string): Promise<Record<string, unknown>> {
    const gameId = uuid(gameIdRaw, 'gameId');
    const player = await this.requirePlayer(gameId, authorization);
    await this.database.transaction(async client => {
      const game = await this.lockGame(client, gameId);
      if (game.status !== 'CREATED') throw new ConflictException('Cannot regenerate after the game starts');
      await client.query('SELECT id FROM players WHERE id = $1 FOR UPDATE', [player.id]);
      const old = await this.lockActiveTicket(client, player.id);
      if (old.status !== 'ASSIGNED') throw new ConflictException('Submitted tickets are immutable');
      await client.query(`UPDATE tickets SET status = 'REVOKED' WHERE id = $1`, [old.id]);
      await this.createTicket(client, gameId, player.id, Number(game.next_ticket_number), old.id);
    });
    return this.me(gameId, authorization);
  }

  async listPlayers(gameIdRaw: string, adminKey?: string): Promise<Record<string, unknown>[]> {
    this.checkAdmin(adminKey);
    const gameId = uuid(gameIdRaw, 'gameId');
    const players = await this.database.query<PlayerRow & { ticket_id: string | null; ticket_number: number | null; ticket_status: string | null }>(
      `SELECT p.id,p.name,p.mobile,p.created_at,t.id AS ticket_id,t.ticket_number,t.status AS ticket_status
       FROM players p LEFT JOIN tickets t ON t.player_id = p.id AND t.status IN ('ASSIGNED','SUBMITTED')
       WHERE p.game_id = $1 ORDER BY p.created_at`, [gameId],
    );
    return players.rows.map(row => ({
      id: row.id, name: row.name, mobile: row.mobile, registeredAt: row.created_at,
      ticketId: row.ticket_id, ticketNumber: row.ticket_number, ticketStatus: row.ticket_status,
    }));
  }

  async reissue(gameIdRaw: string, playerIdRaw: string, reasonRaw: unknown, adminKey?: string): Promise<Record<string, unknown>> {
    this.checkAdmin(adminKey);
    const gameId = uuid(gameIdRaw, 'gameId');
    const playerId = uuid(playerIdRaw, 'playerId');
    if (typeof reasonRaw !== 'string' || reasonRaw.trim().length < 3 || reasonRaw.trim().length > 500) {
      throw new BadRequestException('reason must be 3-500 characters');
    }
    const reason = reasonRaw.trim();
    await this.database.transaction(async client => {
      const game = await this.lockGame(client, gameId);
      if (game.status === 'COMPLETED') throw new ConflictException('Cannot reissue for a completed game');
      const player = await client.query<PlayerRow>(
        'SELECT * FROM players WHERE id = $1 AND game_id = $2 FOR UPDATE', [playerId, gameId],
      );
      if (!player.rowCount) throw new NotFoundException('Player not found');
      const old = await this.lockActiveTicket(client, playerId);
      await client.query(`UPDATE tickets SET status = 'REVOKED' WHERE id = $1`, [old.id]);
      const next = await this.createTicket(client, gameId, playerId, Number(game.next_ticket_number), old.id);
      await client.query(
        `INSERT INTO ticket_reissue_history (id,game_id,player_id,old_ticket_id,new_ticket_id,reason)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [randomUUID(), gameId, playerId, old.id, next.id, reason],
      );
    });
    return { playerId, ...(await this.adminActiveTicket(gameId, playerId)) };
  }

  private async adminActiveTicket(gameId: string, playerId: string): Promise<{ ticket: Record<string, unknown> }> {
    const result = await this.database.query<TicketRow>(
      `SELECT * FROM tickets WHERE game_id = $1 AND player_id = $2 AND status IN ('ASSIGNED','SUBMITTED')`,
      [gameId, playerId],
    );
    return { ticket: this.toTicket(result.rows[0]) };
  }

  private async requirePlayer(gameId: string, auth?: string): Promise<PlayerRow> {
    const match = /^Bearer ([A-Za-z0-9_-]{40,100})$/.exec(auth ?? '');
    if (!match) throw new UnauthorizedException('Player token required');
    const result = await this.database.query<PlayerRow>(
      'SELECT id,game_id,name,mobile,created_at FROM players WHERE game_id=$1 AND token_hash=$2',
      [gameId, hashToken(match[1])],
    );
    if (!result.rows[0]) throw new UnauthorizedException('Unknown player token');
    return result.rows[0];
  }

  private async lockGame(client: PoolClient, gameId: string): Promise<{ status: string; next_ticket_number: number }> {
    const result = await client.query<{ status: string; next_ticket_number: number }>(
      'SELECT status,next_ticket_number FROM games WHERE id=$1 FOR UPDATE', [gameId],
    );
    if (!result.rows[0]) throw new NotFoundException('Game not found');
    return result.rows[0];
  }

  private async lockActiveTicket(client: PoolClient, playerId: string): Promise<TicketRow> {
    const result = await client.query<TicketRow>(
      `SELECT * FROM tickets WHERE player_id=$1 AND status IN ('ASSIGNED','SUBMITTED') FOR UPDATE`,
      [playerId],
    );
    if (!result.rows[0]) throw new NotFoundException('No active ticket');
    return result.rows[0];
  }

  private async findActiveTicket(playerId: string): Promise<Record<string, unknown>> {
    const result = await this.database.query<TicketRow>(
      `SELECT * FROM tickets WHERE player_id=$1 AND status IN ('ASSIGNED','SUBMITTED')`, [playerId],
    );
    if (!result.rows[0]) throw new NotFoundException('No active ticket');
    return this.toTicket(result.rows[0]);
  }

  private toTicket(row: TicketRow): Record<string, unknown> {
    return {
      id: row.id, gameId: row.game_id, ticketNumber: row.ticket_number,
      displayCode: `T-${String(row.ticket_number).padStart(4, '0')}`,
      grid: row.grid, numbers: row.numbers, status: row.status, submittedAt: row.submitted_at,
    };
  }

  private async createTicket(
    client: PoolClient, gameId: string, playerId: string, ticketNumber: number, oldTicketId?: string,
  ): Promise<Record<string, unknown>> {
    const grid = generateTambolaTicket();
    const numbers = grid.flat().filter((value): value is number => value !== null).sort((a,b) => a-b);
    const id = randomUUID();
    const result = await client.query<TicketRow>(
      `INSERT INTO tickets (id,game_id,ticket_number,grid,numbers,status,player_id,reissued_from_id)
       VALUES ($1,$2,$3,$4::jsonb,$5::smallint[],'ASSIGNED',$6,$7)
       RETURNING *`,
      [id,gameId,ticketNumber,JSON.stringify(grid),numbers,playerId,oldTicketId ?? null],
    );
    await client.query('UPDATE games SET next_ticket_number = next_ticket_number+1 WHERE id=$1', [gameId]);
    return this.toTicket(result.rows[0]);
  }
}
