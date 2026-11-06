import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export async function readinessChecks({base,key}) {
 const request=async(path,{method='GET',body,token,admin=false,status}={})=>{
  const response=await fetch(base+path,{method,headers:{'content-type':'application/json',...(admin?{'x-admin-key':key}:{}),...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();if(status)assert.equal(response.status,status,JSON.stringify(data));else assert.ok(response.ok,path+': '+JSON.stringify(data));return data;
 };
 const admin={method:'POST',admin:true};
 const game=await request('/games',{...admin,body:{name:'Ticket policy '+randomUUID(),intervalSeconds:3600}}),root='/games/'+game.id;
 let guest=await request(root+'/players/register',{method:'POST',body:{name:'Draft guest',deviceId:randomUUID()}});
 for(let count=1;count<=3;count++){
  guest={...guest,...await request(root+'/players/me/regenerate',{method:'POST',token:guest.token})};
  assert.equal(guest.rerollsRemaining,3-count);
 }
 await request(root+'/players/me/regenerate',{method:'POST',token:guest.token,status:409});
 await request(root+'/start',{...admin,status:409});
 await request(root+'/admin/players/'+guest.player.id+'/approve',admin);
 await request(root+'/start',admin);
 assert.equal((await request(root+'/players/me',{token:guest.token})).ticket.status,'SUBMITTED');
 const late=await request(root+'/players/register',{method:'POST',body:{name:'Late guest',deviceId:randomUUID()}});
 assert.equal(late.ticket.status,'SUBMITTED');assert.equal(late.player.approved,false);
 await request(root+'/players/me/power/request',{method:'POST',token:late.token,body:{number:1},status:409});
 await request(root+'/admin/players/'+late.player.id+'/approve',admin);
 assert.equal((await request(root+'/players/me',{token:late.token})).player.approved,true);
 const reset=await request(root+'/admin/players/'+late.player.id+'/reset-access',admin);
 await request(root+'/players/me',{token:late.token,status:401});
 const restored=await request(root+'/players/recover',{method:'POST',body:{recoveryCode:reset.recoveryCode,deviceId:randomUUID()}});
 assert.equal(restored.ticket.id,late.ticket.id);assert.equal(restored.ticket.status,'SUBMITTED');

 const fairness=await request('/games',{...admin,body:{name:'Late eligibility '+randomUUID(),intervalSeconds:3600}}),fairRoot='/games/'+fairness.id;
 const first=await request(fairRoot+'/players/register',{method:'POST',body:{name:'First contender',deviceId:randomUUID()}});
 await request(fairRoot+'/admin/players/'+first.player.id+'/approve',admin);
 const seven=await request(fairRoot+'/admin/categories',{...admin,body:{name:'Early Seven',ruleType:'EARLY_SEVEN'}});
 await request(fairRoot+'/start',admin);
 const before=Array.from({length:90},(_,index)=>index+1).filter(number=>!first.ticket.numbers.includes(number)).slice(0,60);
 const initialCalls=before.concat(first.ticket.numbers.slice(0,5));
 for(const number of initialCalls)await request(fairRoot+'/calls/manual',{...admin,body:{number}});
 const categories=await request(fairRoot+'/categories'),five=categories.find(category=>category.rule_type==='EARLY_FIVE');
 let contender;
 for(let index=0;index<20;index++){
  const candidate=await request(fairRoot+'/players/register',{method:'POST',body:{name:'Late contender '+index,deviceId:randomUUID()}});
  if(candidate.ticket.numbers.filter(number=>initialCalls.slice(0,-1).includes(number)).length>=7){contender=candidate;break;}
 }
 assert.ok(contender,'A late ticket must already satisfy the early rules from historical calls');
 await request(fairRoot+'/admin/players/'+contender.player.id+'/approve',admin);
 await request(fairRoot+'/admin/players/'+contender.player.id+'/approve',admin);
 await request(fairRoot+'/calls/manual',{...admin,body:{number:first.ticket.numbers[5]}});
 const eligible=await request(fairRoot+'/admin/eligible-winners',{admin:true});
 const firstFive=eligible.find(row=>row.category_id===five.id&&row.player_id===first.player.id);
 const lateFive=eligible.find(row=>row.category_id===five.id&&row.player_id===contender.player.id);
 assert.equal(firstFive.first_eligible_sequence,65);assert.equal(lateFive.first_eligible_sequence,66);
 let display=await request(fairRoot+'/display');assert.ok(Math.abs(Date.parse(display.serverTime)-Date.now())<10000);
 assert.deepEqual(display.eligibility.filter(row=>row.category_id===five.id).map(row=>row.name),['First contender']);
 const claim=await request(fairRoot+'/players/me/claims',{method:'POST',token:contender.token,body:{categoryId:five.id}});
 assert.equal((await request(fairRoot)).status,'PAUSED');
 const claims=await request(fairRoot+'/admin/claims',{admin:true});assert.equal(claims.find(row=>row.id===claim.id).grid.length,3);
 await request(fairRoot+'/admin/claims/'+claim.id+'/review',admin);
 display=await request(fairRoot+'/display');assert.equal(display.game.status,'PAUSED');assert.equal(display.review.claim_id,claim.id);assert.equal(display.review.resume_after,true);
 assert.equal(display.review.grid.length,3);assert.equal((await request(fairRoot+'/guest-display')).review,undefined);
 await request(fairRoot+'/resume',{...admin,status:409});
 assert.equal((await request(fairRoot+'/admin/claims/'+claim.id+'/cancel',admin)).resumed,true);
 await request(fairRoot+'/admin/claims/'+claim.id+'/review',admin);
 const outcome=await request(fairRoot+'/admin/claims/'+claim.id+'/confirm',admin);
 assert.equal(outcome.resumed,true);assert.deepEqual(outcome.outcome.winners.map(winner=>winner.playerId),[first.player.id]);
 assert.equal((await request(fairRoot+'/admin/claims',{admin:true})).find(row=>row.id===claim.id).status,'REJECTED');
 assert.equal((await request(fairRoot)).status,'RUNNING');

 await request(fairRoot+'/pause',admin);
 const secondClaim=await request(fairRoot+'/players/me/claims',{method:'POST',token:contender.token,body:{categoryId:seven.id}});
 await request(fairRoot+'/admin/claims/'+secondClaim.id+'/review',admin);
 assert.equal((await request(fairRoot+'/display')).review.resume_after,false);
 assert.equal((await request(fairRoot+'/admin/claims/'+secondClaim.id+'/confirm',admin)).resumed,false);
 assert.equal((await request(fairRoot)).status,'PAUSED');

 const tiedGame=await request('/games',{...admin,body:{name:'Review tie-break '+randomUUID(),intervalSeconds:3600}}),tieRoot='/games/'+tiedGame.id;
 const tied=[];for(const name of ['Tie One','Tie Two'])tied.push(await request(tieRoot+'/players/register',{method:'POST',body:{name,deviceId:randomUUID()}}));
 let shared=tied[0].ticket.numbers.find(number=>tied[1].ticket.numbers.includes(number));
 for(let playerIndex=0;shared===undefined&&playerIndex<2;playerIndex++)for(let attempt=0;shared===undefined&&attempt<3;attempt++){
  tied[playerIndex]={...tied[playerIndex],...await request(tieRoot+'/players/me/regenerate',{method:'POST',token:tied[playerIndex].token})};
  shared=tied[0].ticket.numbers.find(number=>tied[1].ticket.numbers.includes(number));
 }
 assert.notEqual(shared,undefined);
 for(const player of tied)await request(tieRoot+'/admin/players/'+player.player.id+'/approve',admin);
 const tieCategories=await request(tieRoot+'/categories'),house=tieCategories.find(category=>category.rule_type==='FULL_HOUSE'),tieFive=tieCategories.find(category=>category.rule_type==='EARLY_FIVE');
 await request(tieRoot+'/admin/categories/'+house.id,{method:'PATCH',admin:true,body:{tieBreakPolicy:'SUDDEN_DEATH',suddenDeathIntervalSeconds:120}});
 await request(tieRoot+'/start',admin);
 const draw=[...new Set(tied.flatMap(player=>player.ticket.numbers))].filter(number=>number!==shared).concat(shared);
 for(const number of draw)await request(tieRoot+'/calls/manual',{...admin,body:{number}});
 const houseClaim=await request(tieRoot+'/players/me/claims',{method:'POST',token:tied[0].token,body:{categoryId:house.id}});
 const otherClaim=await request(tieRoot+'/players/me/claims',{method:'POST',token:tied[0].token,body:{categoryId:tieFive.id}});
 await request(tieRoot+'/admin/claims/'+houseClaim.id+'/review',admin);
 const tieOutcome=await request(tieRoot+'/admin/claims/'+houseClaim.id+'/confirm',admin);
 assert.equal(tieOutcome.resumed,false);assert.equal(tieOutcome.outcome.status,'SUDDEN_DEATH_PENDING');
 const round=tieRoot+'/admin/categories/'+house.id+'/sudden-death';
 await request(round+'/start',admin);await request(tieRoot+'/admin/claims/'+otherClaim.id+'/review',{...admin,status:409});
 await request(tieRoot+'/players/me/claims',{method:'POST',token:tied[0].token,body:{categoryId:tieFive.id}});
 assert.equal((await request(round,{admin:true})).status,'PAUSED');await request(tieRoot+'/admin/claims/'+otherClaim.id+'/review',admin);
 await request(round+'/start',{...admin,status:409});assert.equal((await request(tieRoot+'/admin/claims/'+otherClaim.id+'/cancel',admin)).resumed,false);
 await request(tieRoot+'/resume',{...admin,status:409});
 console.log('PASS ticket auto-submit, recovery, reroll cap, late fairness, claim review and tie-break safety');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 assert.ok(process.env.TAMBOLA_URL&&process.env.ADMIN_TOKEN,'Set TAMBOLA_URL and ADMIN_TOKEN for a disposable test stack');
 await readinessChecks({base:process.env.TAMBOLA_URL.replace(/\/$/,''),key:process.env.ADMIN_TOKEN});
}
