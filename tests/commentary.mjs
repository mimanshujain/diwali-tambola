import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function commentaryChecks({base,key,db,browser,stop,start,outputDir}){
 const headers={'content-type':'application/json','x-admin-key':key};
 async function req(path,{method='GET',body,admin=true,expected}={}){const r=await fetch(base+path,{method,headers:admin?headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,expected??(method==='POST'?201:200),path+' '+JSON.stringify(data));return data;}
 const game=await req('/games',{method:'POST',body:{name:'Voice test',intervalSeconds:3600}}),root='/games/'+game.id;
 const previewPath=root+'/commentary/admin/preview';
 assert.equal((await req(root+'/commentary/admin/settings')).enabled,false);
 const sample={scenario:'number',number:42};
 await req(previewPath,{admin:false,method:'POST',body:sample,expected:401});
 await req(previewPath,{method:'POST',body:{...sample,number:91},expected:400});
 await req(previewPath,{method:'POST',body:{...sample,settings:{familyFriendly:true,allowSexualReferences:true}},expected:400});
 await req(previewPath,{method:'POST',body:{...sample,settings:{innuendoIntensity:4}},expected:400});
 const disabledPreview=await req(previewPath,{method:'POST',body:sample});
 assert.equal(disabledPreview.gemini.status,'no_key');assert.match(disabledPreview.text,/42/);
 const classicTv=await browser.newPage();
 await classicTv.addInitScript(()=>{
  const voice=window.voiceTest={spoken:[],cancelCount:0,active:null};
  Object.defineProperty(window,'speechSynthesis',{value:{
   getVoices:()=>[],
   speak(utterance){voice.spoken.push(utterance.text);voice.active=utterance;},
   cancel(){voice.cancelCount++;voice.active=null;}
  }});
 });
 try{
  await classicTv.goto(base+'/tv/'+game.joinCode);
  await classicTv.getByRole('button',{name:'Narration off (host)',exact:true}).waitFor();
  await classicTv.getByRole('button',{name:/Sound off/}).click();
  await classicTv.getByRole('button',{name:'Sound on',exact:true}).waitFor();
  await classicTv.locator('#latest').evaluate(el=>el.textContent='7');
  await classicTv.waitForFunction(()=>window.voiceTest.spoken.length===1);
  await classicTv.locator('#latest').evaluate(el=>el.textContent='8');
  await classicTv.waitForResponse(r=>r.url().includes('/commentary?after=')&&r.ok());
  assert.deepEqual(await classicTv.evaluate(()=>[window.voiceTest.spoken,window.voiceTest.cancelCount]),[['भाग्यशाली सात।'],0]);
  await classicTv.evaluate(()=>window.voiceTest.active.onend());
  assert.deepEqual(await classicTv.evaluate(()=>window.voiceTest.spoken),['भाग्यशाली सात।','अगला नंबर, आठ।']);
  await classicTv.getByRole('button',{name:'Hindi voice on',exact:true}).click();
  assert.equal(await classicTv.evaluate(()=>window.voiceTest.cancelCount),1);
 }finally{await classicTv.close();}

 await req(root+'/commentary/admin/settings',{admin:false,expected:401});
 await req(root+'/commentary/admin/settings',{method:'POST',body:{enabled:true,familyFriendly:true,allowSexualReferences:true},expected:400});
 await req(root+'/commentary/admin/settings',{method:'POST',body:{voiceProvider:'elevenlabs'},expected:400});
 await req(root+'/commentary/admin/settings',{method:'POST',body:{enabled:true,language:'hi',callsEvery:1,shoutoutsEvery:5,announceWinners:true,accent:'indian'}});
 const player=await req(root+'/players/register',{method:'POST',body:{name:'Riya Sharma',deviceId:randomUUID()},admin:false});
 await req(root+'/admin/players/'+player.player.id+'/approve',{method:'POST'});await req(root+'/players/me/submit',{method:'POST',body:{ticketId:player.ticket.id},admin:false,expected:401});
 const submit=await fetch(base+root+'/players/me/submit',{method:'POST',headers:{...headers,authorization:'Bearer '+player.token},body:JSON.stringify({ticketId:player.ticket.id})});assert.equal(submit.status,201);
 const host=await browser.newPage({viewport:{width:390,height:844}});const errors=[];host.on('pageerror',e=>{errors.push(e.message);console.error('HOST PAGE ERROR',e.message);});await host.goto(base+'/admin/'+game.id);await host.locator('#key').fill(key);await host.locator('#load').click();await host.getByRole('combobox',{name:'Host section'}).selectOption('style');await host.locator('#commentary-panel > summary').click();await host.locator('#commentary-enabled').waitFor();await host.waitForFunction(()=>document.querySelector('#commentary-language').value==='hi');
 await host.evaluate(()=>{
  const fakeVoice={lang:'en-US'};
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}}});
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[fakeVoice],speak:utterance=>{
   window.previewSpoken={text:utterance.text,locale:utterance.lang,voice:utterance.voice?.lang};utterance.onend();
  },cancel(){}}});
 });
 await host.locator('#commentary-language').selectOption('en');
 await host.locator('#commentary-accent').selectOption('us');
 await host.locator('#commentary-tone').selectOption('playful');
 const meter=host.getByRole('slider',{name:'Innuendo intensity'});
 assert.equal(await meter.isVisible(),false);
 host.once('dialog',dialog=>dialog.accept());
 await host.locator('#commentary-adult').check();
 assert.equal(await host.locator('#commentary-family').isChecked(),false);
 assert.equal(await meter.inputValue(),'1');
 await meter.press('ArrowRight');await meter.press('ArrowRight');
 assert.equal(await meter.getAttribute('aria-valuetext'),'3 of 3, Bold');
 await host.locator('#commentary-provider').selectOption('elevenlabs');
 await host.locator('#commentary-scenario').selectOption('near-win');
 await host.locator('#commentary-generate').click();
 await host.locator('#commentary-preview').waitFor({state:'visible'});
 assert.match(await host.locator('#commentary-preview-status').textContent(),/Scripted fallback.*GEMINI_API_KEY/);
 assert.match(await host.locator('#commentary-preview-script').textContent(),/Meera has matched 14 of 15 numbers/);
 assert.match(await host.locator('#commentary-preview-audience').textContent(),/Adults only · Bold innuendo/);
 assert.match(await host.locator('#commentary-preview-voice').textContent(),/ElevenLabs voice or key is missing/);
 await host.locator('#commentary-preview-speak').click();
 assert.deepEqual(await host.evaluate(()=>window.previewSpoken),{text:await host.locator('#commentary-preview-script').textContent(),locale:'en-US',voice:'en-US'});
 assert.ok(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await host.screenshot({path:outputDir+'/commentary-preview.png',fullPage:true});
 const unchanged=await req(root+'/commentary/admin/settings');
 assert.equal(unchanged.language,'hi');assert.equal(unchanged.familyFriendly,true);assert.equal(unchanged.innuendoIntensity,1);assert.equal(unchanged.voiceProvider,'browser');assert.equal(unchanged.lastAnnouncement,null);
 assert.equal((await db.query('SELECT 1 FROM called_numbers WHERE game_id=$1',[game.id])).rowCount,0);
 assert.equal((await db.query('SELECT 1 FROM game_commentary_events WHERE game_id=$1',[game.id])).rowCount,0);
 await host.locator('#commentary-family').check();
 assert.equal(await host.locator('#commentary-adult').isChecked(),false);
 assert.equal(await meter.isVisible(),false);
 assert.equal(await host.locator('#commentary-preview').isVisible(),false);
 await host.locator('#commentary-language').selectOption('hi');
 await host.locator('#commentary-accent').selectOption('indian');
 await host.locator('#commentary-provider').selectOption('browser');
 await host.locator('#commentary-shoutouts').fill('3');
 await host.locator('#commentary-save').click();
 await host.waitForFunction(()=>document.querySelector('#commentary-status').textContent.startsWith('Commentary saved.'));
 assert.equal((await req(root+'/commentary/admin/settings')).shoutoutsEvery,3);
 await host.screenshot({path:outputDir+'/commentary-host.png',fullPage:true});
 const tv=await browser.newPage({viewport:{width:1280,height:720}});tv.on('pageerror',e=>errors.push(e.message));await tv.goto(base+'/tv/'+game.joinCode);await tv.getByRole('button',{name:'Narration on'}).waitFor();
 await req(root+'/start',{method:'POST'});await req(root+'/commentary?after=0');
 const ticket=player.ticket.numbers;
 for(const [i,n] of ticket.slice(0,5).entries()){
  await req(root+'/calls/manual',{method:'POST',body:{number:n}});
  const polls=await Promise.all(Array.from({length:4},()=>req(root+'/commentary?after=0')));
  assert.ok(polls.every(p=>p.settings.language==='hi'));
  for(let tries=0;tries<30;tries++){if((await db.query('SELECT count(*)::int AS count FROM game_commentary_events WHERE game_id=$1 AND status=\'READY\' AND kind=\'NUMBER\'',[game.id])).rows[0].count>=i+1)break;await new Promise(r=>setTimeout(r,80));}
  assert.equal((await db.query("SELECT count(*)::int AS count FROM game_commentary_events WHERE game_id=$1 AND kind='NUMBER'",[game.id])).rows[0].count,i+1);
  if(i===2){
   for(let tries=0;tries<30;tries++){
    const {events}=await req(root+'/commentary?after=0');
    if(events.some(event=>event.kind==='SHOUTOUT'))break;
    await new Promise(r=>setTimeout(r,80));
   }
   const {rows}=await db.query("SELECT event_key,text FROM game_commentary_events WHERE game_id=$1 AND kind='SHOUTOUT' AND status='READY'",[game.id]);
   assert.equal(rows.length,1);
   assert.equal(rows[0].event_key,'shoutout:3');
   assert.match(rows[0].text,/Riya Sharma.*15 में से 3.*अभी का नंबर टिकट पर है/);
  }
 }
 const first=(await req(root+'/commentary?after=0')).events.filter(e=>e.kind==='NUMBER');
 assert.equal(first.length,5);
 assert.ok(first.some(e=>e.text.includes(String(ticket[0]))));
 assert.equal(new Set(first.map(e=>e.text.replace(/\d+/g,'#'))).size,5);
 await host.locator('#commentary-refresh').click();
 await host.waitForFunction(()=>$('#commentary-last').textContent.includes('Scripted fallback'));

 // A confirmed award is a separate event, even if the draw is paused for claim review.
 const category=(await db.query("SELECT id,name FROM winning_categories WHERE game_id=$1 AND rule_type='EARLY_FIVE'",[game.id])).rows[0];
 await db.query('INSERT INTO category_outcomes(category_id,game_id,tie_break_policy,resolved_sequence) VALUES($1,$2,$3,5) ON CONFLICT DO NOTHING',[category.id,game.id,'SHARED_PRIZE']);
 await db.query('INSERT INTO winners(id,category_id,game_id,player_id,ticket_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),category.id,game.id,player.player.id,player.ticket.id]);
 await req(root+'/commentary?after=0');for(let tries=0;tries<30;tries++){const e=(await req(root+'/commentary?after=0')).events;if(e.some(x=>x.kind==='WINNER'))break;await new Promise(r=>setTimeout(r,80));}
 assert.equal((await db.query("SELECT count(*)::int AS count FROM game_commentary_events WHERE game_id=$1 AND kind='WINNER'",[game.id])).rows[0].count,1);
 await tv.waitForFunction(()=>document.querySelector('#commentary-caption')?.textContent?.length>0,{timeout:10000}).catch(()=>{});
 await req(root+'/commentary/admin/settings',{method:'POST',body:{language:'en',callsEvery:10,shoutoutsEvery:0,accent:'us',familyFriendly:false,allowSexualReferences:true}});
 assert.equal((await req(root+'/commentary/admin/settings')).allowSexualReferences,true);
 await stop('SIGKILL');await start();
 const recovered=await req(root+'/commentary/admin/settings');
 assert.equal(recovered.language,'en');assert.equal(recovered.innuendoIntensity,3);assert.equal(recovered.lastAnnouncement.kind,'WINNER');assert.equal(recovered.lastAnnouncement.gemini.status,'no_key');
 await host.reload();
 if((await host.locator('#commentary-panel').getAttribute('open'))===null){
  await host.locator('#commentary-panel > summary').click();
 }
 await meter.waitFor();assert.equal(await meter.inputValue(),'3');
 assert.equal((await db.query('SELECT count(*)::int AS count FROM game_commentary_events WHERE game_id=$1',[game.id])).rows[0].count,7);
 assert.deepEqual(errors,[]);await tv.close();await host.close();console.log('PASS Hindi and English settings, family mode, duplicate polls, grounded progress and winner, voice fallback and crash recovery');
}
