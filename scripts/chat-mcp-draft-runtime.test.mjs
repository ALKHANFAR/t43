import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../lib/chat-flow-lifecycle.mjs',import.meta.url),'utf8');
const start=source.indexOf('async function buildOwnedDraftFlow(');
const end=source.indexOf('  return {buildOwnedDraftFlow,successfulFlowTest};',start);
assert.ok(start>0&&end>start);
const helper=source.slice(start,end);
const id='012345678901234567890';

function setup({status='DISABLED',owner=true,existingFlow=null}={}){
  const calls=[];
  const employee={id:'employee-1',status:'draft',activepieces_flow_id:existingFlow};
  const ctx={
    console,
    CompanyProfileError:class extends Error{constructor(code,message){super(message);this.code=code;}},
    TenantProjectError:class extends Error{constructor(code,message){super(message);this.code=code;}},
    builtFlowResult:()=>({flowId:id,incomplete:false}),
    database:async()=>({connect:async()=>({query:async sql=>({rows:[{locked:true}]}),release:()=>calls.push('release')})}),
    companyProfiles:async()=>({findEmployee:async()=>employee,linkEmployeeFlow:async()=>{calls.push('link');return {name:'نور',flowId:id};}}),
    tenantProjects:async()=>({ownedFlow:async()=>{calls.push('readback');if(!owner)throw new Error('foreign project');return {flow:{status}};}}),
  };
  return {run:runInNewContext(`${helper}; buildOwnedDraftFlow`,ctx),calls};
}

test('main chat builds a disabled Flow in the company project and links its saved employee',async()=>{
  const {run,calls}=setup();
  const result=await run({companyId:'company-1',args:{flowName:'نور'},draftEmployee:{id:'employee-1'},onEffectStart:()=>calls.push('effect'),mcp:{call:async()=>{calls.push('build');return {structuredContent:{flowId:id}};}}});
  assert.equal(result.built.flowId,id);
  assert.equal(result.updated.flowId,id);
  assert.deepEqual(calls.filter(x=>['effect','build','readback','link'].includes(x)),['effect','build','readback','link']);
  assert.ok(calls.includes('release'));
});

test('main chat cannot confirm or link a Flow outside its project',async()=>{
  const {run,calls}=setup({owner:false});
  await assert.rejects(run({companyId:'company-1',args:{},draftEmployee:{id:'employee-1'},onEffectStart:()=>{},mcp:{call:async()=>({structuredContent:{flowId:id}})}}),/foreign project/);
  assert.ok(!calls.includes('link'));
  assert.ok(calls.includes('release'));
});

test('main chat does not build twice for a linked employee or confirm an enabled Flow',async()=>{
  const linked=setup({existingFlow:id});let dispatched=false;
  await assert.rejects(linked.run({companyId:'company-1',args:{},draftEmployee:{id:'employee-1'},onEffectStart:()=>{},mcp:{call:async()=>{dispatched=true;}}}),/طريقة عمل هذا الموظف مجهزة بالفعل/);
  assert.equal(dispatched,false);
  const enabled=setup({status:'ENABLED'});
  await assert.rejects(enabled.run({companyId:'company-1',args:{},onEffectStart:()=>{},mcp:{call:async()=>({structuredContent:{flowId:id}})}}),/طريقة العمل لم تُحفظ كمسودة متوقفة/);
  assert.ok(!enabled.calls.includes('link'));
});
