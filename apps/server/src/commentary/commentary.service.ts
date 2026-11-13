import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { QueryResultRow } from 'pg';

export interface CommentarySettings {
 enabled:boolean;language:'en'|'hi';tone:'warm'|'energetic'|'playful';callsEvery:number;shoutoutsEvery:number;shoutoutMode:'mixed'|'leaders'|'few';announceWinners:boolean;
 familyFriendly:boolean;allowSexualReferences:boolean;accent:'indian'|'us';voiceProvider:'browser'|'elevenlabs';voiceStyle:'standard'|'licensed';
}
const defaults:CommentarySettings={enabled:false,language:'en',tone:'warm',callsEvery:1,shoutoutsEvery:5,shoutoutMode:'mixed',announceWinners:true,familyFriendly:true,allowSexualReferences:false,accent:'indian',voiceProvider:'browser',voiceStyle:'standard'};
const uuid=(id:string)=>{if(!/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(id))throw new BadRequestException('Invalid game ID');return id;};
function boundedInt(v:unknown,min:number,max:number):v is number{return typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max;}
export function parseSettings(input:Record<string,unknown>):CommentarySettings {
 const c={...defaults,...input};
 for(const k of ['enabled','announceWinners','familyFriendly','allowSexualReferences'] as const)if(typeof c[k]!=='boolean')throw new BadRequestException(`Invalid ${k}`);
 if(!['hi','en'].includes(c.language)||!['warm','energetic','playful'].includes(c.tone)||!['mixed','leaders','few'].includes(c.shoutoutMode)||!['indian','us'].includes(c.accent)||!['browser','elevenlabs'].includes(c.voiceProvider)||!['standard','licensed'].includes(c.voiceStyle)||!boundedInt(c.callsEvery,1,10)||!boundedInt(c.shoutoutsEvery,0,30))throw new BadRequestException('Invalid commentary settings');
 if(c.familyFriendly&&c.allowSexualReferences)throw new BadRequestException('Turn off family friendly mode before enabling mild adult references');
 return c as CommentarySettings;
}
interface Game extends QueryResultRow {id:string;status:string;emergency_stopped:boolean;next_number_sequence:number;}
interface Event extends QueryResultRow {seq:string;game_id:string;event_key:string;kind:'NUMBER'|'WINNER'|'SHOUTOUT';language:'en'|'hi';text:string;status:string;lease_until:Date;audio:Buffer|null;}
interface Fact {key:string;kind:Event['kind'];number?:number;name?:string;category?:string;hits?:number;ticketSize?:number;latestHit?:boolean;sequence:number;}
const voiceEnv=(settings:CommentarySettings)=>'COMMENTARY_ELEVEN_VOICE_'+(settings.voiceStyle==='licensed'?'LICENSED':settings.language.toUpperCase()+'_'+(settings.accent==='us'?'US':'IN'));
const numberCalls = {
 en: [
  (n:number)=>`Here comes ${n}! See if it’s on your ticket.`,
  (n:number)=>`Eyes on the board. It’s ${n}!`,
  (n:number)=>`We’ve drawn ${n}! Mark it if you have it.`,
  (n:number)=>`The next number is ${n}. Anyone get a match?`,
  (n:number)=>`And out comes ${n}!`,
 ],
 hi: [
  (n:number)=>`लीजिए, ${n} आ गया! देखिए, आपके टिकट पर है क्या?`,
  (n:number)=>`नज़रें बोर्ड पर। इस बार निकला ${n}!`,
  (n:number)=>`आज की अगली पुकार, ${n}! हो तो निशान लगाइए।`,
  (n:number)=>`किसके टिकट पर है ${n}? यही है हमारा अगला नंबर।`,
  (n:number)=>`और इस बार निकला ${n}!`,
 ],
};

function ticketMood(hits:number, size:number, latestHit:boolean) {
 if(size-hits===1)return 'suspense';
 if(hits===0)return 'anticipation';
 if(latestHit)return 'excitement';
 return 'hope';
}

const moodLines = {
 en: {
  suspense: 'One more for a full ticket. This could be a nail-biter!',
  anticipation: 'Still waiting for that first match. Will the next call do it?',
  excitement: 'The latest call was a match. That might earn a little cheer!',
  hope: 'No match on that call. There’s still plenty to play for.',
 },
 hi: {
  suspense: 'पूरा टिकट भरने के लिए बस एक नंबर। अब तो धड़कनें तेज़ हो सकती हैं!',
  anticipation: 'पहले निशान का इंतज़ार है। क्या अगली पुकार में आएगा?',
  excitement: 'अभी का नंबर टिकट पर है। इस पर तो एक छोटी सी खुशी बनती है!',
  hope: 'इस बार नंबर नहीं मिला। उम्मीद अभी बाकी है।',
 },
};

