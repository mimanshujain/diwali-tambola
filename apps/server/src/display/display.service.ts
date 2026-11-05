import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { TambolaService } from '../tambola/tambola.service.js';
import { assertAdmin } from '../security/admin.js';
import type { QueryResultRow } from 'pg';
import { publicGuestOrigin } from './guest-origin.js';
const uuid = (s:string):string => {
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(s))
    throw new BadRequestException('Invalid UUID');
  return s;
};
interface PlayerDisplay extends QueryResultRow {id:string;name:string;ticket_number:number;status:string;}
@Injectable()
export class DisplayService {
  constructor(private readonly db:DatabaseService,private readonly tambola:TambolaService){}
  async snapshot(gameIdRaw:string):Promise<Record<string,unknown>> {
    const id=uuid(gameIdRaw);
    const game=await this.tambola.getGame(id);
    const [calls,players,categories,winners,powers,rounds]=await Promise.all([
      this.tambola.listCalls(id),
      this.db.query<PlayerDisplay>(`SELECT p.id,p.name,t.ticket_number,t.status FROM players p
        JOIN tickets t ON t.player_id=p.id AND t.status IN ('ASSIGNED','SUBMITTED')
        WHERE p.game_id=$1 ORDER BY p.created_at`,[id]),
      this.db.query<{id:string;name:string;rule_type:string;tie_break_policy:string;status:string|null}>(
        `SELECT c.id,c.name,c.rule_type,c.tie_break_policy,o.status FROM winning_categories c
         LEFT JOIN category_outcomes o ON o.category_id=c.id WHERE c.game_id=$1 AND c.active=true ORDER BY c.name`,[id]),
      this.db.query<{name:string;category_name:string;sequence:number}>(
        `SELECT p.name,c.name AS category_name,o.resolved_sequence AS sequence FROM winners w
         JOIN players p ON p.id=w.player_id JOIN winning_categories c ON c.id=w.category_id
         JOIN category_outcomes o ON o.category_id=c.id WHERE w.game_id=$1
         ORDER BY w.declared_at`,[id]),
      this.db.query<{name:string;number:number;sequence:number}>(
        `SELECT p.name,c.number,c.sequence FROM called_numbers c
         JOIN power_requests r ON r.id=c.power_request_id JOIN players p ON p.id=r.player_id
         WHERE c.game_id=$1 ORDER BY c.sequence DESC LIMIT 4`,[id]),
      this.db.query<{category_name:string;status:string;draw_sequence:number}>(
        `SELECT c.name AS category_name,r.status,r.draw_sequence FROM sudden_death_rounds r
         JOIN winning_categories c ON c.id=r.category_id WHERE r.game_id=$1 ORDER BY r.created_at DESC LIMIT 4`,[id]),
    ]);
    return {game,calls,guestOrigin:publicGuestOrigin(),players:players.rows.map(p=>({id:p.id,name:p.name,ticketNumber:p.ticket_number,
      submitted:p.status==='SUBMITTED'})),categories:categories.rows,winners:winners.rows,
      powerCalls:powers.rows,suddenDeath:rounds.rows};
  }
  /** Internet-facing display data. Deliberately excludes rosters, winners' names,
   * player identifiers, phone numbers, admin data and Lucky Strike identities. */
  async guestSnapshot(gameIdRaw: string): Promise<Record<string, unknown>> {
    const id = uuid(gameIdRaw);
    const [game, calls, categories] = await Promise.all([
      this.tambola.getGame(id),
      this.tambola.listCalls(id),
      this.db.query<{id:string;name:string;active:boolean;status:string|null}>(
        `SELECT c.id,c.name,c.active,o.status
         FROM winning_categories c LEFT JOIN category_outcomes o ON o.category_id=c.id
         WHERE c.game_id=$1 AND c.active=true ORDER BY c.name`, [id],
      ),
    ]);
    return {
      game: {
        id: game.id, name: game.name, status: game.status,
        nextCallAt: game.nextCallAt,
      },
      calls: calls.map(call => ({number: call.number, sequence: call.sequence})),
      categories: categories.rows,
    };
  }
  async resolveJoinCode(rawCode: string): Promise<string> {
    const code = rawCode.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new NotFoundException('Game code not found');
    const result = await this.db.query<{id:string}>(
      'SELECT id FROM games WHERE join_code=$1', [code],
    );
    if (!result.rows[0]) throw new NotFoundException('Game code not found');
    return result.rows[0].id;
  }
  async adminTicket(gameIdRaw:string,playerIdRaw:string,key?:string):Promise<Record<string,unknown>>{
    assertAdmin(key);const gameId=uuid(gameIdRaw),playerId=uuid(playerIdRaw);
    const row=await this.db.query<{name:string;ticket_number:number;grid:(number|null)[][];status:string}>(
      `SELECT p.name,t.ticket_number,t.grid,t.status FROM players p
       JOIN tickets t ON t.player_id=p.id AND t.status IN ('ASSIGNED','SUBMITTED')
       WHERE p.id=$1 AND p.game_id=$2`,[playerId,gameId]);
    if(!row.rows[0])throw new NotFoundException('Active ticket not found');
    return {playerName:row.rows[0].name,ticketNumber:row.rows[0].ticket_number,
      grid:row.rows[0].grid,status:row.rows[0].status};
  }
}
