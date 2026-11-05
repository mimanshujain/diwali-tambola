// CI-only destructive restore rehearsal against the disposable Docker Compose database.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const base=process.env.TAMBOLA_URL||'http://127.0.0.1:3000';
const headers={'x-admin-key':process.env.ADMIN_TOKEN};
async function games(){const r=await fetch(base+'/games',{headers});assert.ok(r.ok);return (await r.json()).map(g=>({id:g.id,calledCount:g.calledCount,submittedCount:g.submittedCount})).sort((a,b)=>a.id.localeCompare(b.id));}
const before=await games();assert.ok(before.length);
const dir=mkdtempSync(join(tmpdir(),'tambola-backup-'));
execFileSync('bash',['scripts/backup.sh',dir],{stdio:'inherit'});
const file=readdirSync(dir).find(f=>f.endsWith('.dump'));assert.ok(file);
execFileSync('bash',['scripts/restore.sh',join(dir,file)],{env:{...process.env,CONFIRM_RESTORE:'RESTORE'},stdio:'inherit'});
let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/health/ready')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
assert.ok(ready,'API did not restart after restore');assert.deepEqual(await games(),before);
console.log('PASS: backup restored game IDs, draw counts and submitted-ticket counts');
