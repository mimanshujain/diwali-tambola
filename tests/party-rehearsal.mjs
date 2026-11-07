// Standalone Linux rehearsal: creates its own database, server and browser.
// See docs/DEVELOPMENT.md for the temporary test-tool installation.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {operations,recoveryChecks} from './party-operations.mjs';
import {migrationChecks} from './party-migration.mjs';
import {browserChecks} from './party-browser.mjs';
import {readinessChecks} from './party-readiness.mjs';
import {readinessBrowserChecks} from './party-readiness-browser.mjs';
import {requestPauseChecks} from './party-requests.mjs';
import {notificationChecks} from './live-checkpoints.mjs';
import {rateLimitChecks} from './security-rate-limit.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
assert.ok(process.env.TAMBOLA_TEST_TOOLS,'Set TAMBOLA_TEST_TOOLS to the temporary test-tools directory');
const testRequire=createRequire(join(resolve(process.env.TAMBOLA_TEST_TOOLS),'package.json'));
const {default:EmbeddedPostgres}=await import(pathToFileURL(testRequire.resolve('embedded-postgres')).href);
const systemChromium=process.env.TAMBOLA_CHROMIUM_PATH?.trim()||null;
const chromium=systemChromium?null:(await import(pathToFileURL(testRequire.resolve('@sparticuz/chromium')).href)).default;
const {chromium:playwright}=testRequire('playwright-core');
const {Pool}=createRequire(join(root,'package.json'))('pg');
async function freePort(){const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(r=>server.close(r));return port;}
const pgPort=await freePort(),apiPort=await freePort();
const outputDir=await mkdtemp(join(tmpdir(),'tambola-rehearsal-'));
const pg=new EmbeddedPostgres({databaseDir:join(outputDir,'postgres'),port:pgPort,user:'postgres',password:'rehearsal-only-password',persistent:false,autoRehydrateSymlinks:true,postgresFlags:['-k','','-h','127.0.0.1'],onLog:()=>{},onError:console.error});
const base='http://127.0.0.1:'+apiPort,key='rehearsal-only-admin-key';
const env={...process.env,PORT:String(apiPort),DATABASE_URL:`postgresql://postgres:rehearsal-only-password@127.0.0.1:${pgPort}/tambola`,ADMIN_TOKEN:key,PUBLIC_GUEST_ORIGIN:''};
let api,browser,db,logs='';
async function start(){
 api=spawn(process.execPath,['apps/server/dist/main.js'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
 api.stdout.on('data',b=>logs+=b);api.stderr.on('data',b=>logs+=b);
 for(let i=0;i<100;i++){if(api.exitCode!==null)throw Error('API exited: '+logs.slice(-2000));try{if((await fetch(base+'/health/ready')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw Error('API readiness timed out');
}
async function stop(signal='SIGTERM'){if(api&&api.exitCode===null){const done=once(api,'exit');api.kill(signal);await done;}}
try{
 await pg.initialise();await pg.start();await pg.createDatabase('tambola');db=new Pool({connectionString:env.DATABASE_URL});await start();
 const client=await db.connect();try{await migrationChecks(client);console.log('PASS legacy migration');}finally{client.release();}
 await notificationChecks({base,key,database:env.DATABASE_URL});
 const query=(...args)=>db.query(...args),state=await operations({base,key,query});console.log('PASS operations and concurrent ticket guards');
 browser=await playwright.launch({executablePath:systemChromium||await chromium.executablePath(),args:systemChromium?['--no-sandbox','--disable-dev-shm-usage']:chromium.args.filter(arg=>!['--disable-web-security','--allow-running-insecure-content','--single-process'].includes(arg)),headless:true});
 await browserChecks({browser,base,key,state,outputDir});console.log('PASS phone, host, TV and A4 browser checks');
 await readinessChecks({base,key});await requestPauseChecks({base,key,db});await readinessBrowserChecks({browser,base,key});await browser.close();browser=null;
 await recoveryChecks({base,key,query,stop,start});console.log('PASS hard-crash and graceful-restart recovery');
 if(process.env.TAMBOLA_LEGACY_TESTS==='1'){
  for(const [command,args] of [['python3',['tests/m5m6-integration.py','--priority']],['python3',['tests/m7-party-rehearsal.py']],[process.execPath,['tests/m7-live.mjs','--clients=25']]]){
   const child=spawn(command,args,{cwd:root,env:{...env,TAMBOLA_URL:base},stdio:'inherit'});assert.equal((await once(child,'exit'))[0],0,args[0]);
  }
 }
 await rateLimitChecks({base,key});
 console.log('Screenshots and PDF:',outputDir);
}catch(error){console.error(error);process.exitCode=1;}
finally{await browser?.close();await stop();await db?.end();await pg.stop();await writeFile(join(outputDir,'server.log'),logs);}
