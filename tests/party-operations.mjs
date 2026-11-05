// Run against a disposable database: ADMIN_TOKEN=... TAMBOLA_URL=... node tests/party-operations.mjs
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
function client(base,key){return async function request(path,{method='GET',body,token,admin=false,status}={}){
 const response=await fetch(base+path,{method,headers:{'content-type':'application/json',...(admin?{'x-admin-key':key}:{}),...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();if(status)assert.equal(response.status,status,JSON.stringify(data));else assert.ok(response.ok,path+': '+JSON.stringify(data));return data;
};}
export async function operations({base,key,query}){
 const request=client(base,key),admin={method:'POST',admin:true};
 const game=await request('/games',{...admin,body:{name:'Diwali validation',intervalSeconds:3600}}),root='/games/'+game.id;
 const register=(name,deviceId=randomUUID())=>request(root+'/players/register',{method:'POST',body:{name,deviceId}});
 await request('/games',{status:401});
 let player=await register('Asha Shah');const device=randomUUID(),draft=player.ticket;
 assert.equal(player.player.approved,false);assert.match(player.recoveryCode,/^[a-f0-9]{32}$/);
 await request(root+'/players/register',{method:'POST',body:{name:' ASHA   Shah ',deviceId:randomUUID()},status:409});
 await request(root+'/players/me/submit',{method:'POST',token:player.token,body:{ticketId:draft.id},status:403});
 await request(root+'/admin/players/'+player.player.id+'/approve',{method:'POST',status:401});
 await request(root+'/admin/players/'+player.player.id+'/approve',admin);
 const regenerated=await request(root+'/players/me/regenerate',{method:'POST',token:player.token});assert.notEqual(regenerated.ticket.id,draft.id);
 await request(root+'/players/me/submit',{method:'POST',token:player.token,body:{ticketId:draft.id},status:409});
 const submit={method:'POST',token:player.token,body:{ticketId:regenerated.ticket.id}};
 const submitted=await request(root+'/players/me/submit',submit);assert.equal(submitted.ticket.status,'SUBMITTED');
 assert.deepEqual((await request(root+'/players/me/submit',submit)).ticket,submitted.ticket);
 await request(root+'/players/me/regenerate',{method:'POST',token:player.token,status:409});
 const oldToken=player.token;
 const restored=await request(root+'/players/recover',{method:'POST',body:{recoveryCode:player.recoveryCode,deviceId:device}});
 assert.deepEqual(restored.ticket,submitted.ticket);await request(root+'/players/me',{token:oldToken,status:401});player={...player,...restored};
 const reset=await request(root+'/admin/players/'+player.player.id+'/reset-access',admin);
 await request(root+'/players/recover',{method:'POST',body:{recoveryCode:player.recoveryCode,deviceId:device},status:401});
 player={...player,...await request(root+'/players/recover',{method:'POST',body:{recoveryCode:reset.recoveryCode,deviceId:device}})};
 const duplicateDevice=await request(root+'/players/register',{method:'POST',body:{name:'Another person',deviceId:device},status:409});assert.ok(duplicateDevice.message);
 const category=await request(root+'/admin/categories',{...admin,body:{name:'Diwali Seven',ruleType:'EARLY_SEVEN',prizeDescription:'Gift hamper'}});
 await request(root+'/admin/categories',{...admin,body:{name:'Diwali Seven',ruleType:'EARLY_TEN'},status:409});
 await request(root+'/admin/categories',{...admin,body:{name:'Invalid',ruleType:'UNKNOWN'},status:400});
 await request(root+'/admin/categories/'+category.id,{method:'PATCH',admin:true,body:{name:'Early Five'},status:409});
 assert.ok((await request(root+'/display')).categories.some(c=>c.id===category.id&&c.prize_description==='Gift hamper'));
 const noShow=await register('No Show');await request(root+'/start',{...admin,status:409});
 await request(root+'/admin/players/'+noShow.player.id+'/withdraw',admin);
 // Multiple simultaneous registrations receive distinct tickets and sequential ticket numbers.
 const guests=await Promise.all(Array.from({length:12},(_,i)=>register('Concurrent '+i)));
 assert.equal(new Set(guests.map(p=>p.ticket.numbers.join(','))).size,guests.length);
 for(const p of guests){await request(root+'/admin/players/'+p.player.id+'/approve',admin);await request(root+'/players/me/submit',{method:'POST',token:p.token,body:{ticketId:p.ticket.id}});}
 if(query){
  assert.equal((await query('SELECT mobile FROM players WHERE game_id=$1',[game.id])).rows.every(p=>p.mobile===null),true);
  // This expired draft's number set is free. Concurrent direct writes must still be unique.
  const insert=(num)=>query("INSERT INTO tickets(id,game_id,ticket_number,grid,numbers) VALUES($1,$2,$3,$4,$5)",[randomUUID(),game.id,num,JSON.stringify(draft.grid),draft.numbers]);
  const results=await Promise.allSettled([insert(9001),insert(9002)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.find(x=>x.status==='rejected').reason.constraint,'tickets_unique_numbers');
  // A legacy conflict is retained and reported; the host must fix it before the first draw.
  await query('ALTER TABLE tickets DISABLE TRIGGER ticket_number_set_guard');
  try{await insert(9003);}finally{await query('ALTER TABLE tickets ENABLE TRIGGER ticket_number_set_guard');}
  assert.equal((await request(root+'/admin/ticket-conflicts',{admin:true})).length,1);
  await request(root+'/start',{...admin,status:409});
  await query("UPDATE tickets SET status='REVOKED' WHERE game_id=$1 AND ticket_number>=9000",[game.id]);
 }
 assert.deepEqual(await request(root+'/admin/ticket-conflicts',{admin:true}),[]);
 await request(root+'/admin/timer',{...admin,body:{seconds:240}});assert.equal((await request(root)).pausedRemainingSeconds,240);
 await request(root+'/start',admin);assert.ok(new Date((await request(root)).nextCallAt)-Date.now()>235000);
 await request(root+'/players/register',{method:'POST',body:{name:'Late Guest',deviceId:randomUUID()},status:409});
 await request(root+'/admin/players/'+player.player.id+'/reissue',{...admin,body:{reason:'Late request'},status:409});
 await request(root+'/admin/categories',{...admin,body:{name:'Late prize',ruleType:'EARLY_TEN'},status:409});
 await request(root+'/admin/timer',{...admin,body:{seconds:77,intervalSeconds:90}});
 let view=await request(root);assert.equal(view.intervalSeconds,90);assert.ok(new Date(view.nextCallAt)-Date.now()>74000);
 const race=await Promise.allSettled([0,1].map(()=>request(root+'/admin/call-next',{...admin,body:{expectedSequence:1}})));
 assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.match(race.find(r=>r.status==='rejected').reason.message,/Another call was made/);assert.equal((await request(root+'/calls')).length,1);
 await request(root+'/admin/stop',admin);view=await request(root);assert.equal(view.status,'PAUSED');assert.equal(view.emergencyStopped,true);
 await request(root+'/admin/call-next',{...admin,body:{expectedSequence:2},status:409});await request(root+'/resume',{...admin,status:409});
 await request(root+'/admin/release-stop',admin);assert.equal((await request(root)).status,'PAUSED');await request(root+'/resume',admin);
 await request(root+'/admin/end',admin);assert.equal((await request(root)).endedByAdmin,true);
 await request(root+'/admin/release-stop',{...admin,status:409});await request(root+'/resume',{...admin,status:409});
 const events=await request(root+'/admin/audit',{admin:true});assert.ok(events.some(e=>e.action==='PLAYER_ACCESS_RESET'));assert.ok(!JSON.stringify(events).includes(reset.recoveryCode));
 const games=await request('/games',{admin:true});assert.ok(games.some(g=>g.id===game.id&&g.submittedCount===13));
 const lobby=await request('/games',{...admin,body:{name:'Lights, laughter & lucky numbers',intervalSeconds:3600}});
 return {game,lobby,player,request};
}
export async function recoveryChecks({base,key,query,stop,start}){
 const request=client(base,key),admin={method:'POST',admin:true};
 const game=await request('/games',{...admin,body:{name:'Crash recovery test',intervalSeconds:120}}),root='/games/'+game.id;
 const player=await request(root+'/players/register',{method:'POST',body:{name:'Recovery Player',deviceId:randomUUID()}});
 await request(root+'/admin/players/'+player.player.id+'/approve',admin);await request(root+'/players/me/submit',{method:'POST',token:player.token,body:{ticketId:player.ticket.id}});
 await request(root+'/start',admin);
 // Qualify and settle a real prize before crashing, preserving winners and calls.
 for(const number of player.ticket.numbers.slice(0,5))await request(root+'/calls/manual',{...admin,body:{number}});
 await request(root+'/pause',admin);const early=(await request(root+'/categories')).find(c=>c.rule_type==='EARLY_FIVE');
 await request(root+'/admin/categories/'+early.id+'/resolve',admin);await request(root+'/resume',admin);
 const powerNumber=Array.from({length:90},(_,i)=>i+1).find(n=>!player.ticket.numbers.slice(0,5).includes(n));
 await request(root+'/players/me/power/request',{method:'POST',token:player.token,body:{number:powerNumber}});
 // Make two genuinely tied full-house tickets in a second game.
 const tie=await request('/games',{...admin,body:{name:'Tie-break recovery test',intervalSeconds:3600}}),tieRoot='/games/'+tie.id;
 const tied=[];for(const name of ['Tie One','Tie Two'])tied.push(await request(tieRoot+'/players/register',{method:'POST',body:{name,deviceId:randomUUID()}}));
 let shared=tied[0].ticket.numbers.find(n=>tied[1].ticket.numbers.includes(n));
 for(let attempt=0;shared===undefined&&attempt<30;attempt++){
  tied[1]={...tied[1],...await request(tieRoot+'/players/me/regenerate',{method:'POST',token:tied[1].token})};
  shared=tied[0].ticket.numbers.find(n=>tied[1].ticket.numbers.includes(n));
 }
 assert.notEqual(shared,undefined);
 for(const p of tied){await request(tieRoot+'/admin/players/'+p.player.id+'/approve',admin);await request(tieRoot+'/players/me/submit',{method:'POST',token:p.token,body:{ticketId:p.ticket.id}});}
 const house=(await request(tieRoot+'/categories')).find(c=>c.rule_type==='FULL_HOUSE');
 await request(tieRoot+'/admin/categories/'+house.id,{method:'PATCH',admin:true,body:{tieBreakPolicy:'SUDDEN_DEATH',suddenDeathIntervalSeconds:120}});
 await request(tieRoot+'/start',admin);
 for(const number of [...new Set(tied.flatMap(p=>p.ticket.numbers))].filter(n=>n!==shared).concat(shared))await request(tieRoot+'/calls/manual',{...admin,body:{number}});
 await request(tieRoot+'/pause',admin);assert.equal((await request(tieRoot+'/admin/categories/'+house.id+'/resolve',admin)).status,'SUDDEN_DEATH_PENDING');
 const roundPath=tieRoot+'/admin/categories/'+house.id+'/sudden-death';await request(roundPath+'/start',admin);
 await request(tieRoot+'/admin/stop',admin);assert.equal((await request(roundPath,{admin:true})).status,'PAUSED');
 await request(roundPath+'/start',{...admin,status:409});await request(tieRoot+'/admin/release-stop',admin);await request(roundPath+'/start',admin);
 const roundBefore=await request(roundPath,{admin:true});
 const before=await request(root+'/display');const ticketBefore=await request(root+'/players/me',{token:player.token});
 await new Promise(r=>setTimeout(r,6100));
 const checkpoint=(await query('SELECT scheduler_remaining_seconds FROM games WHERE id=$1',[game.id])).rows[0].scheduler_remaining_seconds;
 await stop('SIGKILL');await start();
 const roundAfter=await request(roundPath,{admin:true});assert.equal(roundAfter.status,'PAUSED');assert.deepEqual(roundAfter.entries,roundBefore.entries);assert.deepEqual(roundAfter.calls,roundBefore.calls);
 assert.equal((await request(root+'/players/me/power',{token:player.token})).status,'PENDING');
 const after=await request(root+'/display');assert.equal(after.game.status,'PAUSED');assert.ok(after.game.recoveredAt);assert.equal(after.game.pausedRemainingSeconds,checkpoint);
 for(const field of ['calls','players','winners'])assert.deepEqual(after[field],before[field]);
 assert.deepEqual(await request(root+'/players/me',{token:player.token}),ticketBefore);
 const restored=await request(root+'/players/recover',{method:'POST',body:{recoveryCode:player.recoveryCode,deviceId:randomUUID()}});assert.deepEqual(restored.ticket,ticketBefore.ticket);
 await request(root+'/resume',admin);await request(root+'/admin/call-next',{...admin,body:{expectedSequence:6}});
 const calls=await request(root+'/calls');assert.equal(new Set(calls.map(c=>c.number)).size,6);
 await stop('SIGTERM');await start();assert.equal((await request(root)).status,'PAUSED');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 await operations({base:process.env.TAMBOLA_URL||'http://127.0.0.1:3000',key:process.env.ADMIN_TOKEN});console.log('PASS: party operations acceptance');
}
