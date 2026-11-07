import test from 'node:test';
import assert from 'node:assert/strict';
import { accessPolicy } from '../hosting/access-policy.js';
import { cloudOrigin, hostContext, validateHosting } from '../hosting/context.js';
import { assertAdmin } from './admin.js';

const id='755ea901-e874-4fb8-a6cf-a4ce2494dd34';
test('cloud access defaults private and distinguishes guests from read-only screens',()=>{
  assert.equal(accessPolicy('GET','/').kind,'public');
  assert.equal(accessPolicy('GET','/games/'+id+'/guest-display').kind,'public');
  assert.equal(accessPolicy('POST','/games/'+id+'/players/me/claims').kind,'public');
  assert.equal(accessPolicy('GET','/games/'+id+'/display').kind,'screen');
  assert.deepEqual(accessPolicy('POST','/games/'+id+'/admin/future-control'),{kind:'host',game:id});
  assert.equal(accessPolicy('GET','/future-sensitive-endpoint').kind,'host');
  assert.equal(accessPolicy('POST','/tv/ABC234').kind,'host');
  assert.equal(accessPolicy('GET','/games').kind,'host');
});

test('cloud startup rejects incomplete or insecure deployment configuration',()=>{
  const original={...process.env};
  try{
    process.env.HOSTING_MODE='cloud';process.env.PUBLIC_APP_ORIGIN='https://play.example.com';
    delete process.env.GOOGLE_CLIENT_ID;
    assert.throws(validateHosting,/GOOGLE_CLIENT_ID/);
    process.env.GOOGLE_CLIENT_ID='client';process.env.GOOGLE_CLIENT_SECRET='secret';process.env.HOST_ALLOWED_EMAILS='host@example.com';
    assert.doesNotThrow(validateHosting);
    for(const origin of ['http://play.example.com','https://play.example.com/path','https://user:pass@play.example.com','https://play.example.com/?x=1']){process.env.PUBLIC_APP_ORIGIN=origin;assert.throws(cloudOrigin);}
    process.env.PUBLIC_APP_ORIGIN='https://play.example.com';process.env.HOST_ALLOWED_EMAILS=', ,';assert.throws(validateHosting);
  }finally{for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);}
});

test('legacy admin token cannot substitute for a cloud host identity',()=>{
  const original={...process.env};
  try{
    process.env.HOSTING_MODE='cloud';process.env.ADMIN_TOKEN='known-legacy-token';
    assert.throws(()=>assertAdmin('known-legacy-token'));
    hostContext.run({id,email:'host@example.com',name:'Host'},()=>assert.doesNotThrow(()=>assertAdmin()));
    assert.throws(()=>assertAdmin()); // Request context never bleeds into the next caller.
  }finally{for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);}
});
