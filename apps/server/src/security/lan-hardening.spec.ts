import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { adminRateLimit } from './lan-hardening.js';

test('limits bad admin credentials across protected and header-bearing routes', () => {
  const original=process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN='unit-test-host-token';
  try {
    const invoke=(path:string,method:string,key?:string) => {
      let proceeded=false,body='';
      const request={url:path,method,headers:key===undefined?{}:{'x-admin-key':key},socket:{remoteAddress:'203.0.113.25'}} as unknown as IncomingMessage;
      const response={statusCode:200,setHeader:()=>undefined,end:(value:string)=>{body=value;}} as unknown as ServerResponse;
      adminRateLimit(request,response,()=>{proceeded=true;});
      return {proceeded,status:response.statusCode,body};
    };
    const paths=['/games','/games/id/start','/games/id/pause','/games/id/resume','/games/id/calls/manual','/games/id/tickets','/games/id/admin/stop','/games/id/display'];
    for(let index=0;index<120;index++)assert.equal(invoke(paths[index%paths.length],'POST','wrong').proceeded,true);
    for(const path of paths)assert.equal(invoke(path,'POST','wrong').status,429);
    assert.equal(invoke('/games/id/pause','POST').status,429);
    assert.equal(invoke('/games/id/pause','POST','unit-test-host-token').proceeded,true);
    assert.equal(invoke('/games/id/display','GET').proceeded,true);
  } finally {
    if(original===undefined)delete process.env.ADMIN_TOKEN;else process.env.ADMIN_TOKEN=original;
  }
});
