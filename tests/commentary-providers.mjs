import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CommentaryService,parseSettings} from '../apps/server/dist/commentary/commentary.service.js';

function mockProvider(t, env, fetch){
 for(const [key,value] of Object.entries(env)){
  const previous=process.env[key];
  if(value===undefined)delete process.env[key];else process.env[key]=value;
  t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
 }
 return t.mock.method(globalThis,'fetch',fetch);
}
const fact={key:'shoutout:5',kind:'SHOUTOUT',name:'Private Player',hits:3,ticketSize:15,latestHit:true,sequence:5};
const answer=text=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private thought'},{text}]}}]});

test('commentary rejects adult references under family mode',()=>{
 assert.throws(()=>parseSettings({familyFriendly:true,allowSexualReferences:true}),/family friendly/i);
 assert.equal(parseSettings({language:'hi',accent:'indian'}).language,'hi');
 assert.throws(()=>parseSettings({callsEvery:0}),/Invalid commentary/);
});
test('Gemini writes a grounded Hindi reaction without sending player names',async t=>{
 const reaction='लगता है किस्मत ने अब ढोल बजाना शुरू कर दिया है!';
 const fetch=mockProvider(t,{GEMINI_API_KEY:'test-only-key',GEMINI_MODEL:undefined},async(url,options)=>{
  assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(options.headers['x-goog-api-key'],'test-only-key');
  const body=JSON.parse(options.body),prompt=body.contents[0].parts[0].text;
  assert.ok(!prompt.includes('Private Player'));
  assert.match(prompt,/"calledOnTicket":3,"ticketSize":15,"latestCallMatched":true/);
  assert.match(prompt,/Hindi.*suitable for children/);
  return answer(reaction);
 });
 const service=new CommentaryService({});
 const line=await service.compose(fact,parseSettings({language:'hi'}));
 assert.equal(fetch.mock.callCount(),1);
 assert.deepEqual(line,{text:`Private Player के टिकट पर 15 में से 3 नंबर आ चुके हैं। ${reaction}`,script:'Private Player के टिकट पर 15 में से 3 नंबर आ चुके हैं।',reaction,gemini:{status:'generated',model:'gemini-3.5-flash-lite'}});
});
test('Gemini audience settings share the fallback and keep provider safety filters on',async t=>{
 let body;
 const responses=[answer('This is a kiss of luck!'),answer('This is a kiss of luck!'),answer('Explicit porn details'),answer('One to go! १')];
 mockProvider(t,{GEMINI_API_KEY:'test-only-key',GEMINI_MODEL:'gemini-3.5-flash-lite'},async(url,options)=>{
  assert.match(url,/gemini-3\.5-flash-lite:generateContent$/);
  body=JSON.parse(options.body);return responses.shift();
 });
 const service=new CommentaryService({}),adult=parseSettings({familyFriendly:false,allowSexualReferences:true});
 const family=await service.compose(fact,parseSettings({}));
 assert.equal(family.gemini.status,'filtered');assert.equal(family.reaction,null);assert.equal(family.script,family.text);
 assert.equal(body.safetySettings[0].threshold,'BLOCK_LOW_AND_ABOVE');
 assert.equal((await service.compose(fact,adult)).reaction,'This is a kiss of luck!');
 assert.match(body.contents[0].parts[0].text,/mild, non-explicit double meaning.*never sexualize or tease a person/);
 assert.equal(body.safetySettings[0].threshold,'BLOCK_MEDIUM_AND_ABOVE');
 assert.equal((await service.compose(fact,adult)).gemini.status,'filtered');
 assert.equal((await service.compose(fact,adult)).gemini.status,'filtered');
});
test('Gemini errors are actionable without exposing provider response text',async t=>{
 const cases=[
  [Response.json({error:{message:'test-only-key',details:[{reason:'API_KEY_INVALID'}]}},{status:400}),'invalid_key',400],
  [Response.json({error:{status:'FAILED_PRECONDITION'}},{status:400}),'billing',400],
  [Response.json({error:{code:402,status:'RESOURCE_EXHAUSTED',message:'Your prepayment credits are depleted.'}},{status:402}),'payment_required',402],
  [new Response(null,{status:403}),'access_denied',403],
  [new Response(null,{status:404}),'model_unavailable',404],
  [new Response(null,{status:429}),'quota',429],
  [new Response(null,{status:503}),'unavailable',503],
  [Response.json({promptFeedback:{blockReason:'SAFETY'}}),'blocked'],
  [Response.json({candidates:[{finishReason:'SAFETY'}]}),'blocked'],
  [Response.json({candidates:[{finishReason:'MAX_TOKENS'}]}),'truncated'],
  [Response.json({candidates:[]}),'empty'],
 ];
 const responses=cases.map(([response])=>response);
 mockProvider(t,{GEMINI_API_KEY:'test-only-key',GEMINI_MODEL:'gemini-3.5-flash-lite'},async()=>responses.shift());
 const service=new CommentaryService({}),settings=parseSettings({});
 for(const [,status,httpStatus] of cases){
  const line=await service.compose(fact,settings);
  assert.deepEqual(line.gemini,{status,httpStatus,model:'gemini-3.5-flash-lite'});
  assert.equal(line.reaction,null);assert.ok(!JSON.stringify(line).includes('test-only-key'));
 }
});
test('Gemini skips network requests for missing key or malformed model ID',async t=>{
 const fetch=mockProvider(t,{GEMINI_API_KEY:undefined,GEMINI_MODEL:'https://example.test/my-key'},async()=>{throw Error('Unexpected fetch');});
 const service=new CommentaryService({}),settings=parseSettings({});
 assert.equal((await service.compose(fact,settings)).gemini.status,'no_key');
 process.env.GEMINI_API_KEY='test-only-key';
 const {gemini}=await service.compose(fact,settings);
 assert.deepEqual(gemini,{status:'invalid_model',model:null,httpStatus:undefined});
 assert.equal(fetch.mock.callCount(),0);
});
test('Gemini timeouts keep the scripted announcement',async t=>{
 t.mock.method(AbortSignal,'timeout',()=>AbortSignal.abort());
 mockProvider(t,{GEMINI_API_KEY:'test-only-key',GEMINI_MODEL:undefined},async (url,options)=>{
  options.signal.throwIfAborted();
 });
 const line=await new CommentaryService({}).compose(fact,parseSettings({}));
 assert.equal(line.gemini.status,'timeout');assert.equal(line.text,line.script);assert.equal(line.reaction,null);
});
test('ElevenLabs uses a configured licensed voice and Hindi language',async t=>{
 mockProvider(t,{ELEVENLABS_API_KEY:'test-only-key',COMMENTARY_ELEVEN_VOICE_LICENSED:'licensed-test'},async(url,options)=>{
  assert.match(url,/licensed-test/);assert.equal(options.headers['xi-api-key'],'test-only-key');
  assert.equal(JSON.parse(options.body).language_code,'hi');return new Response(Uint8Array.from([1,2,3]));
 });
 const service=new CommentaryService({});
 assert.deepEqual(await service.speech('नंबर पाँच',parseSettings({language:'hi',voiceProvider:'elevenlabs',voiceStyle:'licensed'})),{status:'generated',audio:Buffer.from([1,2,3])});
});