function fallback(f:Fact,c:CommentarySettings):string {
 if(f.kind==='WINNER')return c.language==='hi'?`${f.category} के विजेता ${f.name}! ज़ोरदार तालियाँ!`:`${f.name} wins ${f.category}! A round of applause!`;
 if(f.kind==='SHOUTOUT'){
  const hits=f.hits!, size=f.ticketSize!;
  const progress=c.language==='hi'?`${f.name} के टिकट पर ${size} में से ${hits} नंबर आ चुके हैं।`:`${f.name} has matched ${hits} of ${size} numbers.`;
  return progress+' '+moodLines[c.language][ticketMood(hits,size,Boolean(f.latestHit))];
 }
 const variants=numberCalls[c.language];
 // Index by the announcement count so intervals like 5 don't repeat the same phrase.
 return variants[(Math.floor(f.sequence/c.callsEvery)-1)%variants.length](f.number!);
}
/** Grounded facts and stable event keys keep LLM latency away from number draws. */
@Injectable()
export class CommentaryService {
 constructor(private readonly db:DatabaseService){}
 private async game(id:string):Promise<Game> {const g=(await this.db.query<Game>('SELECT id,status,emergency_stopped,next_number_sequence FROM games WHERE id=$1',[uuid(id)])).rows[0];if(!g)throw new NotFoundException('Game not found');return g;}
 async settings(id:string):Promise<CommentarySettings & {aiAvailable:boolean;voiceAvailable:boolean;licensedVoiceAvailable:boolean}> {
  await this.game(id);const row=(await this.db.query<Record<string,unknown>&QueryResultRow>(`SELECT enabled,language,tone,shoutout_mode AS "shoutoutMode",calls_every AS "callsEvery",shoutouts_every AS "shoutoutsEvery",announce_winners AS "announceWinners",family_friendly AS "familyFriendly",allow_sexual_references AS "allowSexualReferences",accent,voice_provider AS "voiceProvider",voice_style AS "voiceStyle" FROM game_commentary_settings WHERE game_id=$1`,[id])).rows[0];
  const c=parseSettings(row??{});return {...c,aiAvailable:Boolean(process.env.GEMINI_API_KEY),voiceAvailable:Boolean(process.env.ELEVENLABS_API_KEY&&process.env[voiceEnv(c)]),licensedVoiceAvailable:Boolean(process.env.COMMENTARY_ELEVEN_VOICE_LICENSED)};
 }
 async update(id:string,body:Record<string,unknown>):Promise<ReturnType<CommentaryService['settings']>> {
  await this.game(id);const existing=await this.settings(id);const keys=Object.keys(defaults);
  if(Object.keys(body??{}).some(key=>!keys.includes(key)))throw new BadRequestException('Unknown commentary setting');
  const c=parseSettings({...existing,...body});
  if(c.voiceProvider==='elevenlabs'&&(!process.env.ELEVENLABS_API_KEY||!process.env[voiceEnv(c)]))throw new BadRequestException('The selected cloud voice has not been configured by the service owner');
  if(c.voiceStyle==='licensed'&&c.voiceProvider!=='elevenlabs')throw new BadRequestException('Licensed voice requires cloud speech');
  await this.db.query(`INSERT INTO game_commentary_settings(game_id,enabled,language,tone,calls_every,shoutouts_every,shoutout_mode,announce_winners,family_friendly,allow_sexual_references,accent,voice_provider,voice_style)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
   ON CONFLICT(game_id) DO UPDATE SET enabled=$2,language=$3,tone=$4,calls_every=$5,shoutouts_every=$6,shoutout_mode=$7,announce_winners=$8,family_friendly=$9,allow_sexual_references=$10,accent=$11,voice_provider=$12,voice_style=$13,updated_at=NOW()`,
   [id,c.enabled,c.language,c.tone,c.callsEvery,c.shoutoutsEvery,c.shoutoutMode,c.announceWinners,c.familyFriendly,c.allowSexualReferences,c.accent,c.voiceProvider,c.voiceStyle]);
  return this.settings(id);
 }
 /** TV poll. At most one provider job is started per poll and game; every event is unique and durable. */
 async poll(id:string,afterRaw:unknown):Promise<{settings:CommentarySettings;halted:boolean;events:{seq:number;kind:string;text:string;audio:boolean}[]}> {
  const game=await this.game(id),settings=await this.settings(id),after=Number(afterRaw??0);
  if(!Number.isSafeInteger(after)||after<0)throw new BadRequestException('Invalid cursor');
  if(settings.enabled&&game.status!=='CREATED'&&!game.emergency_stopped) {
   const fact=await this.chooseFact(id,game,settings);
   if(fact){const claimed=await this.claim(id,fact,settings);if(claimed)void this.produce(id,claimed,fact,settings).catch(e=>console.warn('Commentary generation failed',e instanceof Error?e.message:'unknown error'));}
  }
  const rows=(await this.db.query<Event>(`SELECT seq,kind,text,audio IS NOT NULL AS has_audio FROM game_commentary_events WHERE game_id=$1 AND status='READY' AND seq>$2 AND language=$3 ORDER BY seq DESC LIMIT 12`,[id,after,settings.language])).rows.reverse();
  return {settings,halted:game.emergency_stopped,events:rows.map(r=>({seq:Number(r.seq),kind:r.kind,text:r.text,audio:Boolean((r as Event&{has_audio:boolean}).has_audio)}))};
 }
 private async chooseFact(id:string,game:Game,c:CommentarySettings):Promise<Fact|null> {
  // Declared winners, not provisional claimants; catch late confirmations after the next draw.
  if(c.announceWinners){const winner=(await this.db.query<{id:string;name:string;category:string;sequence:number}&QueryResultRow>(`SELECT w.id,p.name,cat.name AS category,o.resolved_sequence AS sequence FROM winners w JOIN players p ON p.id=w.player_id JOIN winning_categories cat ON cat.id=w.category_id JOIN category_outcomes o ON o.category_id=cat.id WHERE w.game_id=$1 AND w.declared_at>NOW()-INTERVAL '2 hours' AND NOT EXISTS(SELECT 1 FROM game_commentary_events e WHERE e.game_id=$1 AND e.event_key='winner:'||w.id::text AND (e.status='READY' OR e.lease_until>NOW())) ORDER BY w.declared_at LIMIT 1`,[id])).rows[0];if(winner)return {key:'winner:'+winner.id,kind:'WINNER',name:winner.name,category:winner.category,sequence:winner.sequence};}
  const latest=(await this.db.query<{number:number;sequence:number}&QueryResultRow>('SELECT number,sequence FROM called_numbers WHERE game_id=$1 ORDER BY sequence DESC LIMIT 1',[id])).rows[0];if(!latest)return null;
  const existing=(await this.db.query<{event_key:string}&QueryResultRow>("SELECT event_key FROM game_commentary_events WHERE game_id=$1 AND event_key=ANY($2::text[]) AND (status='READY' OR lease_until>NOW())",[id,['number:'+latest.sequence,'shoutout:'+latest.sequence]])).rows;
  const seen=new Set(existing.map(r=>r.event_key));
  if(game.status==='COMPLETED')return null;
  if(latest.sequence%c.callsEvery===0&&!seen.has('number:'+latest.sequence))return {key:'number:'+latest.sequence,kind:'NUMBER',number:latest.number,sequence:latest.sequence};
  if(c.shoutoutsEvery&&latest.sequence%c.shoutoutsEvery===0&&!seen.has('shoutout:'+latest.sequence)){
   const players=(await this.db.query<{name:string;numbers:number[]}&QueryResultRow>(`SELECT p.name,t.numbers FROM tickets t JOIN players p ON p.id=t.player_id WHERE t.game_id=$1 AND t.status='SUBMITTED' AND p.approved ORDER BY p.id LIMIT 200`,[id])).rows;
   const called=new Set((await this.db.query<{number:number}&QueryResultRow>('SELECT number FROM called_numbers WHERE game_id=$1 AND sequence<=$2',[id,latest.sequence])).rows.map(r=>r.number));
   const ranking=players.map(p=>({name:p.name,hits:p.numbers.filter(n=>called.has(n)).length,ticketSize:p.numbers.length,latestHit:p.numbers.includes(latest.number)})).filter(p=>p.hits<p.ticketSize).sort((a,b)=>b.hits-a.hits||a.name.localeCompare(b.name));
   const focus=c.shoutoutMode==='mixed'?(latest.sequence/c.shoutoutsEvery)%2?'leaders':'few':c.shoutoutMode;const group=focus==='leaders'?ranking.slice(0,3):ranking.slice(-3);const selected=group.length?group[Math.floor(latest.sequence/c.shoutoutsEvery)%group.length]:null;
   if(selected)return {key:'shoutout:'+latest.sequence,kind:'SHOUTOUT',...selected,sequence:latest.sequence};
  }
  return null;
 }
 private async claim(id:string,f:Fact,c:CommentarySettings):Promise<Event|null>{
  return this.db.transaction(async client=>{
   // A bounded per-game budget also limits third-party spend; winners reserve a little room.
   await client.query('SELECT id FROM games WHERE id=$1 FOR UPDATE',[id]);
   const count=(await client.query<{count:number}>('SELECT count(*)::int AS count FROM game_commentary_events WHERE game_id=$1',[id])).rows[0].count;
   if(count>=240)return null;
   const insert=await client.query<Event>(`INSERT INTO game_commentary_events(game_id,event_key,kind,language) VALUES($1,$2,$3,$4) ON CONFLICT(game_id,event_key) DO UPDATE SET status='PROCESSING',lease_until=NOW()+INTERVAL '30 seconds' WHERE game_commentary_events.status='PROCESSING' AND game_commentary_events.lease_until<NOW() RETURNING *`,[id,f.key,f.kind,c.language]);return insert.rows[0]??null;
  });
 }
 private async produce(id:string,event:Event,f:Fact,c:CommentarySettings):Promise<void>{
  let line=fallback(f,c);
  if(process.env.GEMINI_API_KEY){try{const flourish=await this.flourish(f,c);if(flourish)line+=' '+flourish;}catch(e){console.warn('Commentary text provider unavailable',e instanceof Error?e.message:'unknown error');}}
  let audio:Buffer|null=null;
  if(c.voiceProvider==='elevenlabs'){try{audio=await this.speech(line,c);}catch(e){console.warn('Commentary speech provider unavailable',e instanceof Error?e.message:'unknown error');}}
  await this.db.query("UPDATE game_commentary_events SET status='READY',text=$3,audio=$4 WHERE game_id=$1 AND seq=$2 AND status='PROCESSING'",[id,event.seq,line,audio]);
 }
 private async flourish(f:Fact,c:CommentarySettings):Promise<string>{
  const signal=AbortSignal.timeout(4000);
  const prompt=`Write one fresh Tambola host reaction with a ${c.tone} tone, at most 16 words, ${c.language==='hi'?'in natural Hindi Devanagari':'in natural English'}. Facts: ${JSON.stringify({event:f.kind,number:f.number,calledOnTicket:f.hits,ticketSize:f.ticketSize,latestCallMatched:f.latestHit,callIndex:f.sequence})}. For a shout-out, respond to the ticket progress with gentle suspense or encouragement. Suggest how the moment might feel without claiming to know the player’s emotions. Do not invent players, winners, progress, prizes, or numbers; do not repeat facts. No names or digits in the response. No harassment, profanity, or stereotypes. ${c.familyFriendly?'Family friendly for children. No sexual references.':c.allowSexualReferences?'Adults are present; mild non-explicit innuendo is allowed. No explicit sexual content.':'No sexual references.'} Return only the reaction.`;
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',{method:'POST',headers:{'x-goog-api-key':process.env.GEMINI_API_KEY!,'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.8,maxOutputTokens:60}}),signal});
  if(!response.ok)throw Error('Gemini '+response.status);
  const data=await response.json() as {candidates?:{content?:{parts?:{text?:string}[]}}[]};const value=data.candidates?.[0]?.content?.parts?.map(p=>p.text??'').join('').trim()??'';
  // The deterministic first sentence is always the factual source of truth.
  if(value.length>140||/\d|[<>\r\n]/.test(value)||(/\b(?:fuck|shit|porn|nude|naked|rape)\b|(?:अश्लील|नग्न|शारीरिक संबंध)/i.test(value)||(!c.allowSexualReferences&&/\b(?:sex|sexy|kiss|bedroom|hookup)\b|सेक्स/i.test(value))))return '';
  return value;
 }
 private async speech(line:string,c:CommentarySettings):Promise<Buffer|null>{
  const voice=process.env[voiceEnv(c)];if(!voice||!process.env.ELEVENLABS_API_KEY)return null;
  const response=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voice)+'?output_format=mp3_44100_128',{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'content-type':'application/json'},body:JSON.stringify({text:line.slice(0,300),model_id:'eleven_flash_v2_5',language_code:c.language}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('ElevenLabs '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());return bytes.length&&bytes.length<=512_000?bytes:null;
 }
 async audio(id:string,seqRaw:string):Promise<Buffer>{
  await this.game(id);const seq=Number(seqRaw);if(!Number.isSafeInteger(seq)||seq<1)throw new BadRequestException('Invalid commentary ID');
  const event=(await this.db.query<{audio:Buffer|null}&QueryResultRow>("SELECT audio FROM game_commentary_events WHERE game_id=$1 AND seq=$2 AND status='READY'",[id,seq])).rows[0];if(!event?.audio)throw new NotFoundException('Audio unavailable');return event.audio;
 }
}
