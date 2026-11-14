// Browser acceptance entry point. Call browserChecks with a Playwright Chromium browser
// and the disposable state returned by party-operations.mjs. Never use production games.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function browserChecks({browser,base,key,state,outputDir}){
 const errors=[];
 const hostContext=await browser.newContext({viewport:{width:1440,height:1000}});
 const host=await hostContext.newPage();host.on('pageerror',e=>errors.push(e.message));
 await host.goto(base+'/admin');assert.ok(await host.locator('header #key').isVisible());await host.locator('#key').fill(key);await host.locator('#load').click();
 await host.locator('.game-card').first().waitFor();assert.equal(await host.locator('.game-card').filter({hasText:state.game.name}).count(),0);
 await host.locator('#filter').selectOption('all');assert.equal(await host.locator('.game-card').filter({hasText:state.game.name}).count(),1);
 await host.locator('.game-card').filter({hasText:state.lobby.name}).getByRole('link',{name:'Open console'}).click();
 await host.locator('#game-code').filter({hasText:state.lobby.joinCode}).waitFor();
 const hostNav=host.getByRole('navigation',{name:'Host sections'});
 await hostNav.getByRole('link',{name:'TV & guest links'}).click();await host.waitForURL('**#sharing');
 assert.equal(await host.locator('#tvUrl').getAttribute('href'),base+'/tv/'+state.lobby.joinCode);
 assert.equal(await host.locator('#guest-url').inputValue(),base+'/g/'+state.lobby.joinCode);
 assert.ok((await host.locator('#tvQr').getAttribute('src')).endsWith('/tv-qr.svg'));
 await hostNav.getByRole('link',{name:'Players & tickets'}).click();await host.waitForURL('**#players');
 assert.equal(await host.locator('#round').isVisible(),false);
 assert.equal(await host.evaluate(()=>document.activeElement.textContent),'Players & tickets');
 await host.goBack();await host.waitForURL('**#sharing');await host.locator('#access-panel').waitFor();
 await host.goForward();await host.waitForURL('**#players');
 await host.reload();await host.locator('#players-panel').waitFor();assert.equal(await hostNav.locator('[aria-current=page]').getAttribute('href'),'#players');
 const guestContext=await browser.newContext({viewport:{width:390,height:844}}),guest=await guestContext.newPage();guest.on('pageerror',e=>errors.push(e.message));
 await guest.goto(base+'/g/'+state.lobby.joinCode);await guest.locator('#name').fill('Festival Guest');await guest.locator('#register-button').click();
 await guest.locator('#ticket-section').waitFor({state:'visible'});assert.equal(await guest.locator('input[type=tel]').count(),0);
 assert.equal(await guest.locator('header #welcome').textContent(),'Festival Guest');
 assert.equal(await guest.locator('#regenerate').isVisible(),true);assert.equal(await guest.locator('#submit').isDisabled(),true);
 const first=await guest.locator('#ticket-code').textContent();await guest.locator('#regenerate').click();await guest.waitForFunction(old=>document.querySelector('#ticket-code').textContent!==old,first);
 const recoveryCode=await guest.locator('#recovery-code').textContent();assert.match(recoveryCode,/^[a-f0-9]{32}$/);
 await host.evaluate(()=>window.dispatchEvent(new Event('tambola:changed')));
 await host.getByRole('button',{name:'Approve identity'}).click();
 await guest.evaluate(()=>window.dispatchEvent(new Event('tambola:changed')));await guest.waitForFunction(()=>!document.querySelector('#submit').disabled);
 guest.once('dialog',dialog=>dialog.dismiss());await guest.locator('#submit').click();assert.equal(await guest.locator('#status').textContent(),'Draft ticket');
 guest.once('dialog',dialog=>dialog.accept());await guest.locator('#submit').click();await guest.waitForFunction(()=>document.querySelector('#status').textContent==='Submitted ✓');
 assert.equal(await guest.locator('#regenerate').isVisible(),false);
 assert.ok(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await guest.screenshot({path:outputDir+'/guest-phone.png',fullPage:true});
 const recoveredContext=await browser.newContext({viewport:{width:390,height:844}}),recovered=await recoveredContext.newPage();
 await recovered.goto(base+'/g/'+state.lobby.joinCode);await recovered.locator('#restore-panel > summary').click();await recovered.locator('#recovery-input').fill(recoveryCode);await recovered.locator('#restore-button').click();
 await recovered.waitForFunction(()=>document.querySelector('#status').textContent==='Submitted ✓');assert.equal(await recovered.locator('#ticket-code').textContent(),await guest.locator('#ticket-code').textContent());
 const lobbyRoot='/games/'+state.lobby.id;
 const longName='W'.repeat(80);
 for(let index=0;index<6;index++){
  const person=await state.request(lobbyRoot+'/players/register',{method:'POST',body:{name:index===4?longName:'Batch Guest '+index,deviceId:randomUUID()}});
  await state.request(lobbyRoot+'/admin/players/'+person.player.id+'/approve',{method:'POST',admin:true});
  await state.request(lobbyRoot+'/players/me/submit',{method:'POST',token:person.token,body:{ticketId:person.ticket.id}});
 }
 await host.evaluate(()=>window.dispatchEvent(new Event('tambola:changed')));await host.waitForFunction(()=>document.querySelector('#players-count').textContent.includes('7 submitted'));
 await host.locator('#print-all').click();await host.locator('#print-dialog').waitFor({state:'visible'});
 assert.ok(await host.locator('#print-dialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth));
 assert.equal(await host.locator('#print-options input:checked').count(),7);await host.locator('#print-select-none').click();
 assert.equal(await host.locator('#print-selected').isDisabled(),true);await host.locator('#print-select-all').click();
 await host.locator('#print-options label').filter({hasText:'Batch Guest 5'}).locator('input').uncheck();
 assert.equal(await host.locator('#print-count').textContent(),'6 selected');
 const popupPromise=host.waitForEvent('popup');await host.locator('#print-selected').click();const popup=await popupPromise;await popup.locator('section table').first().waitFor();
 assert.equal(await popup.locator('section').count(),6);assert.deepEqual(await popup.locator('.sheet').evaluateAll(sheets=>sheets.map(sheet=>sheet.querySelectorAll('section').length)),[3,3]);
 assert.equal(await popup.getByRole('heading',{name:'Batch Guest 5'}).count(),0);
 assert.ok(await popup.getByRole('heading',{name:longName}).evaluate(heading=>heading.scrollHeight<=heading.clientHeight));
 const pdf=await popup.pdf({path:outputDir+'/tickets-a4.pdf',preferCSSPageSize:true,printBackground:true});
 const media=/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf.toString('latin1'));assert.ok(media);assert.ok(Number(media[1])>594&&Number(media[1])<597);assert.ok(Number(media[2])>840&&Number(media[2])<844);
 assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,2);
 assert.ok(await popup.evaluate(()=>[...document.querySelectorAll('section')].every(e=>e.scrollHeight<=e.clientHeight)));
 await popup.screenshot({path:outputDir+'/print-preview.png'});await popup.close();
 await host.locator('#print-all').click();const allPopupPromise=host.waitForEvent('popup');await host.locator('#print-selected').click();const allPopup=await allPopupPromise;await allPopup.locator('section table').first().waitFor();
 assert.deepEqual(await allPopup.locator('.sheet').evaluateAll(sheets=>sheets.map(sheet=>sheet.querySelectorAll('section').length)),[3,3,1]);
 const allPdf=await allPopup.pdf({preferCSSPageSize:true});assert.equal((allPdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,3);await allPopup.close();
 const individualPromise=host.waitForEvent('popup');await host.getByRole('button',{name:'Print A4',exact:true}).first().click();const individual=await individualPromise;await individual.locator('section table').waitFor();assert.equal(await individual.locator('section').count(),1);await individual.close();
 for(let index=0;index<8;index++){
  const person=await state.request(lobbyRoot+'/players/register',{method:'POST',body:{name:'TV Guest '+index,deviceId:randomUUID()}});
  await state.request(lobbyRoot+'/admin/players/'+person.player.id+'/approve',{method:'POST',admin:true});
 }
 await host.screenshot({path:outputDir+'/admin-console.png',fullPage:true});
 await host.locator('#switch-game').selectOption(state.game.id);await host.waitForURL('**/admin/'+state.game.id);await host.waitForFunction(()=>document.querySelector('#status').textContent==='Stopped');
 await host.locator('#switch-game').selectOption(state.lobby.id);await host.waitForURL('**/admin/'+state.lobby.id);
 await state.request('/games/'+state.lobby.id+'/start',{method:'POST',admin:true});
 for(const number of [4,9,14,21,26,31,38,45,49,54,61,66,72,77,81,88])await state.request('/games/'+state.lobby.id+'/calls/manual',{method:'POST',admin:true,body:{number}});
 await recovered.waitForFunction(()=>document.querySelector('#player-latest').textContent==='88');
 await recovered.getByRole('link',{name:'Calls',exact:true}).click();assert.equal(await recovered.locator('#callHistory li').count(),16);
 const playerRefresh=recovered.waitForResponse(response=>response.url().endsWith('/players/me/power')&&response.ok());
 await recovered.evaluate(()=>window.dispatchEvent(new Event('tambola:changed')));await playerRefresh;
 assert.equal(await recovered.locator('#ticket-section').isVisible(),false);
 await recovered.getByRole('link',{name:'My ticket',exact:true}).click();assert.equal(await recovered.locator('#ticket .cell').count(),27);
 await recovered.screenshot({path:outputDir+'/player-live-phone.png'});
 const tv=await hostContext.newPage();tv.on('pageerror',e=>errors.push(e.message));
 for(const [width,height] of [[960,540],[1024,600],[1280,720],[1366,768],[1920,1080],[2560,1440],[3840,2160]]){
  await tv.setViewportSize({width,height});await tv.goto(base+'/tv/'+state.lobby.joinCode);await tv.waitForFunction(()=>document.querySelectorAll('.ball').length===90&&document.querySelector('#count').textContent==='16');
  const layout=await tv.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,overflow:[...document.querySelectorAll('.ball,.tv-header,.tv-foot,.tv-current,.tv-join,.tv-activity,.history-panel,.history-item,.playing-roster')].filter(el=>{const r=el.getBoundingClientRect();return r.bottom>innerHeight+.5||r.right>innerWidth+.5||r.top<0||r.left<0;}).map(el=>el.className)}));
  assert.equal(layout.scrollWidth,width,JSON.stringify(layout));assert.equal(layout.scrollHeight,height,JSON.stringify(layout));assert.deepEqual(layout.overflow,[],JSON.stringify(layout));
  assert.ok(await tv.locator('#playing-roster .roster-person').count()>=4); // Roster paginates to the measured available height.
  const roster=await tv.evaluate(()=>({clipped:[...document.querySelectorAll('#playing-roster .roster-person')].filter(person=>person.scrollHeight>person.clientHeight+1).map(person=>({name:person.textContent,height:person.clientHeight,content:person.scrollHeight})),container:document.querySelector('#playing-roster').clientHeight,scroll:document.querySelector('#playing-roster').scrollHeight}));
  assert.ok(roster.scroll<=roster.container+1,JSON.stringify({width,height,roster}));assert.deepEqual(roster.clipped,[],JSON.stringify({width,height,roster}));
  await tv.waitForFunction(()=>{const items=document.querySelectorAll('#history .history-item');return items.length>1&&items[1].getBoundingClientRect().top>items[0].getBoundingClientRect().top;});
  const history=await tv.evaluate(()=>{const items=[...document.querySelectorAll('#history .history-item')];return {vertical:items[1].getBoundingClientRect().top>items[0].getBoundingClientRect().top,sequenceFont:getComputedStyle(items[0].querySelector('.history-sequence')).fontFamily,numberFont:getComputedStyle(items[0].querySelector('.history-number')).fontFamily};});
  assert.equal(history.vertical,true,JSON.stringify({width,height,history}));assert.notEqual(history.sequenceFont,history.numberFont);
  if(width===3840){const large=await tv.evaluate(()=>({number:parseFloat(getComputedStyle(document.querySelector('.history-number')).fontSize),player:parseFloat(getComputedStyle(document.querySelector('.playing-roster .roster-person')).fontSize),qr:document.querySelector('#qr').getBoundingClientRect().width}));assert.ok(large.number>=55&&large.player>=38&&large.qr>=500,JSON.stringify(large));}
  if([960,1280,1920,3840].includes(width))await tv.screenshot({path:outputDir+'/tv-'+width+'.png'});
 }
 await host.setViewportSize({width:390,height:844});await host.reload();await host.waitForFunction(()=>document.querySelector('#name').textContent!=='Loading game…');assert.ok(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await host.screenshot({path:outputDir+'/admin-phone.png',fullPage:true});
 await host.setViewportSize({width:1440,height:900});await host.screenshot({path:outputDir+'/host-live-desktop.png'});
 for(const width of [320,390,768,1440]){
  await host.setViewportSize({width,height:844});await recovered.setViewportSize({width,height:844});
  for(const section of ['round','players','prizes','sharing','style','activity']){
   if(width<=760)await host.getByRole('combobox',{name:'Host section'}).selectOption(section);
   else await hostNav.locator('[data-view-link='+section+']').click();
   if(section==='style'&&width===320){
    await host.locator('#appearance-panel > summary').click();
    await host.locator('#commentary-panel > summary').click();
   }
   assert.equal(await host.locator('[data-view]:visible').count(),1);
   assert.ok(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px host '+section);
  }
  for(const section of ['ticket','calls','prizes']){
   await recovered.locator('#player-nav [data-view-link='+section+']').click();
   assert.equal(await recovered.locator('[data-view]:visible').count(),1);
   assert.ok(await recovered.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px guest '+section);
  }
 }
 assert.deepEqual(errors,[]); // The caller owns browser teardown (including all contexts).
}
