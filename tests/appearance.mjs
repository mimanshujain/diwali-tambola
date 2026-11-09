import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function appearanceChecks({browser,base,key,db,outputDir,stop,start}) {
 const headers={'content-type':'application/json','x-admin-key':key};
 async function request(path,body,status=201){const r=await fetch(base+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});assert.equal(r.status,body?status:200,await r.clone().text());return r.json();}
 const context=await browser.newContext({viewport:{width:390,height:844}}),host=await context.newPage(),errors=[];host.on('pageerror',e=>errors.push(e.message));
 await host.goto(base+'/admin');await host.locator('#key').fill(key);
 await host.locator('#appearance-name').fill('Advay’s birthday');await host.locator('[data-theme-choice=birthday]').click();await host.locator('#appearance-welcome').fill('Welcome, friends!');
 await host.locator('#create').click();await host.waitForURL(/\/admin\/[a-f0-9-]+$/);
 const id=new URL(host.url()).pathname.split('/').at(-1),root='/games/'+id;
 let game=await request(root);assert.equal(game.themeId,'birthday');assert.equal(game.welcomeMessage,'Welcome, friends!');
 await host.locator('#appearance-panel > summary').click();await host.locator('#appearance-name').fill('Unsaved draft');
 await host.evaluate(()=>window.dispatchEvent(new Event('tambola:changed')));await host.waitForTimeout(500);assert.equal(await host.locator('#appearance-name').inputValue(),'Unsaved draft');
 const tv=await context.newPage();await tv.setViewportSize({width:1280,height:720});tv.on('pageerror',e=>errors.push(e.message));await tv.goto(base+'/tv/'+game.joinCode);
 const guest=await context.newPage();guest.on('pageerror',e=>errors.push(e.message));await guest.goto(base+'/g/'+game.joinCode);
 await tv.waitForFunction(()=>document.documentElement.dataset.theme==='birthday');await guest.waitForFunction(()=>document.documentElement.dataset.theme==='birthday');
 const baseline=(await db.query('SELECT remaining_numbers,next_number_sequence,next_ticket_number FROM games WHERE id=$1',[id])).rows[0];
 for(const themeId of ['classic','diwali','birthday','elegant']) {
  await host.locator('[data-theme-choice='+themeId+']').click();await host.locator('#appearance-name').fill('A celebration for everyone');await host.locator('#save-appearance').click();
  await host.waitForFunction(()=>document.querySelector('#appearance-result').textContent.includes('saved'));
  await tv.waitForFunction(theme=>document.documentElement.dataset.theme===theme,themeId);await guest.waitForFunction(theme=>document.documentElement.dataset.theme===theme,themeId);
  for(const [width,height] of [[960,540],[1280,720],[1920,1080],[3840,2160]]){await tv.setViewportSize({width,height});assert.ok(await tv.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));}
  await tv.setViewportSize({width:1280,height:720});await tv.screenshot({path:outputDir+'/theme-'+themeId+'-tv.png'});
  assert.ok(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 assert.deepEqual((await db.query('SELECT remaining_numbers,next_number_sequence,next_ticket_number FROM games WHERE id=$1',[id])).rows[0],baseline);
 await host.screenshot({path:outputDir+'/theme-host-phone.png',fullPage:true});
 await request(root+'/admin/appearance',{name:'test',themeId:'unknown'},400);await request(root+'/admin/appearance',{name:'test',welcomeMessage:'x'.repeat(241)},400);
 const unsafe='<img src=x onerror=alert(1)>';
 await request(root+'/admin/appearance',{name:unsafe,themeId:'elegant',welcomeMessage:unsafe});await guest.waitForFunction(text=>document.querySelector('[data-occasion-welcome]').textContent===text,unsafe);assert.equal(await guest.locator('[data-occasion-welcome] img').count(),0);
 await request(root+'/start',{});await request(root+'/admin/appearance',{name:'Live party',themeId:'diwali'},409);
 await host.evaluate(()=>window.dispatchEvent(new Event('tambola:changed')));await host.waitForTimeout(500);
 host.once('dialog',d=>d.dismiss());await host.locator('[data-theme-choice=classic]').click();await host.locator('#save-appearance').click();assert.equal((await request(root)).themeId,'elegant');
 host.once('dialog',d=>d.accept());await host.locator('#save-appearance').click();await tv.waitForFunction(()=>document.documentElement.dataset.theme==='classic');
 await stop('SIGKILL');await start();game=await request(root);assert.equal(game.themeId,'classic');assert.equal(game.status,'PAUSED');
 await db.query("UPDATE games SET theme_id='future-theme' WHERE id=$1",[id]);assert.equal((await request(root)).themeId,'classic');
 await request(root+'/admin/appearance',{name:'Printed celebration',themeId:'birthday',confirmLive:true});
 const player=await request(root+'/players/register',{name:'Print guest',deviceId:randomUUID()});
 await request(root+'/admin/players/'+player.player.id+'/approve',{});
 // Late-join tickets submit automatically after approval.
 const ticket=await request(root+'/admin/players/'+player.player.id+'/ticket');assert.equal(ticket.appearance.themeId,'birthday');
 await host.reload();await host.waitForFunction(()=>typeof window.printTambolaTickets==='function');
 const popupPromise=context.waitForEvent('page');await host.evaluate(({id,key,playerId})=>window.printTambolaTickets(id,key,playerId),{id,key,playerId:player.player.id});const print=await popupPromise;
 await print.locator('section').waitFor();assert.equal(await print.locator('header strong').textContent(),'Birthday');assert.equal(await print.locator('section').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');await print.pdf({path:outputDir+'/birthday-tickets.pdf',preferCSSPageSize:true});
 assert.deepEqual(errors,[]);await context.close();console.log('PASS four themes, live propagation, safe text, phone editor, TV fit, migration fallback, restart and themed print');
}
