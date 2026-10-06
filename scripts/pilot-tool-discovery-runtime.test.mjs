import test from 'node:test';
import assert from 'node:assert/strict';
import {createPilotToolDiscovery} from '../lib/pilot-tool-discovery.mjs';

test('legacy inventory cannot fall back to REST discovery even with provider credentials',async()=>{
  let fetchCalls=0,scopedTenant;
  const service=createPilotToolDiscovery({requireProject:async tenant=>{scopedTenant=tenant;return 'P'.repeat(21);},activepiecesUrl:'https://ap.example',apiKey:'configured',fetchImpl:async()=>{fetchCalls++;throw Error('REST must not be called');}});
  await assert.rejects(()=>service.inspect('company-a'),error=>error.code==='native_mcp_discovery_required'&&error.status===409);
  assert.equal(scopedTenant,'company-a');assert.equal(fetchCalls,0);
});

test('legacy discovery preserves the company-project gate before declaring an unavailable inventory',async()=>{
  const service=createPilotToolDiscovery({requireProject:async()=>{throw Error('company project missing');}});
  await assert.rejects(()=>service.inspect('company-a'),/company project missing/);
});
