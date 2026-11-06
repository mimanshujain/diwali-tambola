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
import { uniqueTicket } from '../tambola/domain/unique-ticket.js';

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
  mobile: string | null;
  approved: boolean;
  regeneration_count: number;
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
    const recoveryCode = randomBytes(16).toString('hex');
    const deviceId = uuid(input?.deviceId, 'deviceId');
    const token = randomBytes(32).toString('base64url');
    const playerId = randomUUID();

    try {
      const result = await this.database.transaction(async (client) => {
        const game = await this.lockGame(client, gameId);
        if (game.status === 'COMPLETED' || game.emergency_stopped) throw new ConflictException('Registration is closed while the game is stopped or finished.');
        const found = await client.query(
          'SELECT id FROM players WHERE game_id = $1 AND (lower(name) = lower($2) OR device_id = $3)',
          [gameId, name, deviceId],
        );
        if (found.rowCount) throw new ConflictException('This name or browser is already registered. Restore your ticket or ask the host for help.');
        await client.query(
          `INSERT INTO players (id,game_id,name,recovery_hash,device_id,token_hash,approved)
           VALUES ($1,$2,$3,$4,$5,$6,false)`,
          [playerId, gameId, name, hashToken(recoveryCode), deviceId, hashToken(token)],
        );
        const late = game.started_at !== null;
        const ticket = await this.createTicket(client, gameId, playerId, Number(game.next_ticket_number), undefined, late, game.next_number_sequence);
        return { player: { id: playerId, name, approved:false }, ticket, rerollsRemaining: 3 };
      });
      return { ...result, token, recoveryCode };
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('This name or browser is already registered');
      }
      throw error;
    }
  }

  async recover(gameIdRaw: string, input: Record<string,unknown>) {
    const gameId=uuid(gameIdRaw,'gameId'), deviceId=uuid(input.deviceId,'deviceId');
    const recoveryCode=String(input.recoveryCode??'').replace(/[\s-]/g,'').toLowerCase();
    if(!/^[a-f0-9]{32}$/.test(recoveryCode)) throw new UnauthorizedException('Invalid recovery code');
    const token=randomBytes(32).toString('base64url');
    await this.database.transaction(async client => {
      await this.lockGame(client,gameId);
      const player=(await client.query<PlayerRow>('SELECT * FROM players WHERE game_id=$1 AND recovery_hash=$2 FOR UPDATE',[gameId,hashToken(recoveryCode)])).rows[0];
      if(!player) throw new UnauthorizedException('Invalid recovery code');
      const existing=await client.query('SELECT 1 FROM players WHERE game_id=$1 AND device_id=$2 AND id<>$3',[gameId,deviceId,player.id]);
      if(existing.rowCount) throw new ConflictException('This browser already belongs to another player in this game.');
      await client.query('UPDATE players SET device_id=$2,token_hash=$3 WHERE id=$1',[player.id,deviceId,hashToken(token)]);
      await client.query("INSERT INTO game_events(game_id,action,details) VALUES($1,'PLAYER_RECOVERED',jsonb_build_object('playerId',$2::text))",[gameId,player.id]);
    });
    return {...await this.me(gameId,'Bearer '+token),token,recoveryCode};
  }

  async approve(gameIdRaw:string,playerIdRaw:string,key?:string) {
    this.checkAdmin(key);const gameId=uuid(gameIdRaw,'gameId'),playerId=uuid(playerIdRaw,'playerId');
    await this.database.transaction(async client => {
      const game=await this.lockGame(client,gameId);
      if(game.status==='COMPLETED') throw new ConflictException('This game has finished.');
      const current=await client.query<PlayerRow>('SELECT * FROM players WHERE id=$1 AND game_id=$2 FOR UPDATE',[playerId,gameId]);
      if(!current.rows[0]) throw new NotFoundException('Player not found');
      if(current.rows[0].approved) return;
      await client.query('UPDATE players SET approved=true WHERE id=$1 AND game_id=$2',[playerId,gameId]);
      if(game.started_at) await client.query(`UPDATE tickets SET status='SUBMITTED',submitted_at=COALESCE(submitted_at,NOW()),
        eligible_from_sequence=GREATEST(eligible_from_sequence,$3)
        WHERE game_id=$1 AND player_id=$2 AND status IN ('ASSIGNED','SUBMITTED')`,[gameId,playerId,game.next_number_sequence]);
      await client.query("INSERT INTO game_events(game_id,action,details) VALUES($1,'PLAYER_APPROVED',jsonb_build_object('playerId',$2::text))",[gameId,playerId]);
    });
    return {playerId,approved:true};
  }

  async withdraw(gameIdRaw:string,playerIdRaw:string,key?:string) {
    this.checkAdmin(key);const gameId=uuid(gameIdRaw,'gameId'),playerId=uuid(playerIdRaw,'playerId');
    await this.database.transaction(async client=>{
      const game=await this.lockGame(client,gameId);
      if(game.status!=='CREATED') throw new ConflictException('Remove players before play starts.');
      await client.query("UPDATE tickets SET status='REVOKED' WHERE game_id=$1 AND player_id=$2 AND status IN ('ASSIGNED','SUBMITTED')",[gameId,playerId]);
      await client.query('UPDATE players SET approved=false WHERE game_id=$1 AND id=$2',[gameId,playerId]);
      await client.query("INSERT INTO game_events(game_id,action,details) VALUES($1,'PLAYER_WITHDRAWN',jsonb_build_object('playerId',$2::text))",[gameId,playerId]);
    });
    return {playerId};
  }

  async resetAccess(gameIdRaw:string,playerIdRaw:string,key?:string) {
    this.checkAdmin(key);const gameId=uuid(gameIdRaw,'gameId'),playerId=uuid(playerIdRaw,'playerId');
    const recoveryCode=randomBytes(16).toString('hex');
    await this.database.transaction(async client => {
      await this.lockGame(client,gameId);
      const result=await client.query('UPDATE players SET recovery_hash=$3,token_hash=$4 WHERE id=$1 AND game_id=$2 RETURNING id',
        [playerId,gameId,hashToken(recoveryCode),hashToken(randomBytes(32).toString('hex'))]);
      if(!result.rowCount) throw new NotFoundException('Player not found');
      await client.query("INSERT INTO game_events(game_id,action,details) VALUES($1,'PLAYER_ACCESS_RESET',jsonb_build_object('playerId',$2::text))",[gameId,playerId]);
    });
    return {playerId,recoveryCode};
  }

  async me(gameIdRaw: string, authorization?: string): Promise<Record<string, unknown>> {
    const gameId = uuid(gameIdRaw, 'gameId');
    const player = await this.requirePlayer(gameId, authorization);
    const ticket = await this.findActiveTicket(player.id);
    return { player: { id: player.id, name: player.name, approved: player.approved }, ticket,
      rerollsRemaining: Math.max(0, 3 - player.regeneration_count) };
  }

  async submit(gameIdRaw: string, authorization?: string, expectedTicketId?: unknown): Promise<Record<string, unknown>> {
    const gameId = uuid(gameIdRaw, 'gameId');
    const player = await this.requirePlayer(gameId, authorization);
    await this.database.transaction(async client => {
      const game = await this.lockGame(client, gameId);
      const currentPlayer = await client.query<PlayerRow>('SELECT * FROM players WHERE id=$1 FOR UPDATE', [player.id]);
      if (!currentPlayer.rows[0].approved) throw new ForbiddenException('Ask the host to approve your identity before submitting.');
      // The game and player locks serialize submission with start, regeneration and reissue.
      const result = await client.query<TicketRow>(
        `SELECT * FROM tickets WHERE player_id = $1 AND status IN ('ASSIGNED','SUBMITTED') FOR UPDATE`,
        [player.id],
      );
      const ticket = result.rows[0];
      if (!ticket) throw new NotFoundException('No active ticket');
      if (expectedTicketId !== undefined && ticket.id !== uuid(expectedTicketId,'ticketId')) throw new ConflictException('Your ticket changed. Review it again before submitting.');
      if (ticket.status === 'ASSIGNED') {
        if (game.status !== 'CREATED' || game.emergency_stopped) throw new ConflictException('Ticket submission closed when play started.');
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
      if (game.status !== 'CREATED' || game.emergency_stopped) throw new ConflictException('Cannot regenerate after the game starts');
      await client.query('SELECT id FROM players WHERE id = $1 FOR UPDATE', [player.id]);
      const old = await this.lockActiveTicket(client, player.id);
      if (old.status !== 'ASSIGNED') throw new ConflictException('Submitted tickets are immutable');
      const allowance = await client.query('UPDATE players SET regeneration_count=regeneration_count+1 WHERE id=$1 AND regeneration_count<3 RETURNING id',[player.id]);
      if (!allowance.rowCount) throw new ConflictException('You have used all three ticket recreations.');
      await client.query(`UPDATE tickets SET status = 'REVOKED' WHERE id = $1`, [old.id]);
      await this.createTicket(client, gameId, player.id, Number(game.next_ticket_number), old.id);
    });
    return this.me(gameId, authorization);
  }

  async listPlayers(gameIdRaw: string, adminKey?: string): Promise<Record<string, unknown>[]> {
    this.checkAdmin(adminKey);
    const gameId = uuid(gameIdRaw, 'gameId');
    const players = await this.database.query<PlayerRow & { ticket_id: string | null; ticket_number: number | null; ticket_status: string | null }>(
      `SELECT p.id,p.name,p.mobile,p.approved,p.created_at,t.id AS ticket_id,t.ticket_number,t.status AS ticket_status
       FROM players p LEFT JOIN tickets t ON t.player_id = p.id AND t.status IN ('ASSIGNED','SUBMITTED')
       WHERE p.game_id = $1 ORDER BY p.created_at`, [gameId],
    );
    return players.rows.map(row => ({
      id: row.id, name: row.name, approved: row.approved, registeredAt: row.created_at,
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
      if (game.status !== 'CREATED') throw new ConflictException('Reissue tickets before play starts to preserve fairness.');
      const player = await client.query<PlayerRow>(
        'SELECT * FROM players WHERE id = $1 AND game_id = $2 FOR UPDATE', [playerId, gameId],
      );
      if (!player.rowCount) throw new NotFoundException('Player not found');
      const old = (await client.query<TicketRow>('SELECT * FROM tickets WHERE player_id=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE',[playerId])).rows[0];
      if(!old) throw new NotFoundException('No ticket to reissue');
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
      'SELECT id,game_id,name,mobile,approved,regeneration_count,created_at FROM players WHERE game_id=$1 AND token_hash=$2',
      [gameId, hashToken(match[1])],
    );
    if (!result.rows[0]) throw new UnauthorizedException('Unknown player token');
    return result.rows[0];
  }

  private async lockGame(client: PoolClient, gameId: string): Promise<{ status: string; next_ticket_number: number; next_number_sequence: number; started_at: Date | null; emergency_stopped: boolean }> {
    const result = await client.query<{ status: string; next_ticket_number: number; next_number_sequence: number; started_at: Date | null; emergency_stopped: boolean }>(
      'SELECT status,next_ticket_number,next_number_sequence,started_at,emergency_stopped FROM games WHERE id=$1 FOR UPDATE', [gameId],
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
    submitImmediately = false, eligibleFromSequence = 1,
  ): Promise<Record<string, unknown>> {
    const {grid, numbers} = await uniqueTicket(client, gameId);
    const id = randomUUID();
    const result = await client.query<TicketRow>(
      `INSERT INTO tickets (id,game_id,ticket_number,grid,numbers,status,player_id,reissued_from_id,submitted_at,eligible_from_sequence)
       VALUES ($1,$2,$3,$4::jsonb,$5::smallint[],$8,$6,$7,CASE WHEN $8='SUBMITTED' THEN NOW() ELSE NULL END,$9)
       RETURNING *`,
      [id,gameId,ticketNumber,JSON.stringify(grid),numbers,playerId,oldTicketId ?? null,
        submitImmediately ? 'SUBMITTED' : 'ASSIGNED', submitImmediately ? eligibleFromSequence : 1],
    );
    await client.query('UPDATE games SET next_ticket_number = next_ticket_number+1 WHERE id=$1', [gameId]);
    return this.toTicket(result.rows[0]);
  }
}
