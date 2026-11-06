import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function rateLimitChecks({base,key}) {
 const created=await fetch(base+'/games',{method:'POST',headers:{'content-type':'application/json','x-admin-key':key},body:JSON.stringify({name:'Rate limit '+randomUUID(),intervalSeconds:3600})});
 assert.ok(created.ok);const game=await created.json(),root='/games/'+game.id;
 const paths=[root+'/start',root+'/pause',root+'/resume',root+'/calls/manual',root+'/tickets',root+'/admin/stop'];
 let blocked=false;
 for(let attempt=0;attempt<=120;attempt++){
  const response=await fetch(base+paths[attempt%paths.length],{method:'POST',headers:{'content-type':'application/json','x-admin-key':'wrong'},body:'{}'});
  if(response.status===429){blocked=true;break;}assert.equal(response.status,401);
 }
 assert.equal(blocked,true);
 for(const path of paths)assert.equal((await fetch(base+path,{method:'POST',headers:{'x-admin-key':'wrong'}})).status,429);
 assert.equal((await fetch(base+root+'/pause',{method:'POST'})).status,429);
 assert.equal((await fetch(base+root+'/guest-display',{headers:{'x-admin-key':'wrong'}})).status,429);
 assert.equal((await fetch(base+root+'/guest-display')).status,200);
 assert.equal((await fetch(base+'/games',{headers:{'x-admin-key':key}})).status,200);
 console.log('PASS HTTP admin rate limits and valid-host bypass');
}
