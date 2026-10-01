import test from 'node:test';
import assert from 'node:assert/strict';
import {toolIcon} from '../lib/tool-icons.mjs';

test('customer icon route fetches only catalogued images and returns a bounded image',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});
    return {ok:true,headers:new Headers({'content-type':'image/png','content-length':'3'}),arrayBuffer:async()=>Uint8Array.of(1,2,3).buffer};
  };
  const icon=await toolIcon('gmail',{fetchImpl});
  assert.equal(icon.status,200);
  assert.equal(icon.type,'image/png');
  assert.deepEqual([...icon.bytes],[1,2,3]);
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/^https:\/\/cdn\.activepieces\.com\//);
  assert.equal(calls[0].options.redirect,'error');
  assert.equal((await toolIcon('../gmail',{fetchImpl})).status,404);
  assert.equal((await toolIcon('unknown-vendor',{fetchImpl})).status,404);
  assert.equal(calls.length,1);
});

test('icon route rejects provider errors and unexpected response types',async()=>{
  const result=await toolIcon('gmail',{fetchImpl:async()=>({ok:true,headers:new Headers({'content-type':'text/html'}),arrayBuffer:async()=>new ArrayBuffer(2)})});
  assert.equal(result.status,502);
});
