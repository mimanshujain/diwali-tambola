// Isolated legacy-schema upgrade test. The caller supplies a dedicated pg Client.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MILESTONE_2_MIGRATION} from '../apps/server/dist/database/migrations/001_game_engine.js';
import {MILESTONE_3_MIGRATION} from '../apps/server/dist/database/migrations/002_players.js';
import {MILESTONE_4_MIGRATION} from '../apps/server/dist/database/migrations/003_winner_engine.js';
import {MILESTONE_4B_MIGRATION} from '../apps/server/dist/database/migrations/004_sudden_death.js';
import {MILESTONE_5_MIGRATION} from '../apps/server/dist/database/migrations/005_power.js';
import {MILESTONE_7_MIGRATION} from '../apps/server/dist/database/migrations/006_live_updates.js';
import {SHORT_GAME_CODE_MIGRATION} from '../apps/server/dist/database/migrations/007_short_game_codes.js';
import {PARTY_OPERATIONS_MIGRATION} from '../apps/server/dist/database/migrations/008_party_operations.js';
export async function migrationChecks(client){
 await client.query('BEGIN');
 try{
  await client.query('CREATE SCHEMA legacy_upgrade_test; SET LOCAL search_path TO legacy_upgrade_test,public');
  for(const sql of [MILESTONE_2_MIGRATION,MILESTONE_3_MIGRATION,MILESTONE_4_MIGRATION,MILESTONE_4B_MIGRATION,MILESTONE_5_MIGRATION,MILESTONE_7_MIGRATION,SHORT_GAME_CODE_MIGRATION])await client.query(sql);
  const id=randomUUID(),playerId=randomUUID(),numbers=Array.from({length:15},(_,i)=>i+1);
  await client.query("INSERT INTO games(id,name,remaining_numbers,join_code) VALUES($1,'Legacy game',$2,'ABC234')",[id,Array.from({length:90},(_,i)=>i+1)]);
  await client.query("INSERT INTO players(id,game_id,name,mobile,device_id,token_hash) VALUES($1,$2,'Legacy player','15550001234',$3,'test-hash')",[playerId,id,randomUUID()]);
  for(let i=1;i<=2;i++)await client.query("INSERT INTO tickets(id,game_id,ticket_number,grid,numbers) VALUES($1,$2,$3,'[]',$4)",[randomUUID(),id,i,numbers]);
  await client.query(PARTY_OPERATIONS_MIGRATION);
  assert.equal((await client.query('SELECT approved FROM players WHERE id=$1',[playerId])).rows[0].approved,true);
  assert.equal((await client.query('SELECT count(*)::int AS count FROM tickets WHERE game_id=$1',[id])).rows[0].count,2);
  assert.equal((await client.query("SELECT count(*) FROM tickets WHERE game_id=$1 GROUP BY numbers HAVING count(*)>1",[id])).rowCount,1);
 }finally{await client.query('ROLLBACK');}
}
