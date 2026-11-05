// Run inside the API container:
// docker compose -f compose.yaml -f compose.public.yaml exec -T api node --input-type=module - < tests/public-gateway-smoke.mjs
import { randomUUID, randomInt } from 'node:crypto';

const edge = 'http://guest-gateway:8080';
const app = 'http://127.0.0.1:3000';

async function request(base, path, {method='GET', body, headers={}}={}) {
  const response = await fetch(base+path, {
    method, redirect:'manual', headers:{...(body?{'content-type':'application/json'}:{}), ...headers},
    body:body?JSON.stringify(body):undefined,
  });
  const raw = await response.text();
  return {response, raw, data:(()=>{try{return JSON.parse(raw)}catch{return null}})()};
}
function expectStatus(label, result, expected) {
  if (!expected.includes(result.response.status)) {
    throw new Error(label+': expected '+expected.join('/')+' but got '+result.response.status+' '+result.raw.slice(0,180));
  }
  console.log('PASS',label,'HTTP',result.response.status);
}
if (!process.env.ADMIN_TOKEN) throw new Error('ADMIN_TOKEN is not present inside the API container');
const created = await request(app,'/games',{
  method:'POST', headers:{'x-admin-key':process.env.ADMIN_TOKEN},
  body:{name:'EDGE-SMOKE-'+randomUUID().slice(0,8),intervalSeconds:300},
});
expectStatus('Create isolated game via private API',created,[201,200]);
const id=created.data?.id,code=created.data?.joinCode;
if (!/^[0-9a-f-]{36}$/i.test(id??'') || !/^[A-HJ-NP-Z2-9]{6}$/.test(code??'')) {
  throw new Error('Expected UUID + six-character code from private API');
}
expectStatus('Guest short URL',await request(edge,'/g/'+code),[302]);
expectStatus('Guest registration page',await request(edge,'/join/'+id),[200]);
expectStatus('Guest live script',await request(edge,'/live/client.js'),[200]);
expectStatus('Socket.IO client bundle',await request(edge,'/socket.io/socket.io.js'),[200]);
const display = await request(edge,'/games/'+id+'/guest-display');
expectStatus('Guest-safe game state',display,[200]);
if (!display.data || !Array.isArray(display.data.calls) || !Array.isArray(display.data.categories)) {
  throw new Error('Guest display missing expected fields');
}
for (const key of ['players','winners','powerCalls','suddenDeath','mobile']) {
  if (Object.hasOwn(display.data,key) || display.raw.includes('"mobile"')) throw new Error('Guest response leaked '+key);
}
console.log('PASS Guest response excludes player roster and identifying winners');
const blocked = [
  ['admin page','/admin'],
  ['admin game page','/admin/'+id],
  ['full private display','/games/'+id+'/display'],
  ['admin players','/games/'+id+'/admin/players'],
  ['admin tickets','/games/'+id+'/admin/players/'+randomUUID()+'/ticket'],
  ['private TV','/tv/'+id],
  ['arbitrary number calls','/games/'+id+'/calls'],
  ['game metadata','/games/'+id],
  ['source client','/party/client.js'],
];
for (const [name,path] of blocked) expectStatus('Blocked '+name,await request(edge,path),[403,404]);
expectStatus('Blocked game creation',await request(edge,'/games',{method:'POST',body:{name:'blocked'}}),[403,404]);
expectStatus('Blocked manual call',await request(edge,'/games/'+id+'/calls/manual',{method:'POST',body:{number:47}}),[403,404]);
const mobile='1555'+String(randomInt(1000000,10000000)).padStart(7,'0');
const registration = await request(edge,'/games/'+id+'/players/register',{
  method:'POST',body:{name:'Public Smoke Test',mobile,deviceId:randomUUID()},
});
expectStatus('Guest registration through edge',registration,[200,201]);
if (!registration.data?.token) throw new Error('Guest registration did not return a player token');
expectStatus('Token-authenticated player recovery',await request(edge,'/games/'+id+'/players/me',{
  headers:{authorization:'Bearer '+registration.data.token},
}),[200]);
expectStatus('Unauthenticated player recovery rejected',await request(edge,'/games/'+id+'/players/me'),[401]);
console.log('PASS — guest-only gateway and token authorization, game',code);
