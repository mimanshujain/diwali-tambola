import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { hostId } from '../hosting/context.js';
import { geminiKey, generateReaction, type GeminiReport } from './gemini-commentary.js';
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
export interface LiveAnnouncement extends QueryResultRow {kind:Event['kind']; at:Date; gemini:GeminiReport|null;}
interface SpeechResult {
 status:'generated'|'browser'|'voice_unconfigured'|'rejected'|'timeout'|'unavailable';
 audio?:Buffer;
 httpStatus?:number;
}
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

function scriptedLine(f:Fact,c:CommentarySettings,withReaction:boolean):string {
 if(f.kind==='WINNER'){
  const result=c.language==='hi'?`${f.category} के विजेता ${f.name}!`:`${f.name} wins ${f.category}!`;
  return withReaction?result:result+(c.language==='hi'?' ज़ोरदार तालियाँ!':' A round of applause!');
 }
 if(f.kind==='SHOUTOUT'){
  const hits=f.hits!, size=f.ticketSize!;
  const progress=c.language==='hi'?`${f.name} के टिकट पर ${size} में से ${hits} नंबर आ चुके हैं।`:`${f.name} has matched ${hits} of ${size} numbers.`;
  if(withReaction)return progress;
  return progress+' '+moodLines[c.language][ticketMood(hits,size,Boolean(f.latestHit))];
 }
 if(withReaction)return c.language==='hi'?`इस बार निकला ${f.number}!`:`We've called ${f.number}!`;
 const variants=numberCalls[c.language];
 // Index by the announcement count so intervals like 5 don't repeat the same phrase.
 return variants[(Math.floor(f.sequence/c.callsEvery)-1)%variants.length](f.number!);
}

function sampleFact(scenario:unknown,number:unknown,c:CommentarySettings):Fact {
 const sample={key:'preview',sequence:20};
 const player={...sample,kind:'SHOUTOUT' as const,name:c.language==='hi'?'मीरा':'Meera',ticketSize:15};
 switch(scenario){
  case 'number':
   if(!boundedInt(number,1,90))throw new BadRequestException('Choose a preview number between 1 and 90');
   return {...sample,kind:'NUMBER',number,sequence:Math.ceil(sample.sequence/c.callsEvery)*c.callsEvery};
  case 'match':return {...player,hits:5,latestHit:true,sequence:14};
  case 'near-win':return {...player,hits:14,latestHit:true,sequence:48};
  case 'slow-start':return {...player,hits:0,latestHit:false,sequence:8};
  case 'winner':return {...sample,kind:'WINNER',name:player.name,category:c.language==='hi'?'फुल हाउस':'Full House',sequence:52};
  default:throw new BadRequestException('Choose a commentary preview scenario');
 }
}

function draftSettings(current:CommentarySettings,changes:unknown):CommentarySettings {
 if(changes===null||typeof changes!=='object'||Array.isArray(changes))throw new BadRequestException('Invalid commentary settings');
 if(Object.keys(changes).some(key=>!Object.hasOwn(defaults,key)))throw new BadRequestException('Unknown commentary setting');
 const settings=parseSettings({...current,...changes});
 if(settings.voiceStyle==='licensed'&&settings.voiceProvider!=='elevenlabs')throw new BadRequestException('Licensed voice requires cloud speech');
 return settings;
}
/** Grounded facts and stable event keys keep LLM latency away from number draws. */
@Injectable()
export class CommentaryService {
 private readonly previews=new Map<string,{until:number;count:number}>();
 constructor(private readonly db:DatabaseService){}
 private async game(id:string):Promise<Game> {const g=(await this.db.query<Game>('SELECT id,status,emergency_stopped,next_number_sequence FROM games WHERE id=$1',[uuid(id)])).rows[0];if(!g)throw new NotFoundException('Game not found');return g;}
 async settings(id:string):Promise<CommentarySettings & {aiAvailable:boolean;voiceAvailable:boolean;licensedVoiceAvailable:boolean}> {
  await this.game(id);const row=(await this.db.query<Record<string,unknown>&QueryResultRow>(`SELECT enabled,language,tone,shoutout_mode AS "shoutoutMode",calls_every AS "callsEvery",shoutouts_every AS "shoutoutsEvery",announce_winners AS "announceWinners",family_friendly AS "familyFriendly",allow_sexual_references AS "allowSexualReferences",accent,voice_provider AS "voiceProvider",voice_style AS "voiceStyle" FROM game_commentary_settings WHERE game_id=$1`,[id])).rows[0];
  const c=parseSettings(row??{});return {...c,aiAvailable:Boolean(geminiKey()),voiceAvailable:Boolean(process.env.ELEVENLABS_API_KEY?.trim()&&process.env[voiceEnv(c)]?.trim()),licensedVoiceAvailable:Boolean(process.env.COMMENTARY_ELEVEN_VOICE_LICENSED)};
 }
 async adminSettings(id:string){
  const settings=await this.settings(id);
  const latest=(await this.db.query<LiveAnnouncement>(`SELECT kind,created_at AS at,gemini_report AS gemini
   FROM game_commentary_events WHERE game_id=$1 AND status='READY' ORDER BY seq DESC LIMIT 1`,[id])).rows[0];
  return {...settings,lastAnnouncement:latest??null};
 }
 async update(id:string,body:Record<string,unknown>){
  const c=draftSettings(await this.settings(id),body);
  if(c.voiceProvider==='elevenlabs'&&(!process.env.ELEVENLABS_API_KEY?.trim()||!process.env[voiceEnv(c)]?.trim()))throw new BadRequestException('The selected cloud voice has not been configured by the service owner');
  await this.db.query(`INSERT INTO game_commentary_settings(game_id,enabled,language,tone,calls_every,shoutouts_every,shoutout_mode,announce_winners,family_friendly,allow_sexual_references,accent,voice_provider,voice_style)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
   ON CONFLICT(game_id) DO UPDATE SET enabled=$2,language=$3,tone=$4,calls_every=$5,shoutouts_every=$6,shoutout_mode=$7,announce_winners=$8,family_friendly=$9,allow_sexual_references=$10,accent=$11,voice_provider=$12,voice_style=$13,updated_at=NOW()`,
   [id,c.enabled,c.language,c.tone,c.callsEvery,c.shoutoutsEvery,c.shoutoutMode,c.announceWinners,c.familyFriendly,c.allowSexualReferences,c.accent,c.voiceProvider,c.voiceStyle]);
  return this.adminSettings(id);
 }

