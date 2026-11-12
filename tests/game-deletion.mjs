// Disposable game deletion acceptance; also called by the isolated rehearsal.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export async function deletionChecks({base,key,query}){
 const request=async(path,{method='GET',body,admin=false,token,status}={})=>{
  const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(admin?{'x-admin-key':key}:{}),...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const d=await r.json();if(status)assert.equal(r.status,status,JSON.stringify(d));else assert.ok(r.ok,path+': '+JSON.stringify(d));return d;
 };
 const post={method:'POST',admin:true},create=name=>request('/games',{...post,body:{name,intervalSeconds:3600}});
 const other=await create('Delete control game'),game=await create('Delete populated game'),root='/games/'+game.id;
 const remove={method:'DELETE',admin:true,body:{confirmationCode:game.joinCode}};
 const player=await request(root+'/players/register',{method:'POST',body:{name:'Delete Guest',deviceId:randomUUID()}});
 await request(root+'/admin/players/'+player.player.id+'/approve',post);
 await request(root+'/admin/players/'+player.player.id+'/reissue',{...post,body:{reason:'Deletion history test'}});
 const me=await request(root+'/players/me',{token:player.token});
 await request(root+'/start',post);
 const power=await request(root+'/players/me/power/request',{method:'POST',token:player.token,body:{number:me.ticket.numbers[4]}});
 await request(root+'/admin/power-requests/'+power.id+'/approve',post);await request(root+'/resume',post);
 for(const number of me.ticket.numbers.slice(0,4))await request(root+'/calls/manual',{...post,body:{number}});
 const categories=await request(root+'/categories'),five=categories.find(c=>c.rule_type==='EARLY_FIVE');
 const claim=await request(root+'/players/me/claims',{method:'POST',token:player.token,body:{categoryId:five.id}});
 await request(root+'/admin/claims/'+claim.id+'/review',post);
 const before=await request(root+'/display');assert.ok(before.review);
 await request(root+'/admin/game',{method:'DELETE',body:remove.body,status:401});
 await request(root+'/admin/game',{...remove,body:{confirmationCode:other.joinCode},status:400});
 await request(root+'/admin/game',{...remove,body:{},status:400});
 const unchanged=await request(root+'/display');delete unchanged.serverTime;delete before.serverTime;assert.deepEqual(unchanged,before);
 let roundId;
 if(query){
  // Populate every dependency, including an active mini-round and a winner.
  roundId=randomUUID();const house=categories.find(c=>c.rule_type==='FULL_HOUSE');
  await query("INSERT INTO category_outcomes(category_id,game_id,tie_break_policy,resolved_sequence) VALUES($1,$2,'SHARED_PRIZE',5)",[house.id,game.id]);
  await query('INSERT INTO winners(id,category_id,game_id,player_id,ticket_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),house.id,game.id,player.player.id,me.ticket.id]);
  await query("INSERT INTO sudden_death_rounds(id,game_id,category_id,status,interval_seconds,ticket_size,remaining_numbers,next_call_at) VALUES($1,$2,$3,'RUNNING',120,5,$4,NOW()+INTERVAL '120 seconds')",[roundId,game.id,house.id,[1,2,3,4,5]]);
  await query('INSERT INTO sudden_death_entries(round_id,player_id,ticket_id,numbers) VALUES($1,$2,$3,$4)',[roundId,player.player.id,me.ticket.id,[1,2,3,4,5]]);
  await query('INSERT INTO sudden_death_calls(round_id,sequence,number) VALUES($1,1,90)',[roundId]);
  await query("INSERT INTO power_priority_windows(category_id,game_id,power_request_id,powered_player_id,call_sequence,closes_at) VALUES($1,$2,$3,$4,1,NOW()) ON CONFLICT DO NOTHING",[five.id,game.id,power.id,player.player.id]);
  // An error at the last delete must restore every prior deletion and the review pointer.
  await query("CREATE FUNCTION test_block_game_delete() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Simulated delete failure'; END $$ LANGUAGE plpgsql; CREATE TRIGGER test_block_game_delete BEFORE DELETE ON games FOR EACH ROW EXECUTE FUNCTION test_block_game_delete()");
  try{await request(root+'/admin/game',{...remove,status:500});assert.ok((await request(root+'/display')).review);assert.equal((await request(root+'/players/me',{token:player.token})).ticket.id,me.ticket.id);}
  finally{await query('DROP TRIGGER test_block_game_delete ON games; DROP FUNCTION test_block_game_delete()');}
 }
 assert.equal((await request(root+'/admin/game',remove)).deleted,true);
 await request(root,{status:404});await request(root+'/players/me',{token:player.token,status:401});
 assert.ok(!(await request('/games',{admin:true})).some(g=>g.id===game.id));assert.equal((await request('/games/'+other.id)).id,other.id);
 if(query){
  for(const table of ['games','players','tickets','called_numbers','winning_categories','winner_claims','category_eligibility','category_outcomes','winners','player_powers','power_requests','power_priority_windows','ticket_reissue_history','sudden_death_rounds','game_events']){
   assert.equal((await query(`SELECT count(*)::int AS n FROM ${table} WHERE ${table==='games'?'id':'game_id'}=$1`,[game.id])).rows[0].n,0,table);
  }
  for(const table of ['sudden_death_entries','sudden_death_calls'])assert.equal((await query(`SELECT count(*)::int AS n FROM ${table} WHERE round_id=$1`,[roundId])).rows[0].n,0,table);
 }
 for(const state of ['CREATED','RUNNING','COMPLETED']){
  const g=await create('Delete '+state),r='/games/'+g.id;
  if(state!=='CREATED')await request(r+'/start',post);if(state==='COMPLETED')await request(r+'/admin/end',post);
  await request(r+'/admin/game',{method:'DELETE',admin:true,body:{confirmationCode:g.joinCode.toLowerCase()}});await request(r,{status:404});
 }
 console.log('PASS game deletion authorization, confirmation, state cleanup and game isolation');
}
export async function deletionBrowserChecks({browser,base,key}){
 const context=await browser.newContext(),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const create=async name=>(await fetch(base+'/games',{method:'POST',headers:{'content-type':'application/json','x-admin-key':key},body:JSON.stringify({name,intervalSeconds:3600})})).json();
 const cardGame=await create('Delete from dashboard'),consoleGame=await create('Delete from console');
 await page.goto(base+'/admin');await page.locator('#key').fill(key);await page.locator('#load').click();
 const card=page.locator('.game-card').filter({hasText:cardGame.name});await card.waitFor();
 page.once('dialog',d=>d.dismiss());await card.getByRole('button',{name:'Delete game…',exact:true}).click();assert.equal(await card.count(),1);
 page.once('dialog',d=>d.accept('WRONG'));await card.getByRole('button',{name:'Delete game…',exact:true}).click();assert.equal(await card.count(),1);
 page.once('dialog',d=>d.accept(cardGame.joinCode));await card.getByRole('button',{name:'Delete game…',exact:true}).click();await card.waitFor({state:'detached'});
 await page.goto(base+'/admin/'+consoleGame.id);await page.waitForFunction(()=>document.querySelector('#game-code').textContent.length===6);
 await page.getByText('Manual call, ending & deleting',{exact:true}).click();
 page.once('dialog',d=>d.accept(consoleGame.joinCode));await page.locator('#delete-game').click();await page.waitForURL(base+'/admin');
 assert.equal((await fetch(base+'/games/'+consoleGame.id)).status,404);assert.deepEqual(errors,[]);
 console.log('PASS delete buttons, cancel, wrong code, confirmed deletion and console redirect');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){assert.ok(process.env.ADMIN_TOKEN);await deletionChecks({base:process.env.TAMBOLA_URL||'http://127.0.0.1:3000',key:process.env.ADMIN_TOKEN});}
