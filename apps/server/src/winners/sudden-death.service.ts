import { assertAdmin as auth } from '../security/admin.js';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { completedParticipants, miniTicket, shuffledPool } from './domain/sudden-death.js';

interface Round extends QueryResultRow {
  id: string; game_id: string; category_id: string; status: 'PAUSED'|'RUNNING'|'RESOLVED';
  interval_seconds: number; ticket_size: number; remaining_numbers: number[];
  draw_sequence: number; next_call_at: Date | null; paused_remaining_seconds: number | null;
}
interface Participant extends QueryResultRow { player_id: string; ticket_id: string; numbers: number[]; }
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);


@Injectable()
export class SuddenDeathService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SuddenDeathService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private ticking = false;
  private stopping = false;
  private lastCheckpointAt = 0;
  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.db.schedulerWork('sudden-death',()=>this.recover(),async()=>{});
    this.timer = setInterval(() => void this.tick(), 1000);
    this.timer.unref?.();
  }
  private async recover():Promise<void> {
    // On any API restart, freeze the mini round. Admin explicitly resumes it.
    await this.db.query(`UPDATE sudden_death_rounds
      SET status='PAUSED', paused_remaining_seconds=COALESCE(paused_remaining_seconds, interval_seconds),next_call_at=NULL
      WHERE status='RUNNING'`);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.db.schedulerWork('sudden-death',async()=>{},async()=>{
    await this.db.query(`UPDATE sudden_death_rounds SET status='PAUSED',next_call_at=NULL,
      paused_remaining_seconds=GREATEST(0,CEIL(EXTRACT(EPOCH FROM(next_call_at-NOW()))))::int WHERE status='RUNNING'`);
    },true);
  }

  static async create(client: PoolClient, gameId: string, categoryId: string,
    intervalSeconds: number, ticketSize: number,
    tied: ReadonlyArray<{ player_id: string; ticket_id: string }>): Promise<string> {
    if (tied.length < 2) throw new ConflictException('At least two tied tickets are required');
    const id = randomUUID();
    await client.query(`INSERT INTO sudden_death_rounds
      (id,game_id,category_id,interval_seconds,ticket_size,remaining_numbers,paused_remaining_seconds)
      VALUES($1,$2,$3,$4,$5,$6::smallint[],$4)`,[id,gameId,categoryId,intervalSeconds,ticketSize,shuffledPool()]);
    for (const entry of tied) {
      await client.query(`INSERT INTO sudden_death_entries(round_id,player_id,ticket_id,numbers)
        VALUES($1,$2,$3,$4::smallint[])`,[id,entry.player_id,entry.ticket_id,miniTicket(ticketSize)]);
    }
    return id;
  }

  async detail(gameId: string, categoryId: string, key?: string): Promise<Record<string, unknown>> {
    auth(key);
    if (!isUuid(gameId) || !isUuid(categoryId)) throw new BadRequestException('Invalid UUID');
    const rounds = await this.db.query<Round>('SELECT * FROM sudden_death_rounds WHERE game_id=$1 AND category_id=$2',[gameId,categoryId]);
    const round=rounds.rows[0]; if (!round) throw new NotFoundException('No sudden-death round for category');
    const entries = await this.db.query<Participant>('SELECT player_id,ticket_id,numbers FROM sudden_death_entries WHERE round_id=$1 ORDER BY player_id',[round.id]);
    const calls = await this.db.query<{sequence:number;number:number;called_at:Date}>('SELECT sequence,number,called_at FROM sudden_death_calls WHERE round_id=$1 ORDER BY sequence',[round.id]);
    return {id:round.id,gameId,categoryId,status:round.status,intervalSeconds:round.interval_seconds,ticketSize:round.ticket_size,drawSequence:round.draw_sequence,nextCallAt:round.next_call_at,pausedRemainingSeconds:round.paused_remaining_seconds,entries:entries.rows,calls:calls.rows};
  }

  async control(gameId: string, categoryId: string, key: string|undefined, action:'start'|'pause'): Promise<Record<string, unknown>> {
    auth(key);
    if (!isUuid(gameId) || !isUuid(categoryId)) throw new BadRequestException('Invalid UUID');
    await this.db.transaction(async client => {
      // Same lock order as settlement: game -> round. Prevent admin/scheduler races.
      const game=await client.query<{status:string;emergency_stopped:boolean;ended_by_admin:boolean;review_claim_id:string|null}>('SELECT status,emergency_stopped,ended_by_admin,review_claim_id FROM games WHERE id=$1 FOR UPDATE',[gameId]);
      if(!game.rows[0])throw new NotFoundException('Game not found');
      if(game.rows[0].emergency_stopped || game.rows[0].ended_by_admin) throw new ConflictException('Game has been stopped.');
      if(!['PAUSED','COMPLETED'].includes(game.rows[0].status))throw new ConflictException('Pause main game before running tie-break');
      if(action==='start' && game.rows[0].review_claim_id)throw new ConflictException('Finish the claim review before starting a tie-break');
      const r=await client.query<Round>('SELECT * FROM sudden_death_rounds WHERE game_id=$1 AND category_id=$2 FOR UPDATE',[gameId,categoryId]);
      const round=r.rows[0]; if(!round)throw new NotFoundException('Sudden-death round not found');
      if(action==='start') {
        if(round.status!=='PAUSED')throw new ConflictException('Round is not paused');
        const delay=round.paused_remaining_seconds ?? round.interval_seconds;
        await client.query(`UPDATE sudden_death_rounds SET status='RUNNING',next_call_at=NOW()+($2::integer * INTERVAL '1 second'),paused_remaining_seconds=$2 WHERE id=$1`,[round.id,delay]);
      } else {
        if(round.status!=='RUNNING')throw new ConflictException('Round is not running');
        await client.query(`UPDATE sudden_death_rounds SET status='PAUSED',paused_remaining_seconds=GREATEST(0,CEIL(EXTRACT(EPOCH FROM (next_call_at-NOW())))::integer),next_call_at=NULL WHERE id=$1`,[round.id]);
      }
    });
    return this.detail(gameId,categoryId,key);
  }

  private async tick():Promise<void> {
    if(this.ticking || this.stopping)return;
    this.ticking=true;
    try {
      await this.db.schedulerWork('sudden-death',()=>this.recover(),async()=>{
      if(Date.now()-this.lastCheckpointAt>=5000){
        await this.db.query(`UPDATE sudden_death_rounds SET paused_remaining_seconds=
          GREATEST(0,CEIL(EXTRACT(EPOCH FROM(next_call_at-NOW()))))::int WHERE status='RUNNING'`);
        this.lastCheckpointAt=Date.now();
      }
      const due=await this.db.query<{id:string;game_id:string}>('SELECT id,game_id FROM sudden_death_rounds WHERE status=$1 AND next_call_at<=NOW() ORDER BY next_call_at LIMIT 10',['RUNNING']);
      for(const round of due.rows) {
        try { await this.draw(round.game_id,round.id); }
        catch (error) { this.logger.error(`Sudden-death draw failed for ${round.id}`,error instanceof Error?error.stack:String(error)); }
      }
      });
    } catch(error) { this.logger.error('Sudden-death scheduler error',error instanceof Error?error.stack:String(error)); }
    finally {this.ticking=false;}
  }

  private async draw(gameId:string,roundId:string):Promise<void> {
    await this.db.transaction(async client=>{
      const game=await client.query<{status:string;emergency_stopped:boolean;ended_by_admin:boolean}>('SELECT status,emergency_stopped,ended_by_admin FROM games WHERE id=$1 FOR UPDATE',[gameId]);
      if(!game.rows[0] || game.rows[0].emergency_stopped || game.rows[0].ended_by_admin || !['PAUSED','COMPLETED'].includes(game.rows[0].status))return;
      const rounds=await client.query<Round>('SELECT * FROM sudden_death_rounds WHERE id=$1 AND game_id=$2 FOR UPDATE',[roundId,gameId]);
      const round=rounds.rows[0];
      if(!round || round.status!=='RUNNING')return;
      if(!round.next_call_at || new Date(round.next_call_at).getTime()>Date.now())return;
      const remaining=round.remaining_numbers.map(Number);
      if(!remaining.length)throw new ConflictException('Unexpected exhausted sudden-death pool');
      const number=remaining[0],sequence=round.draw_sequence+1;
      await client.query('INSERT INTO sudden_death_calls(round_id,sequence,number) VALUES($1,$2,$3)',[round.id,sequence,number]);
      const entries=(await client.query<Participant>('SELECT player_id,ticket_id,numbers FROM sudden_death_entries WHERE round_id=$1',[round.id])).rows;
      const calledRows=await client.query<{number:number}>('SELECT number FROM sudden_death_calls WHERE round_id=$1',[round.id]);
      const completed=completedParticipants(entries.map(e=>({playerId:e.player_id,numbers:e.numbers.map(Number)})),new Set(calledRows.rows.map(r=>Number(r.number))));
      if(completed.length) {
        await client.query(`UPDATE sudden_death_rounds SET status='RESOLVED',draw_sequence=$2,remaining_numbers=$3::smallint[],next_call_at=NULL,paused_remaining_seconds=NULL,resolved_at=NOW() WHERE id=$1`,[round.id,sequence,remaining.slice(1)]);
        const winners=entries.filter(e=>completed.includes(e.player_id));
        for(const winner of winners)await client.query('INSERT INTO winners(id,category_id,game_id,player_id,ticket_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(category_id,player_id) DO NOTHING',[randomUUID(),round.category_id,gameId,winner.player_id,winner.ticket_id]);
        await client.query(`UPDATE category_outcomes SET status='RESOLVED',resolved_at=NOW() WHERE category_id=$1 AND status='SUDDEN_DEATH_PENDING'`,[round.category_id]);
        await client.query(`UPDATE winner_claims SET status=CASE WHEN player_id=ANY($2::uuid[]) THEN 'VALID' ELSE 'REJECTED' END,reviewed_at=NOW() WHERE category_id=$1`,[round.category_id,completed]);
        await this.seedSecondHouse(client, gameId, round.category_id);
      } else {
        await client.query(`UPDATE sudden_death_rounds SET draw_sequence=$2,remaining_numbers=$3::smallint[],next_call_at=NOW()+(interval_seconds*INTERVAL '1 second'),paused_remaining_seconds=interval_seconds WHERE id=$1`,[round.id,sequence,remaining.slice(1)]);
      }
    });
  }

  /** Seed second-house from already-completed, non-winning tickets. Also called at later draws. */
  static async seedSecondHouse(client:PoolClient,gameId:string):Promise<void> {
    const first=(await client.query<{id:string}>('SELECT id FROM winning_categories WHERE game_id=$1 AND rule_type=$2',[gameId,'FULL_HOUSE'])).rows[0];
    if(!first)return;
    const outcome=await client.query<{resolved_sequence:number;status:string}>('SELECT resolved_sequence,status FROM category_outcomes WHERE category_id=$1',[first.id]);
    if(outcome.rows[0]?.status!=='RESOLVED')return;
    await client.query(`INSERT INTO category_eligibility(id,game_id,category_id,ticket_id,player_id,first_eligible_sequence)
      SELECT gen_random_uuid(),$1,second.id,e.ticket_id,e.player_id,GREATEST(e.first_eligible_sequence,$3::integer)
      FROM category_eligibility e
      JOIN tickets t ON t.id=e.ticket_id AND t.status='SUBMITTED'
      JOIN winning_categories second ON second.game_id=$1 AND second.rule_type='SECOND_FULL_HOUSE' AND second.active=TRUE
      WHERE e.category_id=$2 AND NOT EXISTS (
        SELECT 1 FROM winners w WHERE w.category_id=$2 AND w.player_id=e.player_id
      )
      ON CONFLICT(category_id,ticket_id) DO NOTHING`,[gameId,first.id,outcome.rows[0].resolved_sequence]);
  }
  private async seedSecondHouse(client:PoolClient,gameId:string,categoryId:string):Promise<void> {
    const first=await client.query<{rule_type:string}>('SELECT rule_type FROM winning_categories WHERE id=$1',[categoryId]);
    if(first.rows[0]?.rule_type==='FULL_HOUSE')await SuddenDeathService.seedSecondHouse(client,gameId);
  }
}
