// Disposable HTTPS, PostgreSQL and two API processes; no cloud credentials required.
import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer as tcp,connect as socketConnect} from 'node:net';
import {createServer as https} from 'node:https';
import {request as httpRequest} from 'node:http';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
assert.ok(process.env.TAMBOLA_TEST_TOOLS,'Set TAMBOLA_TEST_TOOLS');
const testRequire=createRequire(join(resolve(process.env.TAMBOLA_TEST_TOOLS),'package.json'));
const {default:EmbeddedPostgres}=await import(pathToFileURL(testRequire.resolve('embedded-postgres')).href);
const chromium=process.env.TAMBOLA_CHROMIUM_PATH?null:(await import(pathToFileURL(testRequire.resolve('@sparticuz/chromium')).href)).default;
const {chromium:playwright}=testRequire('playwright-core');
const {Pool}=createRequire(join(root,'package.json'))('pg');
async function freePort(){const s=tcp();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port;}
const pgPort=await freePort(),apiPort=await freePort(),port2=await freePort(),tlsPort=await freePort();
const output=await mkdtemp(join(tmpdir(),'tambola-hosted-')),origin='https://localhost:'+tlsPort;
const pg=new EmbeddedPostgres({databaseDir:join(output,'pg'),port:pgPort,user:'postgres',password:'test-only',persistent:false,autoRehydrateSymlinks:true,postgresFlags:['-k','','-h','127.0.0.1'],onLog:()=>{},onError:console.error});
const database=`postgresql://postgres:test-only@127.0.0.1:${pgPort}/tambola`;
const env={...process.env,HOSTING_MODE:'cloud',DATABASE_URL:database,PUBLIC_APP_ORIGIN:origin,GOOGLE_CLIENT_ID:'test-google-client',GOOGLE_CLIENT_SECRET:'test-only',HOST_ALLOWED_EMAILS:'alice@example.com,bob@example.com,charlie@example.com',ADMIN_TOKEN:'old-admin-token-must-not-work'};
let db,browser,proxy,currentPort=apiPort;const children=[],logs=[];
const hash=value=>createHash('sha256').update(value).digest('hex');
async function start(port){const child=spawn(process.execPath,['--import','./tests/fixtures/google-provider.mjs','apps/server/dist/main.js'],{cwd:root,env:{...env,PORT:String(port)},stdio:['ignore','pipe','pipe']});children.push(child);child.stdout.on('data',b=>logs.push(String(b)));child.stderr.on('data',b=>logs.push(String(b)));for(let i=0;i<150;i++){if(child.exitCode!==null)throw Error(logs.join('').slice(-3000));try{if((await fetch('http://127.0.0.1:'+port+'/health/ready')).ok)return child;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Startup timeout');}
async function stop(child,signal='SIGTERM'){if(child?.exitCode===null && child.signalCode===null){const done=once(child,'exit');child.kill(signal);await done;}}
async function rawRequest(path,{method='GET',headers={},body,port=currentPort}={}){
 return new Promise((resolve,reject)=>{const req=httpRequest({host:'127.0.0.1',port,path,method,headers:{host:'localhost:'+tlsPort,...headers}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:Object.fromEntries(Object.entries(res.headers).map(([k,v])=>[k,Array.isArray(v)?v.join(', '):v]))})));});req.on('error',reject);req.end(body);});
}
async function api(path,{cookie='',method='GET',body,headers={},port=currentPort,expected=200}={}){
 const r=await rawRequest(path,{port,method,headers:{host:'localhost:'+tlsPort,origin,'content-type':'application/json',...(cookie?{cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await r.text();assert.equal(r.status,expected,`${method} ${path}: ${r.status} ${raw.slice(0,300)}`);let data;try{data=JSON.parse(raw);}catch{data=raw;}return {r,data};
}
async function login(email,extras={},expected=302){
 const begin=await api('/auth/google',{expected:302});const url=new URL(begin.r.headers.get('location'));assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 const state=url.searchParams.get('state'),cookie=begin.r.headers.get('set-cookie').split(';')[0];
 const attempt=(await db.query('SELECT * FROM oauth_attempts WHERE state_hash=$1',[hash(state)])).rows[0];
 assert.equal(url.searchParams.get('code_challenge'),createHash('sha256').update(attempt.verifier).digest('base64url'));
 const code=Buffer.from(JSON.stringify({sub:email,name:email.split('@')[0],email,nonce:attempt.nonce,...extras})).toString('base64url');
 const callback='/auth/callback?state='+state+'&code='+code;
 const result=await api(callback,{cookie,expected});
 await api(callback,{cookie,expected:401}); // Single use.
 return expected===302?result.r.headers.get('set-cookie').split(';')[0]:null;
}
try{
 await pg.initialise();await pg.start();await pg.createDatabase('tambola');db=new Pool({connectionString:database});let a=await start(apiPort);
 await api('/admin',{expected:302});await api('/games',{headers:{'x-admin-key':env.ADMIN_TOKEN},expected:401});
 await api('/auth/callback?code=bad&state=bad',{expected:401});
 await login('intruder@example.com',{},401);await login('alice@example.com',{email_verified:false},401);await login('alice@example.com',{nonce:'wrong'},401);await login('alice@example.com',{aud:'another-client'},401);await login('alice@example.com',{iss:'https://evil.example'},401);await login('alice@example.com',{exp:1},401);
 const alice=await login('alice@example.com'),bob=await login('bob@example.com'),charlie=await login('charlie@example.com');
 assert.match(alice,/^__Host-tambola-host=/);const cookieToken=alice.split('=')[1];assert.equal((await db.query('SELECT 1 FROM host_sessions WHERE token_hash=$1',[hash(cookieToken)])).rowCount,1);
 console.log('PASS Google PKCE, signed ID tokens, audience/issuer/expiry/nonce, invitation and replay checks');
 const make=async(cookie,name)=> (await api('/games',{cookie,method:'POST',body:{name,intervalSeconds:30},expected:201})).data;
 const game=await make(alice,'Alice’s Diwali'),other=await make(bob,'Bob’s Diwali'),id=game.id;
 assert.deepEqual((await api('/games',{cookie:alice})).data.map(g=>g.id),[id]);assert.deepEqual((await api('/games',{cookie:bob})).data.map(g=>g.id),[other.id]);
 await api('/games',{cookie:alice,method:'POST',headers:{origin:'https://evil.example'},body:{name:'CSRF'},expected:403});
 const foreign=[['GET',''],['GET','/display'],['GET','/calls'],['GET','/categories'],['GET','/admin/players'],['GET','/admin/claims'],['GET','/admin/eligible-winners'],['GET','/admin/audit'],['GET','/admin/ticket-conflicts'],['GET','/admin/power-requests'],['POST','/start'],['POST','/pause'],['POST','/resume'],['POST','/tickets'],['POST','/calls/manual'],...['stop','release-stop','end','timer','call-next','tv-pair','tv-revoke','categories'].map(s=>['POST','/admin/'+s])];
 for(const [method,suffix] of foreign)await api('/games/'+other.id+suffix,{cookie:alice,method,body:method==='POST'?{}:undefined,expected:404});
 await api('/GAMES/'+other.id+'/ADMIN/STOP',{cookie:alice,method:'POST',body:{},expected:404});
 await api('/admin/'+other.id,{cookie:alice,expected:404});await api('/admin/'+other.id+'/tv-qr.svg',{cookie:alice,expected:404});
 const dummy=randomUUID();for(const suffix of ['players/'+dummy+'/approve','players/'+dummy+'/withdraw','players/'+dummy+'/reset-access','players/'+dummy+'/reissue','categories/'+dummy+'/resolve','categories/'+dummy+'/sudden-death/start','categories/'+dummy+'/sudden-death/pause','claims/'+dummy+'/review','claims/'+dummy+'/confirm','claims/'+dummy+'/cancel','power-requests/'+dummy+'/approve','power-requests/'+dummy+'/reject'])await api('/games/'+other.id+'/admin/'+suffix,{cookie:alice,method:'POST',body:{},expected:404});
 await api('/games/'+other.id+'/admin/categories/'+dummy,{cookie:alice,method:'PATCH',body:{active:false},expected:404});
 // A legacy game is not silently inherited by the first Google account.
 const legacy=await make(charlie,'Imported legacy');await db.query('UPDATE games SET host_id=NULL WHERE id=$1',[legacy.id]);await api('/games/'+legacy.id+'/display',{cookie:alice,expected:404});assert.equal((await api('/games',{cookie:charlie})).data.length,0);
 const concurrent=await Promise.all(Array.from({length:7},(_,i)=>rawRequest('/games',{method:'POST',headers:{host:'localhost:'+tlsPort,origin,cookie:charlie,'content-type':'application/json'},body:JSON.stringify({name:'Quota '+i})})));
 assert.equal(concurrent.filter(r=>r.status===201).length,5);assert.equal(concurrent.filter(r=>r.status===409).length,2);
 console.log('PASS ownership isolation across host routes, legacy quarantine, CSRF and concurrent game quota');
 const guest=(await api('/games/'+id+'/players/register',{method:'POST',body:{name:'Festival Guest',deviceId:randomUUID()},expected:201})).data;
 assert.ok(guest.token);await api('/games/'+id+'/admin/players/'+guest.player.id+'/approve',{cookie:alice,method:'POST',expected:201});
 await api('/games/'+id+'/players/me/submit',{method:'POST',headers:{authorization:'Bearer '+guest.token},body:{ticketId:guest.ticket.id},expected:201});
 await api('/games/'+other.id+'/players/me',{headers:{authorization:'Bearer '+guest.token},expected:401});
 const publicDisplay=(await api('/games/'+id+'/guest-display')).data;assert.ok(!('players' in publicDisplay));assert.ok(!JSON.stringify(publicDisplay).includes('Festival Guest'));
 await api('/games/'+id+'/display',{expected:401});
 const pair=(await api('/games/'+id+'/admin/tv-pair',{cookie:alice,method:'POST',expected:201})).data;
 assert.match(pair.url,/\/screen#[A-F0-9]{10}$/);assert.match(pair.qr,/<svg/);
 const paired=await api('/screen/connect',{method:'POST',body:{code:pair.code},expected:201}),screen=paired.r.headers.get('set-cookie').split(';')[0];assert.equal(paired.data.url,'/tv/'+game.joinCode);
 await api('/screen/connect',{method:'POST',body:{code:pair.code},expected:401});
 await api('/games/'+id+'/display',{cookie:screen});await api('/games/'+other.id+'/display',{cookie:screen,expected:401});await api('/games/'+id+'/admin/players',{cookie:screen,expected:401});await api('/games/'+id+'/start',{cookie:screen,method:'POST',expected:401});
 await api('/tv/'+game.joinCode,{cookie:screen});await api('/tv/'+id+'/qr.svg',{cookie:screen});
 await api('/games/'+id+'/admin/tv-revoke',{cookie:alice,method:'POST',expected:201});await api('/games/'+id+'/display',{cookie:screen,expected:401});
 const expired=(await api('/games/'+id+'/admin/tv-pair',{cookie:alice,method:'POST',expected:201})).data;await db.query('UPDATE display_access SET expires_at=NOW()-INTERVAL \'1 second\' WHERE token_hash=$1',[hash(expired.code)]);await api('/screen/connect',{method:'POST',body:{code:expired.code},expected:401});
 const deletable=await make(alice,'Delete hosted game'),deletePath='/games/'+deletable.id+'/admin/game',confirmationCode=deletable.joinCode;
 const deletePair=(await api('/games/'+deletable.id+'/admin/tv-pair',{cookie:alice,method:'POST',expected:201})).data;
 const deleteScreen=(await api('/screen/connect',{method:'POST',body:{code:deletePair.code},expected:201})).r.headers.get('set-cookie').split(';')[0];
 await api(deletePath,{cookie:bob,method:'DELETE',body:{confirmationCode},expected:404});
 await api(deletePath,{cookie:alice,method:'DELETE',body:{confirmationCode:'WRONG'},expected:400});
 await api(deletePath,{cookie:alice,method:'DELETE',body:{confirmationCode}});
 assert.equal((await db.query('SELECT count(*)::int AS n FROM display_access WHERE game_id=$1',[deletable.id])).rows[0].n,0);
 await api('/games/'+deletable.id+'/display',{cookie:deleteScreen,expected:401});
 assert.equal((await api('/games',{cookie:alice})).data.length,1);
 await db.query("INSERT INTO players(id,game_id,name,device_id,token_hash,approved) SELECT gen_random_uuid(),$1,'Capacity guest '||n,gen_random_uuid(),gen_random_uuid()::text,false FROM generate_series(1,200) n",[other.id]);
 await api('/games/'+other.id+'/players/register',{method:'POST',body:{name:'Over capacity',deviceId:randomUUID()},expected:409});
 console.log('PASS account-free guest workflow and read-only, one-use, revocable TV pairing');
 // Real browsers through a local HTTPS ingress, including secure cookies and native Origin headers.
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-keyout',join(output,'key.pem'),'-out',join(output,'cert.pem')],{stdio:'ignore'});
 proxy=https({key:await readFile(join(output,'key.pem')),cert:await readFile(join(output,'cert.pem'))},(req,res)=>{const upstream=httpRequest({host:'127.0.0.1',port:currentPort,path:req.url,method:req.method,headers:{...req.headers,'x-forwarded-for':'127.0.0.1','x-forwarded-proto':'https'}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);});
 proxy.on('upgrade',(req,socket,head)=>{const upstream=socketConnect(currentPort,'127.0.0.1',()=>{upstream.write(req.method+' '+req.url+' HTTP/1.1\r\n'+Object.entries(req.headers).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);});upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());});
 proxy.listen(tlsPort,'127.0.0.1');await once(proxy,'listening');
 browser=await playwright.launch({executablePath:process.env.TAMBOLA_CHROMIUM_PATH||await chromium.executablePath(),headless:true,args:chromium?chromium.args.filter(a=>!['--disable-web-security','--allow-running-insecure-content','--single-process'].includes(a)):['--no-sandbox','--disable-dev-shm-usage']});
 const host=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});await host.addCookies([{name:'__Host-tambola-host',value:cookieToken,url:origin,secure:true,httpOnly:true,sameSite:'Lax'}]);
 const page=await host.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/admin');await page.waitForSelector('.game-card');assert.equal(await page.locator('.game-card').count(),1);assert.equal(await page.locator('#key').isVisible(),false);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(output,'host-phone.png'),fullPage:true});
 await page.goto(origin+'/admin/'+id);await page.waitForFunction(()=>document.querySelector('#name').textContent.includes('Alice'));await page.locator('#access-panel summary').click();await page.locator('#pair-tv').click();await page.waitForFunction(()=>document.querySelector('#pair-code').textContent.length>5);const pairingLink=await page.locator('#pair-link').getAttribute('href');
 const tvContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1920,height:1080}}),tv=await tvContext.newPage();tv.on('pageerror',e=>errors.push(e.message));await tv.goto(pairingLink);await tv.waitForURL('**/tv/'+game.joinCode);await tv.waitForFunction(()=>document.querySelector('#lobbyCode').textContent.length===6&&document.querySelector('#roster').textContent.includes('Festival Guest'));assert.equal(new URL(tv.url()).hash,'');await tv.screenshot({path:join(output,'paired-tv.png')});
 page.once('dialog',d=>d.accept());await page.locator('#revoke-tv').click();await tv.waitForURL('**/screen');
 const guestContext=await browser.newContext({ignoreHTTPSErrors:true}),landing=await guestContext.newPage();await landing.goto(origin);await landing.locator('#code').fill(game.joinCode);await landing.locator('#join button').click();await landing.waitForURL('**/join/'+id);
 await page.goto(origin+'/admin');await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL(origin+'/');await api('/games',{cookie:alice,expected:401});assert.deepEqual(errors,[]);
 await browser.close();browser=null;
 console.log('PASS phone host desk, QR pairing, TV revocation, guest landing and logout in HTTPS browsers');
 const renewed=await login('alice@example.com');
 await api('/games/'+id+'/start',{cookie:renewed,method:'POST',expected:201});
 const b=await start(port2);assert.equal((await api('/games/'+id,{cookie:renewed})).data.status,'RUNNING');
 await stop(b);assert.equal((await api('/games/'+id,{cookie:renewed})).data.status,'RUNNING'); // Standby shutdown cannot pause leader.
 const standby=await start(port2);await stop(a,'SIGKILL');currentPort=port2;
 for(let i=0;i<180;i++){const state=(await api('/games/'+id,{cookie:renewed})).data;if(state.status==='PAUSED')break;await new Promise(r=>setTimeout(r,100));}
 const recovered=(await api('/games/'+id,{cookie:renewed})).data;assert.equal(recovered.status,'PAUSED');assert.ok(recovered.recoveredAt);
 assert.equal((await api('/games/'+id+'/admin/players',{cookie:renewed})).data[0].ticketId,guest.ticket.id);
 await api('/games/'+id+'/resume',{cookie:renewed,method:'POST',expected:201});
 const live2=await start(apiPort);await stop(standby);currentPort=apiPort;
 for(let i=0;i<30;i++){const status=(await api('/games/'+id,{cookie:renewed})).data.status;if(status==='PAUSED')break;await new Promise(r=>setTimeout(r,100));}
 assert.equal((await api('/games/'+id,{cookie:renewed})).data.status,'PAUSED');
 await db.query("UPDATE host_sessions SET expires_at=NOW()-INTERVAL '1 second' WHERE token_hash=$1",[hash(renewed.split('=')[1])]);await api('/games',{cookie:renewed,expected:401});
 console.log('PASS overlapping deployments, standby shutdown, hard-crash takeover, graceful recovery and session expiry');
 console.log('Hosted rehearsal artifacts:',output);
}catch(e){console.error(e);console.error(logs.join('').slice(-3500));process.exitCode=1;}
finally{await browser?.close();proxy?.closeAllConnections();proxy?.close();await Promise.all(children.map(c=>stop(c)));await db?.end();await pg.stop();await writeFile(join(output,'server.log'),logs.join(''));}
