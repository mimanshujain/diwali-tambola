import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { TambolaService } from '../tambola/tambola.service.js';
import { assertAdmin } from '../security/admin.js';
import { assertChosenNumber } from './domain/priority.js';

interface PowerRequest extends QueryResultRow {
  id: string;
  player_id: string;
  game_id: string;
  requested_number: number;
  status: string;
}
const isUuid = (raw: string): boolean => /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(raw);
function validId(raw: string): string {
  if (!isUuid(raw)) throw new BadRequestException('Invalid UUID');
  return raw;
}
@Injectable()
export class PowersService {
  constructor(private readonly db: DatabaseService, private readonly tambola: TambolaService) {}

  private async playerId(gameId: string, authorization?: string): Promise<string> {
    const match = /^Bearer ([A-Za-z0-9_-]{40,100})$/.exec(authorization ?? '');
    if (!match) throw new UnauthorizedException('Player token required');
    const hash = createHash('sha256').update(match[1]).digest('hex');
    const row = await this.db.query<{id:string}>(
      'SELECT id FROM players WHERE game_id=$1 AND token_hash=$2', [gameId,hash]);
    if (!row.rows[0]) throw new UnauthorizedException('Unknown player token');
    return row.rows[0].id;
  }

  async mine(gameIdRaw: string, auth?: string): Promise<Record<string, unknown>> {
    const gameId = validId(gameIdRaw), playerId = await this.playerId(gameId,auth);
    const power = await this.db.query<{status:string;used_at:Date|null}>(
      'SELECT status,used_at FROM player_powers WHERE game_id=$1 AND player_id=$2',[gameId,playerId]);
    const request = await this.db.query<PowerRequest>(
      'SELECT * FROM power_requests WHERE player_id=$1 ORDER BY created_at DESC LIMIT 1',[playerId]);
    return {status:power.rows[0]?.status ?? 'AVAILABLE',usedAt:power.rows[0]?.used_at ?? null,
      lastRequest:request.rows[0] ? {id:request.rows[0].id,number:request.rows[0].requested_number,
        status:request.rows[0].status} : null};
  }

  async request(gameIdRaw:string, auth:string|undefined, rawNumber:unknown): Promise<Record<string,unknown>> {
    const gameId=validId(gameIdRaw), playerId=await this.playerId(gameId,auth);
    let number:number;
    try { number=assertChosenNumber(rawNumber); }
    catch { throw new BadRequestException('Choose an integer between 1 and 90'); }
    return this.db.transaction(async client=>{
      const game=await client.query<{status:string;remaining_numbers:number[]}>(
        'SELECT status,remaining_numbers FROM games WHERE id=$1 FOR UPDATE',[gameId]);
      if(!game.rows[0])throw new NotFoundException('Game not found');
      if(game.rows[0].status!=='RUNNING')throw new ConflictException('Lucky Strike is available while game is running');
      if(!game.rows[0].remaining_numbers.map(Number).includes(number))throw new ConflictException('Number has already been called');
      const ticket=await client.query("SELECT 1 FROM tickets WHERE player_id=$1 AND status='SUBMITTED' LIMIT 1",[playerId]);
      if(!ticket.rowCount)throw new ConflictException('Submit a ticket before using Lucky Strike');
      await client.query(`INSERT INTO player_powers(player_id,game_id) VALUES($1,$2) ON CONFLICT(player_id) DO NOTHING`,[playerId,gameId]);
      const power=await client.query<{status:string}>('SELECT status FROM player_powers WHERE player_id=$1 FOR UPDATE',[playerId]);
      if(power.rows[0]?.status!=='AVAILABLE')throw new ConflictException('Lucky Strike is pending or was already used');
      const id=randomUUID();
      await client.query(`INSERT INTO power_requests(id,game_id,player_id,requested_number) VALUES($1,$2,$3,$4)`,[id,gameId,playerId,number]);
      await client.query("UPDATE player_powers SET status='PENDING' WHERE player_id=$1",[playerId]);
      return {id,number,status:'PENDING'};
    });
  }

