import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export async function requestPauseChecks({base,key,db}) {
 const request=async(path,{method='GET',body,token,admin=false,status}={})=>{
  const response=await fetch(base+path,{method,headers:{'content-type':'application/json',...(admin?{'x-admin-key':key}:{}),...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();if(status)assert.equal(response.status,status,JSON.stringify(data));else assert.ok(response.ok,path+': '+JSON.stringify(data));return data;
 };
 const admin={method:'POST',admin:true};
 const game=await request('/games',{...admin,body:{name:'Automatic request pauses '+randomUUID(),intervalSeconds:120}}),root='/games/'+game.id;
 const players=[];
 for(const name of ['Claim Guest','Power Guest']){
  const player=await request(root+'/players/register',{method:'POST',body:{name,deviceId:randomUUID()}});players.push(player);
  await request(root+'/admin/players/'+player.player.id+'/approve',admin);
 }
 const addCategory=(name,ruleType)=>request(root+'/admin/categories',{...admin,body:{name,ruleType}});
 const seven=await addCategory('Seven request','EARLY_SEVEN'),ten=await addCategory('Ten request','EARLY_TEN');
 const sevenBonus=await addCategory('Seven bonus','EARLY_SEVEN'),tenBonus=await addCategory('Ten bonus','EARLY_TEN');
 const raceBonus=await addCategory('Race bonus','EARLY_FIVE');
 const categories=await request(root+'/categories'),five=categories.find(category=>category.rule_type==='EARLY_FIVE');
 await request(root+'/start',admin);
 await request(root+'/players/me/claims',{method:'POST',token:players[0].token,body:{categoryId:five.id},status:409});
 await request(root+'/players/me/power/request',{method:'POST',token:players[0].token,body:{number:0},status:400});
 assert.equal((await request(root)).status,'RUNNING');
 await request(root+'/admin/timer',{...admin,body:{seconds:3}});
 const locker=db?await db.connect():null;if(locker){await locker.query('BEGIN');await locker.query('SELECT id FROM games WHERE id=$1 FOR UPDATE',[game.id]);}
 const pendingPowers=Promise.all(players.map(player=>request(root+'/players/me/power/request',{method:'POST',token:player.token,body:{number:1}})));
 if(locker){await new Promise(resolve=>setTimeout(resolve,1500));await locker.query('COMMIT');locker.release();}
 const [firstPower,secondPower]=await pendingPowers;
 let state=await request(root);assert.equal(state.status,'PAUSED');assert.equal(state.nextCallAt,null);assert.ok(state.pausedRemainingSeconds>=0&&state.pausedRemainingSeconds<=(db?2:3));
 await request(root+'/calls/manual',{...admin,body:{number:2},status:409});
 await new Promise(resolve=>setTimeout(resolve,2500));assert.equal((await request(root+'/calls')).length,0);
 const firstApproval=await request(root+'/admin/power-requests/'+firstPower.id+'/approve',admin);assert.equal(firstApproval.number,1);
 state=await request(root);assert.equal(state.status,'PAUSED');assert.equal(state.nextCallAt,null);assert.equal(state.pausedRemainingSeconds,120);
 await request(root+'/admin/power-requests/'+firstPower.id+'/approve',{...admin,status:409});
 await request(root+'/admin/power-requests/'+secondPower.id+'/approve',{...admin,status:409});
 await request(root+'/admin/power-requests/'+secondPower.id+'/reject',admin);
 assert.equal((await request(root+'/players/me/power',{token:players[1].token})).status,'AVAILABLE');
 await request(root+'/resume',admin);

 async function callTicketPrefix(count){
  const already=new Set((await request(root+'/calls')).map(call=>call.number));
  for(const number of players[0].ticket.numbers.slice(0,count))if(!already.has(number))await request(root+'/calls/manual',{...admin,body:{number}});
 }
 await callTicketPrefix(5);
 const claim=await request(root+'/players/me/claims',{method:'POST',token:players[0].token,body:{categoryId:five.id}});
 assert.equal((await request(root)).status,'PAUSED');await request(root+'/admin/call-next',{...admin,body:{expectedSequence:99},status:409});
 await request(root+'/admin/claims/'+claim.id+'/review',admin);assert.equal((await request(root+'/display')).review.resume_after,true);
 assert.equal((await request(root+'/admin/claims/'+claim.id+'/confirm',admin)).resumed,true);

 await callTicketPrefix(7);await request(root+'/pause',admin);
 const pausedClaim=await request(root+'/players/me/claims',{method:'POST',token:players[0].token,body:{categoryId:seven.id}});
 await request(root+'/admin/claims/'+pausedClaim.id+'/review',admin);assert.equal((await request(root+'/display')).review.resume_after,false);
 assert.equal((await request(root+'/admin/claims/'+pausedClaim.id+'/confirm',admin)).resumed,false);await request(root+'/resume',admin);

 await callTicketPrefix(10);
 const called=new Set((await request(root+'/calls')).map(call=>call.number)),chosen=Array.from({length:90},(_,index)=>index+1).find(number=>!called.has(number));
 const [concurrentClaim,concurrentPower]=await Promise.all([
  request(root+'/players/me/claims',{method:'POST',token:players[0].token,body:{categoryId:ten.id}}),
  request(root+'/players/me/power/request',{method:'POST',token:players[1].token,body:{number:chosen}}),
 ]);
 assert.equal((await request(root)).status,'PAUSED');await request(root+'/admin/claims/'+concurrentClaim.id+'/review',admin);
 await request(root+'/admin/power-requests/'+concurrentPower.id+'/approve',{...admin,status:409});
 assert.equal((await request(root+'/admin/claims/'+concurrentClaim.id+'/confirm',admin)).resumed,false);
 await request(root+'/admin/power-requests/'+concurrentPower.id+'/approve',admin);assert.equal((await request(root)).status,'PAUSED');await request(root+'/resume',admin);

 const [claimA,claimB]=await Promise.all([sevenBonus,tenBonus].map(category=>request(root+'/players/me/claims',{method:'POST',token:players[0].token,body:{categoryId:category.id}})));
 await request(root+'/admin/claims/'+claimA.id+'/review',admin);assert.equal((await request(root+'/admin/claims/'+claimA.id+'/confirm',admin)).resumed,false);
 assert.equal((await request(root)).status,'PAUSED');await request(root+'/admin/claims/'+claimB.id+'/review',admin);
 assert.equal((await request(root+'/admin/claims/'+claimB.id+'/confirm',admin)).resumed,false);await request(root+'/resume',admin);

 await request(root+'/admin/timer',{...admin,body:{seconds:1}});
 const expectedSequence=(await request(root)).calledCount+1;
 const [raceClaim,draw]=await Promise.all([
  request(root+'/players/me/claims',{method:'POST',token:players[0].token,body:{categoryId:raceBonus.id}}),
  fetch(base+root+'/admin/call-next',{method:'POST',headers:{'content-type':'application/json','x-admin-key':key},body:JSON.stringify({expectedSequence})}),
 ]);
 assert.ok(draw.ok||draw.status===409);assert.equal((await request(root)).status,'PAUSED');
 const count=(await request(root+'/calls')).length;await new Promise(resolve=>setTimeout(resolve,1800));assert.equal((await request(root+'/calls')).length,count);
 await request(root+'/admin/claims/'+raceClaim.id+'/review',admin);assert.equal((await request(root+'/admin/claims/'+raceClaim.id+'/confirm',admin)).resumed,true);
 console.log('PASS atomic request pauses, concurrent draws, Lucky Strike approval and claim review');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 assert.ok(process.env.TAMBOLA_URL&&process.env.ADMIN_TOKEN,'Set TAMBOLA_URL and ADMIN_TOKEN for a disposable test stack');
 await requestPauseChecks({base:process.env.TAMBOLA_URL.replace(/\/$/,''),key:process.env.ADMIN_TOKEN});
}
