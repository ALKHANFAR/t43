import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryLegacyFlows} from '../lib/legacy-flow-inventory.mjs';

test('release inventory reports provider-only legacy flows without mutating employees',async()=>{
  const projects=[{tenant_id:'company_a',activepieces_project_id:'project_a',provision_status:'ready'},{tenant_id:'company_b',activepieces_project_id:'project_b',provision_status:'ready'}];
  const employees=[{company_id:'company_a',activepieces_flow_id:'flow_1'}],accounts=[{company_id:'company_a'}],profiles=[],calls=[];
  const result=await inventoryLegacyFlows({projects,employees,accounts,profiles,associatedCompanies:[],listFlows:async projectId=>{calls.push(projectId);return projectId==='project_a'?[{id:'flow_1',projectId},{id:'flow_2',projectId}]:[{id:'flow_3',projectId,status:'DISABLED'}];}});
  assert.deepEqual(calls,['project_a','project_b']);
  assert.deepEqual(result,{projects:2,customerProjects:1,orphanProjects:1,scannedFlows:3,orphanProjectFlows:1,unadopted:[{companyId:'company_a',flowId:'flow_2'}]});
  assert.equal(employees.length,1);
});

test('release inventory fails closed on incomplete or foreign project listings',async()=>{
  const projects=[{tenant_id:'company_a',activepieces_project_id:'project_a',provision_status:'ready'}];
  await assert.rejects(()=>inventoryLegacyFlows({projects,employees:[],accounts:[],profiles:[],associatedCompanies:[],listFlows:async()=>Array.from({length:100},(_,i)=>({id:`flow_${i}`,projectId:'project_a'}))}),/inventory_incomplete/);
  await assert.rejects(()=>inventoryLegacyFlows({projects,employees:[],accounts:[],profiles:[],associatedCompanies:[],listFlows:async()=>[{id:'flow_1',projectId:'project_b'}]}),/project_mismatch/);
});

test('profile-owned projects remain in the employee gate even without an account',async()=>{
  const projects=[{tenant_id:'company_a',activepieces_project_id:'project_a',provision_status:'ready'}],employees=[],accounts=[],profiles=[{company_id:'company_a',activepieces_project_id:'project_a'}];
  const result=await inventoryLegacyFlows({projects,employees,accounts,profiles,associatedCompanies:[],listFlows:async()=>[{id:'flow_1',projectId:'project_a'}]});
  assert.equal(result.unadopted.length,1);
  assert.equal(result.orphanProjectFlows,0);
});

test('ownership data and mismatched profile links fail closed',async()=>{
  const projects=[{tenant_id:'company_a',activepieces_project_id:'project_a',provision_status:'ready'}],listFlows=async()=>[];
  await assert.rejects(()=>inventoryLegacyFlows({projects,employees:[],accounts:[],listFlows}),/ownership_incomplete/);
  await assert.rejects(()=>inventoryLegacyFlows({projects,employees:[],accounts:[],profiles:[{company_id:'company_b',activepieces_project_id:'project_a'}],associatedCompanies:[],listFlows}),/profile_mismatch/);
  await assert.rejects(()=>inventoryLegacyFlows({projects,employees:[],accounts:[],profiles:[{company_id:'company_a',activepieces_project_id:'project_b'}],associatedCompanies:[],listFlows}),/profile_mismatch/);
  const employeeOwned=await inventoryLegacyFlows({projects,employees:[{company_id:'company_a',activepieces_flow_id:'flow_1'}],accounts:[],profiles:[],associatedCompanies:[],listFlows:async()=>[{id:'flow_1',projectId:'project_a',status:'DISABLED'}]});
  assert.equal(employeeOwned.customerProjects,1);
});

test('orphan project flows must be verifiably disabled',async()=>{
  const projects=[{tenant_id:'company_a',activepieces_project_id:'project_a',provision_status:'ready'}],base={projects,employees:[],accounts:[],profiles:[],associatedCompanies:[]};
  for(const status of ['ENABLED','active',undefined]){
    await assert.rejects(()=>inventoryLegacyFlows({...base,listFlows:async()=>[{id:'flow_1',projectId:'project_a',status}]}),/orphan_status_unverified/);
  }
  const result=await inventoryLegacyFlows({...base,listFlows:async()=>[{id:'flow_1',projectId:'project_a',status:'DISABLED'}]});
  assert.equal(result.orphanProjectFlows,1);
});

test('mapped nonready projects and ready projects without mapping fail closed',async()=>{
  const base={employees:[],accounts:[],profiles:[],associatedCompanies:[],listFlows:async()=>[]};
  await assert.rejects(()=>inventoryLegacyFlows({...base,projects:[{tenant_id:'company_a',activepieces_project_id:'project_a',provision_status:'pending'}]}),/project_not_ready/);
  await assert.rejects(()=>inventoryLegacyFlows({...base,projects:[{tenant_id:'company_a',activepieces_project_id:null,provision_status:'ready'}]}),/project_mapping_incomplete/);
});

test('any associated company data keeps an unmapped flow in the customer gate',async()=>{
  const projects=[{tenant_id:'company_a',activepieces_project_id:'project_a',provision_status:'ready'}];
  const result=await inventoryLegacyFlows({projects,employees:[],accounts:[],profiles:[],associatedCompanies:[{company_id:'company_a'}],listFlows:async()=>[{id:'flow_1',projectId:'project_a',status:'DISABLED'}]});
  assert.equal(result.customerProjects,1);
  assert.equal(result.orphanProjectFlows,0);
  assert.equal(result.unadopted.length,1);
});
