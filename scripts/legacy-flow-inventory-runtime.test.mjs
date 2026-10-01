import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryLegacyFlows} from '../lib/legacy-flow-inventory.mjs';

test('release inventory reports provider-only legacy flows without mutating employees',async()=>{
  const projects=[{tenant_id:'company_a',activepieces_project_id:'project_a'},{tenant_id:'company_b',activepieces_project_id:'project_b'}];
  const employees=[{company_id:'company_a',activepieces_flow_id:'flow_1'}],accounts=[{company_id:'company_a'}],profiles=[],calls=[];
  const result=await inventoryLegacyFlows({projects,employees,accounts,profiles,listFlows:async projectId=>{calls.push(projectId);return projectId==='project_a'?[{id:'flow_1',projectId},{id:'flow_2',projectId}]:[{id:'flow_3',projectId}];}});
  assert.deepEqual(calls,['project_a','project_b']);
  assert.deepEqual(result,{projects:2,customerProjects:1,orphanProjects:1,scannedFlows:3,orphanProjectFlows:1,unadopted:[{companyId:'company_a',flowId:'flow_2'}]});
  assert.equal(employees.length,1);
});

test('release inventory fails closed on incomplete or foreign project listings',async()=>{
  const projects=[{tenant_id:'company_a',activepieces_project_id:'project_a'}];
  await assert.rejects(()=>inventoryLegacyFlows({projects,employees:[],accounts:[],profiles:[],listFlows:async()=>Array.from({length:100},(_,i)=>({id:`flow_${i}`,projectId:'project_a'}))}),/inventory_incomplete/);
  await assert.rejects(()=>inventoryLegacyFlows({projects,employees:[],accounts:[],profiles:[],listFlows:async()=>[{id:'flow_1',projectId:'project_b'}]}),/project_mismatch/);
});

test('profile-owned projects remain in the employee gate even without an account',async()=>{
  const projects=[{tenant_id:'company_a',activepieces_project_id:'project_a'}],employees=[],accounts=[],profiles=[{company_id:'company_a',activepieces_project_id:'project_a'}];
  const result=await inventoryLegacyFlows({projects,employees,accounts,profiles,listFlows:async()=>[{id:'flow_1',projectId:'project_a'}]});
  assert.equal(result.unadopted.length,1);
  assert.equal(result.orphanProjectFlows,0);
});

test('ownership data and mismatched profile links fail closed',async()=>{
  const projects=[{tenant_id:'company_a',activepieces_project_id:'project_a'}],listFlows=async()=>[];
  await assert.rejects(()=>inventoryLegacyFlows({projects,employees:[],accounts:[],listFlows}),/ownership_incomplete/);
  await assert.rejects(()=>inventoryLegacyFlows({projects,employees:[],accounts:[],profiles:[{company_id:'company_b',activepieces_project_id:'project_a'}],listFlows}),/profile_mismatch/);
  await assert.rejects(()=>inventoryLegacyFlows({projects,employees:[],accounts:[],profiles:[{company_id:'company_a',activepieces_project_id:'project_b'}],listFlows}),/profile_mismatch/);
  await assert.rejects(()=>inventoryLegacyFlows({projects,employees:[{company_id:'company_a',activepieces_flow_id:'flow_1'}],accounts:[],profiles:[],listFlows:async()=>[{id:'flow_1',projectId:'project_a'}]}),/ownership_incomplete/);
});
