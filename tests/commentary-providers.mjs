import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CommentaryService,parseSettings} from '../apps/server/dist/commentary/commentary.service.js';
test('commentary rejects adult references under family mode',()=>{
 assert.throws(()=>parseSettings({familyFriendly:true,allowSexualReferences:true}),/family friendly/i);
 assert.equal(parseSettings({language:'hi',accent:'indian'}).language,'hi');
 assert.throws(()=>parseSettings({callsEvery:0}),/Invalid commentary/);
});
test('Gemini prompt excludes player names and unsafe flourishes fall back',async()=>{
 const previous=globalThis.fetch,key=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only-key';
 const service=new CommentaryService({});
 try{let body,headers;globalThis.fetch=async(_,options)=>{body=JSON.parse(options.body);headers=options.headers;return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Great energy in the room!'}]}}]}),{status:200});};
 const settings=parseSettings({language:'hi'}),fact={key:'shoutout:5',kind:'SHOUTOUT',name:'Private Player',hits:3,sequence:5};
 assert.equal(await service.flourish(fact,settings),'Great energy in the room!');assert.ok(!JSON.stringify(body).includes('Private Player'));assert.equal(headers['x-goog-api-key'],'test-only-key');
 globalThis.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Explicit porn details'}]}}]}),{status:200});assert.equal(await service.flourish(fact,settings),'');
 }finally{globalThis.fetch=previous;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});
test('ElevenLabs uses a configured licensed voice and Hindi language',async()=>{
 const old=globalThis.fetch,keys=['ELEVENLABS_API_KEY','COMMENTARY_ELEVEN_VOICE_LICENSED'].map(k=>[k,process.env[k]]);process.env.ELEVENLABS_API_KEY='test-only-key';process.env.COMMENTARY_ELEVEN_VOICE_LICENSED='licensed-test';
 try{globalThis.fetch=async(url,options)=>{assert.match(url,/licensed-test/);assert.equal(options.headers['xi-api-key'],'test-only-key');assert.equal(JSON.parse(options.body).language_code,'hi');return new Response(Uint8Array.from([1,2,3]),{status:200});};const service=new CommentaryService({});assert.deepEqual(await service.speech('नंबर पाँच',parseSettings({language:'hi',voiceProvider:'elevenlabs',voiceStyle:'licensed'})),Buffer.from([1,2,3]));}
 finally{globalThis.fetch=old;for(const [k,value] of keys){if(value===undefined)delete process.env[k];else process.env[k]=value;}}
});
