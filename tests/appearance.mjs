import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function appearanceChecks({browser,base,key,db,outputDir,stop,start}) {
 const headers={'content-type':'application/json','x-admin-key':key};
 async function request(path,body,status=201){const r=await fetch(base+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});assert.equal(r.status,body?status:200,await r.clone().text());return r.json();}
 const context=await browser.newContext({viewport:{width:390,height:844}}),host=await context.newPage(),errors=[];host.on('pageerror',e=>errors.push(e.message));
 await host.goto(base+'/admin');await host.locator('#key').fill(key);
 assert.equal(await host.title(),'Tambola · Host desk');
 await host.getByRole('link',{name:/New game/}).click();
 assert.equal(await host.locator('#appearance-name').inputValue(),'Tambola');
 await host.locator('#appearance-name').fill('Advay’s birthday');await host.locator('[data-theme-choice=birthday]').click();await host.locator('#appearance-welcome').fill('Welcome, friends!');
 await host.locator('#appearance-palette').selectOption('midnight');
 await host.locator('#appearance-backdrop').selectOption('lattice');
 await host.locator('#appearance-corners').selectOption('crisp');
 await host.locator('#create').click();await host.waitForURL(/\/admin\/[a-f0-9-]+$/);
 const id=new URL(host.url()).pathname.split('/').at(-1),root='/games/'+id;
 let game=await request(root);assert.equal(game.themeId,'birthday');assert.equal(game.welcomeMessage,'Welcome, friends!');
 assert.deepEqual(game.themeLayers,{palette:'midnight',backdrop:'lattice',corners:'crisp'});
 assert.equal(await host.title(),'Tambola · Game console');
 await host.getByRole('combobox',{name:'Host section'}).selectOption('style');
 await host.locator('#appearance-panel > summary').click();await host.locator('#appearance-name').fill('Unsaved draft');
 await host.getByRole('combobox',{name:'Host section'}).selectOption('players');
 await host.getByRole('combobox',{name:'Host section'}).selectOption('style');
 await host.evaluate(()=>window.dispatchEvent(new Event('tambola:changed')));await host.waitForTimeout(500);assert.equal(await host.locator('#appearance-name').inputValue(),'Unsaved draft');
 const tv=await context.newPage();await tv.setViewportSize({width:1280,height:720});tv.on('pageerror',e=>errors.push(e.message));await tv.goto(base+'/tv/'+game.joinCode);
 const guest=await context.newPage();guest.on('pageerror',e=>errors.push(e.message));await guest.goto(base+'/g/'+game.joinCode);
 await tv.waitForFunction(()=>document.documentElement.dataset.theme==='birthday');await guest.waitForFunction(()=>document.documentElement.dataset.theme==='birthday');
 assert.match(await tv.locator('.brand').textContent(),/TAMBOLA/);
 assert.match(await guest.locator('.brand').textContent(),/TAMBOLA/);
 await tv.waitForFunction(()=>document.documentElement.dataset.backdrop==='lattice');
 await guest.waitForFunction(()=>document.documentElement.dataset.backdrop==='lattice');
 assert.equal(await tv.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--occasion-background').trim()),'#111c31');
 assert.equal(await guest.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--occasion-cell-radius').trim()),'3px');
 await host.locator('#appearance-backdrop').selectOption('plain');
 assert.equal(await host.locator('#appearance-preview-tv').evaluate(el=>getComputedStyle(el,'::before').backgroundImage),'none');
 await host.locator('#appearance-reset').click();
 assert.equal(await host.locator('#appearance-palette').inputValue(),'');
 for(const [id,color] of [['accent','#050505'],['secondary','#60f9e6']]){
  await host.locator('#appearance-'+id).evaluate((picker,value)=>{picker.value=value;picker.dispatchEvent(new Event('input'));},color);
 }
 await host.locator('#appearance-decor').selectOption('vivid');
 await host.locator('#appearance-print').selectOption('mono');
 await host.locator('[data-preview-choice=print]').click();
 assert.ok(await host.locator('#appearance-preview-print').isVisible());
 assert.equal(await host.locator('#appearance-preview-print').evaluate(el=>el.style.getPropertyValue('--occasion-ink')),'#292929');
 await host.locator('#save-appearance').click();
 await host.waitForFunction(()=>document.querySelector('#appearance-result').textContent.includes('saved'));
 const customized=(await request(root)).themeLayers;
 assert.deepEqual(customized,{accent:'#050505',secondary:'#60f9e6',decor:'vivid',print:'mono'});
 await tv.waitForFunction(()=>document.documentElement.dataset.printStyle==='mono');
 await guest.waitForFunction(()=>document.documentElement.dataset.printStyle==='mono');
 const contrast=await tv.evaluate(()=>{
  const style=getComputedStyle(document.documentElement);
  function light(token){
   const color=style.getPropertyValue('--occasion-'+token).trim();
   const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
   return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  }
  return (light('accent')+.05)/(light('panel-top')+.05);
 });
 assert.ok(contrast>=4.5, 'Dark custom accents must remain readable');
 await request(root+'/admin/appearance',{name:'Older client edit',themeId:'birthday'});
 assert.deepEqual((await request(root)).themeLayers,customized);
 await host.locator('#appearance-reset').click();
 await host.locator('[data-preview-choice=tv]').click();
 const baseline=(await db.query('SELECT remaining_numbers,next_number_sequence,next_ticket_number FROM games WHERE id=$1',[id])).rows[0];
 for(const themeId of ['classic','diwali','birthday','holi','wedding','game-night','eid','new-year','elegant']) {
  await host.locator('[data-theme-choice='+themeId+']').click();await host.locator('#appearance-name').fill('A celebration for everyone');await host.locator('#save-appearance').click();
  await host.waitForFunction(()=>document.querySelector('#appearance-result').textContent.includes('saved'));
  assert.deepEqual((await request(root)).themeLayers,{});
  await tv.waitForFunction(theme=>document.documentElement.dataset.theme===theme,themeId);await guest.waitForFunction(theme=>document.documentElement.dataset.theme===theme,themeId);
  for(const [width,height] of [[960,540],[1280,720],[1920,1080],[3840,2160]]){await tv.setViewportSize({width,height});assert.ok(await tv.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));}
  await tv.setViewportSize({width:1280,height:720});await tv.screenshot({path:outputDir+'/theme-'+themeId+'-tv.png'});
  assert.ok(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 assert.deepEqual((await db.query('SELECT remaining_numbers,next_number_sequence,next_ticket_number FROM games WHERE id=$1',[id])).rows[0],baseline);
 await host.locator('#appearance-palette').selectOption('prism');
 await host.locator('#appearance-backdrop').selectOption('ribbons');
 await host.locator('#appearance-corners').selectOption('round');
 await host.screenshot({path:outputDir+'/theme-host-phone.png',fullPage:true});
 await request(root+'/admin/appearance',{name:'test',themeId:'unknown'},400);await request(root+'/admin/appearance',{name:'test',welcomeMessage:'x'.repeat(241)},400);
 for(const themeLayers of [{accent:'red; color:white'},{backdrop:'unknown'},{print:false},['lagoon']]){
  await request(root+'/admin/appearance',{name:'Test',themeId:'classic',themeLayers},400);
 }
 const unsafe='<img src=x onerror=alert(1)>';
 await request(root+'/admin/appearance',{name:unsafe,themeId:'elegant',welcomeMessage:unsafe});await guest.waitForFunction(text=>document.querySelector('[data-occasion-welcome]').textContent===text,unsafe);assert.equal(await guest.locator('[data-occasion-welcome] img').count(),0);
 await request(root+'/start',{});await request(root+'/admin/appearance',{name:'Live party',themeId:'diwali'},409);
 await host.evaluate(()=>window.dispatchEvent(new Event('tambola:changed')));await host.waitForTimeout(500);
 host.once('dialog',d=>d.dismiss());await host.locator('[data-theme-choice=classic]').click();await host.locator('#save-appearance').click();assert.equal((await request(root)).themeId,'elegant');
 host.once('dialog',d=>d.accept());await host.locator('#appearance-palette').selectOption('prism');await host.locator('#appearance-backdrop').selectOption('ribbons');await host.locator('#save-appearance').click();await tv.waitForFunction(()=>document.documentElement.dataset.theme==='classic'&&document.documentElement.dataset.backdrop==='ribbons');
 await stop('SIGKILL');await start();game=await request(root);assert.equal(game.themeId,'classic');assert.equal(game.status,'PAUSED');
 assert.equal(game.themeLayers.palette,'prism');assert.equal(game.themeLayers.backdrop,'ribbons');
 await db.query("UPDATE games SET theme_id='future-theme' WHERE id=$1",[id]);const unknown=await request(root);assert.equal(unknown.themeId,'classic');assert.deepEqual(unknown.themeLayers,{});
 await request(root+'/admin/appearance',{name:'Printed celebration',themeId:'birthday',themeLayers:{accent:'#ee7777',print:'mono'},confirmLive:true});
 const player=await request(root+'/players/register',{name:'Print guest',deviceId:randomUUID()});
 await request(root+'/admin/players/'+player.player.id+'/approve',{});
 // Late-join tickets submit automatically after approval.
 const ticket=await request(root+'/admin/players/'+player.player.id+'/ticket');assert.equal(ticket.appearance.themeId,'birthday');assert.equal(ticket.appearance.themeLayers.print,'mono');
 await host.reload();await host.waitForFunction(()=>typeof window.printTambolaTickets==='function');
 const popupPromise=context.waitForEvent('page');await host.evaluate(({id,key,playerId})=>window.printTambolaTickets(id,key,playerId),{id,key,playerId:player.player.id});const print=await popupPromise;
 await print.locator('section').waitFor();assert.equal(await print.locator('header strong').textContent(),'Tambola');assert.equal(await print.locator('section').getAttribute('data-print-style'),'mono');assert.equal(await print.locator('section').evaluate(el=>el.style.getPropertyValue('--print-accent')),'#292929');assert.equal(await print.locator('section').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');await print.pdf({path:outputDir+'/birthday-tickets.pdf',preferCSSPageSize:true});
 assert.deepEqual(errors,[]);await context.close();console.log('PASS appearance layers, accessible accents, live propagation, TV fit, restart and themed print');
}
