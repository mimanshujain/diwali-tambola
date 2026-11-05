import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { eligibleAtSequence, RULE_LABELS, type Grid, type RuleType } from './domain/rules.js';
import { SuddenDeathService } from './sudden-death.service.js';
import { selectPriorityCandidates } from '../powers/domain/priority.js';

type Policy = 'SHARED_PRIZE' | 'SUDDEN_DEATH';
export interface Category extends QueryResultRow {id:string;game_id:string;rule_type:RuleType;name:string;active:boolean;max_winners:number;tie_break_policy:Policy;sudden_death_interval_seconds:number;sudden_death_ticket_size:number;}
interface Ticket extends QueryResultRow {id:string;player_id:string;grid:Grid;status:string;}
interface Eligibility extends QueryResultRow {category_id:string;player_id:string;ticket_id:string;first_eligible_sequence:number;}
function uuid(raw:unknown):string {if(typeof raw!=='string'|| !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw))throw new BadRequestException('Invalid UUID');return raw;}
function authenticateAdmin(key?:string):void {const configured=process.env.ADMIN_TOKEN;if(!configured||!key||!timingSafeEqual(createHash('sha256').update(key).digest(),createHash('sha256').update(configured).digest()))throw new UnauthorizedException('Admin key required');}

@Injectable()
export class WinnersService {
  constructor(private readonly db:DatabaseService){}
  async categories(gameIdRaw:string){const gameId=uuid(gameIdRaw);return (await this.db.query<Category>('SELECT * FROM winning_categories WHERE game_id=$1 ORDER BY rule_type',[gameId])).rows;}
  async addCategory(gameIdRaw:string,key:string|undefined,input:Record<string,unknown>) {
    authenticateAdmin(key);const gameId=uuid(gameIdRaw);
    const name=String(input.name??'').trim(), rule=String(input.ruleType??''), prize=String(input.prizeDescription??'').trim();
    const policy=input.tieBreakPolicy??'SHARED_PRIZE';
    if(!name || name.length>80 || !Object.hasOwn(RULE_LABELS,rule) || prize.length>200 || !['SHARED_PRIZE','SUDDEN_DEATH'].includes(String(policy)))
      throw new BadRequestException('Choose a supported rule, name (1–80 characters), prize (up to 200 characters) and tie policy.');
    return this.db.transaction(async client=>{
      const game=(await client.query<{status:string}>('SELECT status FROM games WHERE id=$1 FOR UPDATE',[gameId])).rows[0];
      if(!game) throw new NotFoundException('Game not found');
      if(game.status!=='CREATED') throw new ConflictException('Set categories before play starts.');
      const duplicate=await client.query(`SELECT 1 FROM winning_categories WHERE game_id=$1 AND
        (lower(name)=lower($2) OR (rule_type=$3 AND rule_type IN ('FULL_HOUSE','SECOND_FULL_HOUSE')))`,[gameId,name,rule]);
      if(duplicate.rowCount) throw new ConflictException('Category name or house rule already exists.');
      const result=await client.query(`INSERT INTO winning_categories(id,game_id,rule_type,name,prize_description,tie_break_policy)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[randomUUID(),gameId,rule,name,prize,policy]);
      return result.rows[0];
    });
  }
  async configure(gameIdRaw:string,categoryIdRaw:string,key:string|undefined,input:Record<string,unknown>){
    authenticateAdmin(key);const gameId=uuid(gameIdRaw),categoryId=uuid(categoryIdRaw);
    const allowed=['active','maxWinners','tieBreakPolicy','suddenDeathIntervalSeconds','suddenDeathTicketSize','name','prizeDescription'];
    if(Object.keys(input??{}).some(k=>!allowed.includes(k)))throw new BadRequestException('Unsupported configuration property');
    const patch=input??{};
    if(patch.name!==undefined && (typeof patch.name!=='string'||!patch.name.trim()||patch.name.length>80))throw new BadRequestException('Invalid name');
    if(patch.prizeDescription!==undefined && (typeof patch.prizeDescription!=='string'||patch.prizeDescription.length>200))throw new BadRequestException('Invalid prize description');
    if(patch.active!==undefined&&typeof patch.active!=='boolean')throw new BadRequestException('active must be boolean');
    if(patch.tieBreakPolicy!==undefined&&!['SHARED_PRIZE','SUDDEN_DEATH'].includes(String(patch.tieBreakPolicy)))throw new BadRequestException('Invalid tie policy');
    for(const [keyName,min,max] of [['maxWinners',1,100],['suddenDeathIntervalSeconds',2,300],['suddenDeathTicketSize',1,15]] as const){if(patch[keyName]!==undefined&&(!Number.isInteger(patch[keyName])||Number(patch[keyName])<min||Number(patch[keyName])>max))throw new BadRequestException(`Invalid ${keyName}`);}
    return this.db.transaction(async client=>{
      const game=await client.query<{status:string}>('SELECT status FROM games WHERE id=$1 FOR UPDATE',[gameId]);if(!game.rows[0])throw new NotFoundException('Game not found');if(game.rows[0].status!=='CREATED')throw new ConflictException('Categories can only be configured before game starts');
      if(typeof patch.name==='string') {
        patch.name=patch.name.trim();
        const duplicate=await client.query('SELECT 1 FROM winning_categories WHERE game_id=$1 AND id<>$2 AND lower(name)=lower($3)',[gameId,categoryId,patch.name]);
        if(duplicate.rowCount) throw new ConflictException('Category name already exists.');
      }
      const updated=await client.query<Category>(`UPDATE winning_categories SET name=COALESCE($8,name),prize_description=COALESCE($9,prize_description),active=COALESCE($3,active),max_winners=COALESCE($4,max_winners),tie_break_policy=COALESCE($5,tie_break_policy),sudden_death_interval_seconds=COALESCE($6,sudden_death_interval_seconds),sudden_death_ticket_size=COALESCE($7,sudden_death_ticket_size) WHERE game_id=$1 AND id=$2 RETURNING *`,[gameId,categoryId,patch.active??null,patch.maxWinners??null,patch.tieBreakPolicy??null,patch.suddenDeathIntervalSeconds??null,patch.suddenDeathTicketSize??null,patch.name??null,patch.prizeDescription??null]);if(!updated.rows[0])throw new NotFoundException('Category not found');return updated.rows[0];
    });
  }
  /** Snapshot the earliest qualifying call sequence. Executed INSIDE the same draw transaction. */
  static async snapshot(client:PoolClient,gameId:string,sequence:number):Promise<void>{
    const categories=(await client.query<Category>('SELECT * FROM winning_categories WHERE game_id=$1 AND active=true',[gameId])).rows;
    const tickets=(await client.query<Ticket>("SELECT id,player_id,grid,status FROM tickets WHERE game_id=$1 AND status='SUBMITTED' AND player_id IS NOT NULL",[gameId])).rows;
    const draw=(await client.query<{number:number}>('SELECT number FROM called_numbers WHERE game_id=$1 AND sequence <= $2 ORDER BY sequence',[gameId,sequence])).rows.map(r=>Number(r.number));
    for(const category of categories){
      // Second Full House is only eligible after the First Full House has been awarded.
      if(category.rule_type==='SECOND_FULL_HOUSE')continue;
      for(const ticket of tickets){
        const eligibleSequence=eligibleAtSequence(ticket.grid,category.rule_type,draw);
        if(eligibleSequence===null)continue;
        await client.query(`INSERT INTO category_eligibility(id,game_id,category_id,ticket_id,player_id,first_eligible_sequence) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(category_id,ticket_id) DO NOTHING`,[randomUUID(),gameId,category.id,ticket.id,ticket.player_id,eligibleSequence]);
      }
    }
    await SuddenDeathService.seedSecondHouse(client,gameId);
  }
  private async player(gameId:string,token?:string):Promise<string>{
    const match=/^Bearer ([A-Za-z0-9_-]{40,100})$/.exec(token??'');if(!match)throw new UnauthorizedException('Player token required');
    const rows=await this.db.query<{id:string}>('SELECT id FROM players WHERE game_id=$1 AND token_hash=$2',[gameId,createHash('sha256').update(match[1]).digest('hex')]);if(!rows.rows[0])throw new UnauthorizedException('Unknown player token');return rows.rows[0].id;
  }
  async claim(gameIdRaw:string,auth:string|undefined,categoryIdRaw:unknown){
    const gameId=uuid(gameIdRaw),categoryId=uuid(categoryIdRaw),playerId=await this.player(gameId,auth);
    return this.db.transaction(async client=>{
      const game=await client.query<{status:string}>('SELECT status FROM games WHERE id=$1 FOR UPDATE',[gameId]);if(!game.rows[0])throw new NotFoundException('Game not found');
      if((await client.query('SELECT 1 FROM games WHERE id=$1 AND ended_by_admin=true',[gameId])).rowCount)throw new ConflictException('Game ended by host.');
      const category=await client.query<Category>('SELECT * FROM winning_categories WHERE id=$1 AND game_id=$2',[categoryId,gameId]);if(!category.rows[0]||!category.rows[0].active)throw new NotFoundException('Category not found');
      if((await client.query('SELECT 1 FROM category_outcomes WHERE category_id=$1',[categoryId])).rowCount)throw new ConflictException('Prize already resolved');
      const row=await client.query<Eligibility>(`SELECT e.* FROM category_eligibility e JOIN tickets t ON t.id=e.ticket_id WHERE e.category_id=$1 AND e.player_id=$2 AND t.status='SUBMITTED'`,[categoryId,playerId]);
      const found=row.rows[0];if(!found)throw new ConflictException('Ticket is not eligible for this prize');
      const result=await client.query(`INSERT INTO winner_claims(id,game_id,category_id,player_id,ticket_id,first_eligible_sequence) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(category_id,ticket_id) DO UPDATE SET claimed_at=winner_claims.claimed_at RETURNING *`,[randomUUID(),gameId,categoryId,playerId,found.ticket_id,found.first_eligible_sequence]);return result.rows[0];
    });
  }
  async listClaims(gameIdRaw:string,key?:string){authenticateAdmin(key);return (await this.db.query(`SELECT c.*,p.name FROM winner_claims c JOIN players p ON p.id=c.player_id WHERE c.game_id=$1 ORDER BY c.claimed_at`,[uuid(gameIdRaw)])).rows;}
  async listEligible(gameIdRaw:string,key?:string){authenticateAdmin(key);return (await this.db.query(`SELECT e.*,p.name,w.name AS category_name,w.rule_type,t.ticket_number FROM category_eligibility e JOIN players p ON p.id=e.player_id JOIN winning_categories w ON w.id=e.category_id JOIN tickets t ON t.id=e.ticket_id WHERE e.game_id=$1 AND t.status='SUBMITTED' ORDER BY w.rule_type,e.first_eligible_sequence,p.name`,[uuid(gameIdRaw)])).rows;}
  async resolve(gameIdRaw:string,categoryIdRaw:string,key?:string){
    authenticateAdmin(key);const gameId=uuid(gameIdRaw),categoryId=uuid(categoryIdRaw);
    return this.db.transaction(async client=>{
      const game=await client.query<{status:string}>('SELECT status FROM games WHERE id=$1 FOR UPDATE',[gameId]);if(!game.rows[0])throw new NotFoundException('Game not found');
      if(!['PAUSED','COMPLETED'].includes(game.rows[0].status))throw new ConflictException('Pause the game before resolving a prize');
      const category=(await client.query<Category>('SELECT * FROM winning_categories WHERE id=$1 AND game_id=$2',[categoryId,gameId])).rows[0];if(!category||!category.active)throw new NotFoundException('Active category not found');
      if((await client.query('SELECT 1 FROM category_outcomes WHERE category_id=$1',[categoryId])).rowCount)throw new ConflictException('Prize already resolved');
      const first=await client.query<Eligibility>(`SELECT e.* FROM category_eligibility e JOIN tickets t ON t.id=e.ticket_id WHERE e.category_id=$1 AND t.status='SUBMITTED' ORDER BY first_eligible_sequence LIMIT 1`,[categoryId]);
      if(!first.rows[0])throw new ConflictException('Nobody has qualified for this category');
      let sequence=Number(first.rows[0].first_eligible_sequence);
      let ties=(await client.query<Eligibility>(`SELECT e.* FROM category_eligibility e JOIN tickets t ON t.id=e.ticket_id WHERE e.category_id=$1 AND t.status='SUBMITTED' AND e.first_eligible_sequence=$2 ORDER BY e.player_id`,[categoryId,sequence])).rows;
      const priority=await client.query<{powered_player_id:string;call_sequence:number;closes_at:Date}>(
        'SELECT powered_player_id,call_sequence,closes_at FROM power_priority_windows WHERE category_id=$1',[categoryId]);
      if(priority.rows[0]){
        const window=priority.rows[0];
        if(new Date(window.closes_at).getTime()>Date.now()){
          throw new ConflictException('Lucky Strike priority claim window is still open (30 seconds).');
        }
        const eligible=(await client.query<Eligibility & {claimed:boolean}>(`SELECT e.*,
          EXISTS(SELECT 1 FROM winner_claims wc WHERE wc.category_id=e.category_id
            AND wc.player_id=e.player_id AND wc.status='PENDING'
            AND wc.claimed_at <= $3::timestamptz) AS claimed
          FROM category_eligibility e JOIN tickets t ON t.id=e.ticket_id
          WHERE e.category_id=$1 AND t.status='SUBMITTED' AND e.first_eligible_sequence<=$2`,
          [categoryId,window.call_sequence,window.closes_at])).rows;
        const selected=selectPriorityCandidates(eligible.map(e=>({playerId:e.player_id,
          ticketId:e.ticket_id,sequence:e.first_eligible_sequence,claimed:e.claimed})),
          window.powered_player_id,window.call_sequence);
        if(!selected.length) throw new ConflictException('No eligible player remains for this prize');
        const selectedIds=new Set(selected.map(p=>p.ticketId));
        ties=eligible.filter(e=>selectedIds.has(e.ticket_id));
        sequence=Math.min(...ties.map(e=>Number(e.first_eligible_sequence)));
      }
      // The earliest qualification sequence wins; all players tying at that draw share by default.
      const pendingSuddenDeath=category.tie_break_policy==='SUDDEN_DEATH'&&ties.length>1;
      await client.query(`INSERT INTO category_outcomes(category_id,game_id,tie_break_policy,resolved_sequence,status) VALUES ($1,$2,$3,$4,$5)`,[categoryId,gameId,category.tie_break_policy,sequence,pendingSuddenDeath?'SUDDEN_DEATH_PENDING':'RESOLVED']);
      let roundId:string|null=null;
      if(pendingSuddenDeath){
        roundId=await SuddenDeathService.create(client,gameId,categoryId,category.sudden_death_interval_seconds,category.sudden_death_ticket_size,ties);
      } else {
        // All players first eligible on this main-game draw share by default.
        for(const e of ties){await client.query(`INSERT INTO winners(id,category_id,game_id,player_id,ticket_id) VALUES($1,$2,$3,$4,$5)`,[randomUUID(),categoryId,gameId,e.player_id,e.ticket_id]);}
        if(category.rule_type==='FULL_HOUSE')await SuddenDeathService.seedSecondHouse(client,gameId);
      }
      await client.query(`UPDATE winner_claims SET status=CASE WHEN player_id=ANY($2::uuid[]) THEN 'VALID' ELSE 'REJECTED' END,reviewed_at=NOW() WHERE category_id=$1`,[categoryId,ties.map(t=>t.player_id)]);
      return {categoryId,sequence,roundId,policy:category.tie_break_policy,status:pendingSuddenDeath?'SUDDEN_DEATH_PENDING':'RESOLVED',winners:pendingSuddenDeath?[]:ties.map(t=>({playerId:t.player_id,ticketId:t.ticket_id})),tiedPlayers:pendingSuddenDeath?ties.map(t=>({playerId:t.player_id,ticketId:t.ticket_id})):[]};
    });
  }
}
