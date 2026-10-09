import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverMcpCatalog} from '../lib/activepieces-mcp.mjs';
test('native catalog initializes first, reads every page and binds every call to the same company',async()=>{
 const calls=[];const mcp={call:async(company,method,params)=>{calls.push({company,method,params});if(method==='initialize')return {instructions:'native'};return params.cursor?{tools:[{name:'second',inputSchema:{type:'object'}}]}:{tools:[{name:'first'}],nextCursor:'page2'};}};
 const result=await discoverMcpCatalog(mcp,'company-a');
 assert.deepEqual(calls.map(x=>x.method),['initialize','tools/list','tools/list']);assert.ok(calls.every(x=>x.company==='company-a'));
 assert.equal(result.receipt.toolCount,2);assert.deepEqual(result.receipt.toolNames,['first','second']);assert.match(result.receipt.catalogSha256,/^[a-f0-9]{64}$/);assert.equal(result.instructions,'native');
});
test('incomplete, duplicate or cyclic catalogs never produce a verified receipt',async()=>{
 for(const page of [{},{tools:[{name:'same'},{name:'same'}]},{tools:[],nextCursor:'repeat'}]){
  await assert.rejects(()=>discoverMcpCatalog({call:async(_company,method)=>method==='initialize'?{}:page},'company-a'),{code:'mcp_catalog_invalid'});
 }
});
test('native catalog cannot replace authorization failure with an empty successful catalog',async()=>{
 await assert.rejects(()=>discoverMcpCatalog({call:async()=>{throw Object.assign(new Error('denied'),{code:'mcp_not_connected'});}},'company-a'),{code:'mcp_not_connected'});
});