  async pending(gameIdRaw:string,key?:string):Promise<Record<string,unknown>[]> {
    assertAdmin(key);
    const gameId=validId(gameIdRaw);
    const rows=await this.db.query<PowerRequest & {name:string}>(
      `SELECT r.*,p.name FROM power_requests r JOIN players p ON p.id=r.player_id
       WHERE r.game_id=$1 ORDER BY r.created_at DESC LIMIT 150`,[gameId]);
    return rows.rows.map(r=>({id:r.id,playerId:r.player_id,playerName:r.name,number:r.requested_number,
      status:r.status,createdAt:r.created_at,calledSequence:r.called_sequence}));
  }

  async decide(gameIdRaw:string, requestIdRaw:string, action:'approve'|'reject',key?:string):Promise<Record<string,unknown>> {
    assertAdmin(key);
    const gameId=validId(gameIdRaw),requestId=validId(requestIdRaw);
    return this.db.transaction(async client=>{
      // Shared lock order for scheduled/manual/power calls: game first, then request.
      const game=await client.query<{status:string}>(
        'SELECT status FROM games WHERE id=$1 FOR UPDATE',[gameId]);
      if(!game.rows[0])throw new NotFoundException('Game not found');
      const rs=await client.query<PowerRequest>(
        'SELECT * FROM power_requests WHERE id=$1 AND game_id=$2 FOR UPDATE',[requestId,gameId]);
      const r=rs.rows[0];
      if(!r)throw new NotFoundException('Lucky Strike request not found');
      if(r.status!=='PENDING')throw new ConflictException('Lucky Strike request has already been processed');
      await client.query('SELECT 1 FROM player_powers WHERE player_id=$1 FOR UPDATE',[r.player_id]);
      if(action==='reject'){
        await client.query("UPDATE power_requests SET status='REJECTED',resolved_at=NOW() WHERE id=$1",[requestId]);
        await client.query("UPDATE player_powers SET status='AVAILABLE' WHERE player_id=$1",[r.player_id]);
        return {id:requestId,status:'REJECTED',number:r.requested_number};
      }
      if(game.rows[0].status!=='RUNNING') throw new ConflictException('Resume main game before approving Lucky Strike');
      const activeTicket=await client.query("SELECT 1 FROM tickets WHERE player_id=$1 AND status='SUBMITTED' LIMIT 1",[r.player_id]);
      if(!activeTicket.rowCount)throw new ConflictException('Player must have a submitted active ticket');
      const called=await this.tambola.callPowerNumberLocked(client,gameId,Number(r.requested_number),requestId);
      await client.query("UPDATE power_requests SET status='APPROVED',resolved_at=NOW(),called_sequence=$2 WHERE id=$1",[requestId,called.sequence]);
      await client.query("UPDATE player_powers SET status='USED',used_at=NOW() WHERE player_id=$1",[r.player_id]);
      // Only create a priority window where Lucky Strike caused the player's
      // first qualification, nobody qualified earlier, and someone else also
      // qualified on or before this draw.
      await client.query(`INSERT INTO power_priority_windows(category_id,game_id,power_request_id,powered_player_id,call_sequence,closes_at)
        SELECT c.id,$1,$2,$3,$4,NOW()+INTERVAL '30 seconds'
        FROM winning_categories c
        JOIN category_eligibility mine ON mine.category_id=c.id
          AND mine.player_id=$3 AND mine.first_eligible_sequence=$4
        WHERE c.game_id=$1 AND c.active=TRUE
          AND NOT EXISTS (SELECT 1 FROM category_outcomes o WHERE o.category_id=c.id)
          AND NOT EXISTS (SELECT 1 FROM category_eligibility old
                          WHERE old.category_id=c.id AND old.first_eligible_sequence<$4)
          AND EXISTS (SELECT 1 FROM category_eligibility other
                      WHERE other.category_id=c.id AND other.player_id<>$3
                        AND other.first_eligible_sequence<=$4)
        ON CONFLICT(category_id) DO NOTHING`,[gameId,requestId,r.player_id,called.sequence]);
      return {id:requestId,status:'APPROVED',number:called.number,sequence:called.sequence};
    });
  }
}