 /** The host can audition draft settings with fictional facts before saving. */
 async preview(id:string,body:Record<string,unknown>){
  const settings=draftSettings(await this.settings(id),body.settings===undefined?{}:body.settings);
  const fact=sampleFact(body.scenario,body.number,settings);
  this.reservePreview();
  const line=await this.compose(fact,settings);
  const {audio,...voice}=await this.speech(line.text,settings,4500);
  return {...line,voice:{...voice,audio:audio?.toString('base64')??null}};
 }

 private reservePreview():void {
  const host=hostId()??'lan',now=Date.now();
  let budget=this.previews.get(host);
  if(!budget||budget.until<=now){
   if(this.previews.size>=1000)for(const [key,entry] of this.previews)if(entry.until<=now)this.previews.delete(key);
   if(this.previews.size>=1000)throw new HttpException('Preview is busy. Try again shortly.',HttpStatus.TOO_MANY_REQUESTS);
   budget={until:now+60_000,count:0};
   this.previews.set(host,budget);
  }
  if(budget.count>=10)throw new HttpException('Preview limit reached. Try again in a minute.',HttpStatus.TOO_MANY_REQUESTS);
  budget.count++;
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
  const line=await this.compose(f,c),voice=await this.speech(line.text,c);
  if(line.gemini.status!=='generated'&&line.gemini.status!=='no_key')console.warn('Commentary Gemini fallback',line.gemini);
  if(c.voiceProvider==='elevenlabs'&&voice.status!=='generated')console.warn('Commentary cloud voice fallback',voice.status,voice.httpStatus??'');
  await this.db.query("UPDATE game_commentary_events SET status='READY',text=$3,audio=$4,gemini_report=$5 WHERE game_id=$1 AND seq=$2 AND status='PROCESSING'",[id,event.seq,line.text,voice.audio??null,line.gemini]);
 }
 private async compose(f:Fact,c:CommentarySettings){
  const {report, reaction}=await generateReaction({event:f.kind,number:f.number,calledOnTicket:f.hits,ticketSize:f.ticketSize,latestCallMatched:f.latestHit,callIndex:f.sequence},c);
  const script=scriptedLine(f,c,reaction!==null);
  return {text:reaction?script+' '+reaction:script,script,reaction,gemini:report};
 }
 private async speech(line:string,c:CommentarySettings,timeout=8000):Promise<SpeechResult>{
  if(c.voiceProvider==='browser')return {status:'browser'};
  const voice=process.env[voiceEnv(c)]?.trim(),key=process.env.ELEVENLABS_API_KEY?.trim();
  if(!voice||!key)return {status:'voice_unconfigured'};
  const signal=AbortSignal.timeout(timeout);
  try{
   const response=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voice)+'?output_format=mp3_44100_128',{method:'POST',headers:{'xi-api-key':key,'content-type':'application/json'},body:JSON.stringify({text:line,model_id:'eleven_flash_v2_5',language_code:c.language}),signal});
   if(!response.ok)return {status:'rejected',httpStatus:response.status};
   const audio=Buffer.from(await response.arrayBuffer());
   return audio.length&&audio.length<=512_000?{status:'generated',audio}:{status:'unavailable'};
  }catch{return {status:signal.aborted?'timeout':'unavailable'};}
 }
 async audio(id:string,seqRaw:string):Promise<Buffer>{
  await this.game(id);const seq=Number(seqRaw);if(!Number.isSafeInteger(seq)||seq<1)throw new BadRequestException('Invalid commentary ID');
  const event=(await this.db.query<{audio:Buffer|null}&QueryResultRow>("SELECT audio FROM game_commentary_events WHERE game_id=$1 AND seq=$2 AND status='READY'",[id,seq])).rows[0];if(!event?.audio)throw new NotFoundException('Audio unavailable');return event.audio;
 }
}
