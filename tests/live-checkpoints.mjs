import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

export async function notificationChecks({base,key,database}) {
 const response=await fetch(base+'/games',{method:'POST',headers:{'content-type':'application/json','x-admin-key':key},body:JSON.stringify({name:'Notification checkpoints '+randomUUID(),intervalSeconds:3600})});
 assert.ok(response.ok);const game=await response.json();
 const categories=await (await fetch(base+'/games/'+game.id+'/categories')).json();
 const listener=new pg.Client({connectionString:database}),writer=new pg.Client({connectionString:database});
 await listener.connect();await writer.connect();
 const received=[];listener.on('notification',message=>{if(message.payload===game.id)received.push(message.payload);});
 const settle=()=>new Promise(resolve=>setTimeout(resolve,400));
 try{
  await listener.query('LISTEN tambola_game_changed');
  await writer.query('UPDATE games SET scheduler_remaining_seconds=42 WHERE id=$1',[game.id]);await settle();assert.equal(received.length,0);
  await writer.query('UPDATE games SET interval_seconds=interval_seconds+1 WHERE id=$1',[game.id]);await settle();assert.equal(received.length,1);
  const roundId=randomUUID();
  await writer.query(`INSERT INTO sudden_death_rounds(id,game_id,category_id,interval_seconds,ticket_size,remaining_numbers)
    VALUES($1,$2,$3,60,5,$4::smallint[])`,[roundId,game.id,categories[0].id,[1,2,3]]);await settle();received.length=0;
  await writer.query('UPDATE sudden_death_rounds SET paused_remaining_seconds=41 WHERE id=$1',[roundId]);await settle();assert.equal(received.length,0);
  await writer.query('UPDATE sudden_death_rounds SET draw_sequence=1 WHERE id=$1',[roundId]);await settle();assert.equal(received.length,1);
  console.log('PASS checkpoint updates avoid redundant live refreshes');
 } finally {await listener.end();await writer.end();}
}
