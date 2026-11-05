// Browser acceptance entry point. Call browserChecks with a Playwright Chromium browser
// and the disposable state returned by party-operations.mjs. Never use production games.
import assert from 'node:assert/strict';
export async function browserChecks({browser,base,key,state,outputDir}){
 const errors=[];
 const hostContext=await browser.newContext({viewport:{width:1440,height:1000}});
 const host=await hostContext.newPage();host.on('pageerror',e=>errors.push(e.message));
 await host.goto(base+'/admin');await host.locator('#key').fill(key);await host.locator('#load').click();
 await host.locator('.game-card').first().waitFor();assert.equal(await host.locator('.game-card').filter({hasText:state.game.name}).count(),0);
 await host.locator('#filter').selectOption('all');assert.equal(await host.locator('.game-card').filter({hasText:state.game.name}).count(),1);
 await host.locator('.game-card').filter({hasText:state.lobby.name}).getByRole('link',{name:'Open console'}).click();
 await host.locator('#game-code').filter({hasText:state.lobby.joinCode}).waitFor();
 await host.locator('#access-panel > summary').click();assert.equal(await host.locator('#tvUrl').getAttribute('href'),base+'/tv/'+state.lobby.joinCode);
 assert.ok((await host.locator('#tvQr').getAttribute('src')).endsWith('/tv-qr.svg'));
 await host.locator('#players-panel > summary').click();await host.waitForFunction(()=>!document.querySelector('#players-panel').open);
 await host.reload();assert.equal(await host.locator('#players-panel').getAttribute('open'),null);await host.locator('#players-panel > summary').click();
 const guestContext=await browser.newContext({viewport:{width:390,height:844}}),guest=await guestContext.newPage();guest.on('pageerror',e=>errors.push(e.message));
 await guest.goto(base+'/g/'+state.lobby.joinCode);await guest.locator('#name').fill('Festival Guest');await guest.locator('#register-button').click();
 await guest.locator('#ticket-section').waitFor({state:'visible'});assert.equal(await guest.locator('input[type=tel]').count(),0);
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
 await host.evaluate(()=>window.dispatchEvent(new Event('tambola:changed')));await host.waitForFunction(()=>document.querySelector('#players').textContent.includes('SUBMITTED'));
 const popupPromise=host.waitForEvent('popup');await host.locator('#print-all').click();const popup=await popupPromise;await popup.locator('section table').waitFor();
 assert.equal(await popup.locator('section').count(),1);const pdf=await popup.pdf({path:outputDir+'/ticket-4x6.pdf',preferCSSPageSize:true,printBackground:true});
 assert.match(pdf.toString('latin1'),/\/MediaBox\s*\[\s*0\s+0\s+432\s+288\s*\]/);assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1);
 assert.ok(await popup.evaluate(()=>[...document.querySelectorAll('section')].every(e=>e.scrollHeight<=e.clientHeight)));
 await popup.screenshot({path:outputDir+'/print-preview.png'});await popup.close();
 await host.screenshot({path:outputDir+'/admin-console.png',fullPage:true});
 await host.locator('#switch-game').selectOption(state.game.id);await host.waitForURL('**/admin/'+state.game.id);await host.waitForFunction(()=>document.querySelector('#status').textContent==='STOPPED');
 await host.locator('#switch-game').selectOption(state.lobby.id);await host.waitForURL('**/admin/'+state.lobby.id);
 await state.request('/games/'+state.lobby.id+'/start',{method:'POST',admin:true});
 for(const number of [4,9,14,21,26,31,38,45,49,54,61,66,72,77,81,88])await state.request('/games/'+state.lobby.id+'/calls/manual',{method:'POST',admin:true,body:{number}});
 const tv=await hostContext.newPage();tv.on('pageerror',e=>errors.push(e.message));
 for(const [width,height] of [[960,540],[1280,720],[1920,1080],[3840,2160]]){
  await tv.setViewportSize({width,height});await tv.goto(base+'/tv/'+state.lobby.joinCode);await tv.waitForFunction(()=>document.querySelectorAll('.ball').length===90&&document.querySelector('#count').textContent==='16');
  const layout=await tv.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,overflow:[...document.querySelectorAll('.ball,.tv-header,.tv-foot,.tv-current,.tv-join,.tv-activity')].filter(el=>{const r=el.getBoundingClientRect();return r.bottom>innerHeight+.5||r.right>innerWidth+.5||r.top<0||r.left<0;}).map(el=>el.className)}));
  assert.equal(layout.scrollWidth,width,JSON.stringify(layout));assert.equal(layout.scrollHeight,height,JSON.stringify(layout));assert.deepEqual(layout.overflow,[],JSON.stringify(layout));
  if(width===1920||width===1280)await tv.screenshot({path:outputDir+'/tv-'+width+'.png'});
 }
 await host.setViewportSize({width:390,height:844});await host.reload();await host.waitForFunction(()=>document.querySelector('#name').textContent!=='Loading game…');assert.ok(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await host.screenshot({path:outputDir+'/admin-phone.png',fullPage:true});
 assert.deepEqual(errors,[]); // The caller owns browser teardown (including all contexts).
}
