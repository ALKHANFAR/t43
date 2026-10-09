import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createCompanyEffectLock} from '../lib/company-effect-lock.mjs';
import {flowTestSnapshot} from '../lib/chat-outcome.mjs';

const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const createSource=source.slice(source.indexOf('async function createTenantFlow('),source.indexOf('async function provisionTenant('));

test('closed internal create route never initializes a provider',async()=>{
  for(const allowed of [true,false]){
    let calls=0;
    const handler=runInNewContext(`${createSource}; createTenantFlow`,{authorized:()=>allowed,json:(_res,status,body)=>({status,body}),tenantProjects:()=>{calls++;throw Error('provider forbidden');}});
    const result=await handler({},{});
    assert.equal(result.status,allowed?410:401);
    assert.equal(result.body.error,allowed?'native_mcp_creation_required':'unauthorized');
    assert.equal(calls,0);
  }
});

const stateSource=source.slice(source.indexOf('async function changeEmployeeState('),source.indexOf("    if(input.op==='employee_state')"));
function stateHarness({confirmed=true,foreign=false,transportError=false,isError=false,busy=false}={}){
  const calls=[],stateWrites=[],flowId='F'.repeat(21);let nativeCalled=false;
  class CompanyProfileError extends Error{constructor(code,message,status){super(message);this.code=code;this.status=status;}}
  const database=async()=>({connect:async()=>({query:async()=>({rows:[{locked:!busy,unlocked:true}]}),release(){}})});
  const handler=runInNewContext(`${stateSource}; changeEmployeeState`,{
    companyId:'company-a',CompanyProfileError,createCompanyEffectLock,console:{error:()=>{}},
    database,effectDatabase:database,
    companyProfiles:async()=>({clearEmployeeActivationIntent:async()=>{},setEmployeeState:async input=>{stateWrites.push(input);return input;}}),
    tenantProjects:async()=>({ownedFlow:async(company,id)=>{calls.push(['read',company,id]);if(foreign)throw Error('foreign flow');return {flow:{status:nativeCalled&&confirmed?'DISABLED':'ENABLED'}};}}),
    activepiecesMcp:async()=>({call:async(company,method,params)=>{nativeCalled=true;calls.push(['mcp',company,method,params]);if(transportError)throw Error('transport failure');return {isError};}}),
  });
  return {run:()=>handler({id:'employee-a',activepieces_flow_id:flowId},'disabled'),calls,stateWrites,flowId};
}
test('employee deactivation uses native MCP and owned readback before local state',async()=>{
  const h=stateHarness();await h.run();
  assert.deepEqual(h.calls.map(x=>x[0]),['read','mcp','read']);
  const [_,company,method,params]=h.calls[1];
  assert.equal(company,'company-a');assert.equal(method,'tools/call');
  assert.equal(params.name,'ap_change_flow_status');assert.equal(params.arguments.flowId,h.flowId);assert.equal(params.arguments.status,'DISABLED');
  assert.equal(h.stateWrites.length,1);
});
test('unconfirmed native status never saves local state or falls back to REST',async()=>{
  for(const options of [{confirmed:false},{confirmed:false,transportError:true},{confirmed:false,isError:true}]){
    const h=stateHarness(options);await assert.rejects(h.run,error=>error.code==='employee_not_ready');
    assert.equal(h.stateWrites.length,0);assert.equal(h.calls.filter(x=>x[0]==='mcp').length,1);
  }
});
test('foreign Flow is rejected before native status mutation',async()=>{
  const h=stateHarness({foreign:true});await assert.rejects(h.run,/foreign flow/);
  assert.deepEqual(h.calls.map(x=>x[0]),['read']);assert.equal(h.stateWrites.length,0);
});

test('company effect contention blocks manual employee state mutation before MCP',async()=>{
  const h=stateHarness({busy:true});await assert.rejects(h.run,{code:'company_effect_busy'});
  assert.deepEqual(h.calls,[]);assert.deepEqual(h.stateWrites,[]);
});

function activationHarness({published=false,changed=false,changedGraph=false}={}){
  const stateWrites=[],flowId='F'.repeat(21),version={id:'v1',state:published?'LOCKED':'DRAFT',connectionIds:[],trigger:{name:'trigger',settings:{input:{price:100}}}};
  let dispatched=false;
  class CompanyProfileError extends Error{constructor(code,message,status){super(message);this.code=code;this.status=status;}}
  const database=async()=>({connect:async()=>({query:async()=>({rows:[{locked:true,unlocked:true}]}),release(){}})});
  const handler=runInNewContext(`${stateSource}; changeEmployeeState`,{
    companyId:'company-a',CompanyProfileError,createCompanyEffectLock,flowTestSnapshot,console:{error:()=>{}},database,effectDatabase:database,
    companyProfiles:async()=>({clearEmployeeActivationIntent:async()=>{},setEmployeeState:async input=>{stateWrites.push(input);return input;}}),
    tenantProjects:async()=>({ownedFlow:async()=>({flow:{id:flowId,status:dispatched?'ENABLED':'DISABLED',publishedVersionId:dispatched?(changed?'v2':'v1'):published?'v1':null,version:{...version,id:dispatched&&changed?'v2':'v1',state:dispatched?'LOCKED':version.state,trigger:dispatched&&changedGraph?{name:'trigger',settings:{input:{price:999}}}:version.trigger}}})}),
    successfulFlowTest:async()=>true,
    activepiecesMcp:async()=>({call:async(_company,_method,{name})=>{if(['ap_lock_and_publish','ap_change_flow_status'].includes(name))dispatched=true;return {structuredContent:{valid:true}};}}),
  });
  return {run:()=>handler({id:'employee-a',activepieces_flow_id:flowId},'active'),stateWrites};
}
test('activation never records active when final publication differs from the tested version or graph',async()=>{
  for(const published of [false,true])for(const change of [{changed:true},{changedGraph:true}]){
    const h=activationHarness({published,...change});
    await assert.rejects(h.run,error=>error.code==='employee_test_required');assert.equal(h.stateWrites.length,0);
  }
});
test('activation accepts the exact tested published version including the native draft to locked transition',async()=>{
  for(const published of [false,true]){const h=activationHarness({published});await h.run();assert.equal(h.stateWrites.length,1);}
});
