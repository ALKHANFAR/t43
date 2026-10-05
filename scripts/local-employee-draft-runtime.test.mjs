import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyProfileService,CompanyProfileError} from '../lib/company-profile.mjs';

function draftFixture(){
  const rows=[],calls=[];
  const profiles={
    company_alpha:{company_id:'company_alpha',knowledge_version:2,profile_json:{facts:[]},suggestions_json:[{id:'marketing-choice',roleKey:'marketing',name:'ريم',title:'التسويق',goal:'المحتوى',knowledgeTopics:['brand']}]},
    company_beta:{company_id:'company_beta',knowledge_version:1,profile_json:{facts:[]},suggestions_json:[{id:'marketing',roleKey:'marketing',name:'ريم',title:'التسويق',goal:'المحتوى',knowledgeTopics:['brand']}]},
  };
  const query=async(sql,values=[])=>{
    calls.push({sql,values});
    if(sql.startsWith('CREATE ')||sql.startsWith('ALTER ')||sql.startsWith('--'))return {rows:[]};
    if(sql.startsWith('SELECT * FROM siyadah_company_profiles'))return {rows:profiles[values[0]]?[profiles[values[0]]]:[]};
    if(sql.startsWith('SELECT id,creation_payload_key FROM siyadah_digital_employees'))return {rows:rows.filter(row=>row.company_id===values[0]&&row.creation_request_id===values[1]).map(row=>({id:row.id,creation_payload_key:row.creation_payload_key}))};
    if(sql.startsWith('SELECT id,activepieces_flow_id'))return {rows:rows.filter(row=>row.company_id===values[0])};
    if(sql.startsWith('SELECT id,company_id,activepieces_flow_id'))return {rows:rows.filter(row=>row.company_id===values[0]&&row.id===values[1])};
    if(sql.startsWith('UPDATE siyadah_digital_employees')&&sql.includes('activepieces_flow_id')){
      const [companyId,employeeId,flowId]=values;
      const row=rows.find(item=>item.company_id===companyId&&item.id===employeeId);
      if(!row||row.activepieces_flow_id&&row.activepieces_flow_id!==flowId)return {rows:[]};
      if(rows.some(item=>item!==row&&item.activepieces_flow_id===flowId)){
        const error=new Error('duplicate flow');error.code='23505';throw error;
      }
      row.activepieces_flow_id=flowId;
      return {rows:[{id:row.id}]};
    }
    if(sql.startsWith('INSERT INTO siyadah_digital_employees')){
      const [id,company_id,creation_request_id,creation_payload_key]=values;
      if(rows.some(row=>row.company_id===company_id&&row.creation_request_id===creation_request_id))return {rows:[]};
      const manual=sql.includes("'manual'");
      rows.push({id,company_id,creation_request_id,creation_payload_key,activepieces_flow_id:null,role_key:manual?'manual':values[4],name:manual?values[4]:values[5],role_title:manual?'موظف':values[6],prompt:manual?values[5]:values[7],prompt_source:manual?'manual_setup':'company_profile',prompt_version:1,knowledge_topics_json:manual?[]:JSON.parse(values[8]),knowledge_version:manual?values[6]:values[9],status:'draft',tools_json:[]});
      return {rows:[]};
    }
    throw new Error(`unexpected query: ${sql}`);
  };
  return {service:createCompanyProfileService({query}),rows,calls};
}

test('employee draft is saved once inside its company without an Activepieces flow',async()=>{
  const h=draftFixture(),input={companyId:'company_alpha',suggestionId:'marketing-choice',requestId:'select_1'};
  const first=await h.service.createEmployeeDraft(input),replay=await h.service.createEmployeeDraft(input);
  assert.equal(first.recordId,replay.recordId);
  assert.equal(first.flowId,null);
  assert.equal(first.status,'disabled');
  assert.equal(h.rows.length,1);
  assert.equal(h.calls.some(call=>call.sql.includes('/api/v1')||call.sql.includes('activepieces_project_id=')),false);
  await assert.rejects(()=>h.service.createEmployeeDraft({...input,suggestionId:'x'.repeat(101),requestId:'select_2'}),error=>error instanceof CompanyProfileError&&error.code==='invalid_suggestion');
  await assert.rejects(()=>h.service.createEmployeeDraft({...input,suggestionId:'sales_leads'}),error=>error instanceof CompanyProfileError&&error.code==='request_scope_mismatch');
  const other=await h.service.createEmployeeDraft({...input,companyId:'company_beta',suggestionId:'marketing'});
  assert.notEqual(first.recordId,other.recordId);
  assert.equal(h.rows.length,2);
});

test('manual chat draft is saved locally and replays under its company and request',async()=>{
  const h=draftFixture(),input={companyId:'company_alpha',name:'موظف متابعة',requestId:'chat_1'};
  const first=await h.service.createManualEmployeeDraft(input),replay=await h.service.createManualEmployeeDraft(input);
  assert.equal(first.recordId,replay.recordId);
  assert.equal(first.flowId,null);
  assert.equal(first.status,'disabled');
  assert.equal(h.rows.length,1);
  assert.equal(h.rows[0].prompt_source,'manual_setup');
  await assert.rejects(()=>h.service.createManualEmployeeDraft({...input,name:'موظف آخر'}),error=>error instanceof CompanyProfileError&&error.code==='request_scope_mismatch');
  await assert.rejects(()=>h.service.createManualEmployeeDraft({...input,requestId:'bad id'}),error=>error instanceof CompanyProfileError&&error.code==='invalid_request');
});

test('linking a flow preserves the original employee and request replay',async()=>{
  const h=draftFixture(),input={companyId:'company_alpha',name:'موظف متابعة',requestId:'chat_link_1'};
  const draft=await h.service.createManualEmployeeDraft(input),flowId='F12345678901234567890';
  const linked=await h.service.linkEmployeeFlow({companyId:input.companyId,employeeId:draft.recordId,flowId});
  const replay=await h.service.linkEmployeeFlow({companyId:input.companyId,employeeId:draft.recordId,flowId});
  const draftReplay=await h.service.createManualEmployeeDraft(input);
  assert.equal(linked.recordId,draft.recordId);
  assert.equal(linked.flowId,flowId);
  assert.equal(replay.recordId,draft.recordId);
  assert.equal(draftReplay.recordId,draft.recordId);
  assert.equal(draftReplay.flowId,flowId);
  assert.equal(h.rows.length,1);
  assert.equal(h.rows[0].status,'draft');
  assert.equal(h.calls.filter(call=>call.sql.startsWith('INSERT INTO siyadah_digital_employees')).length,1);
});

test('flow linking rejects another tenant, another flow, and a duplicate flow owner',async()=>{
  const h=draftFixture();
  const first=await h.service.createManualEmployeeDraft({companyId:'company_alpha',name:'ألف',requestId:'chat_link_2'});
  const second=await h.service.createManualEmployeeDraft({companyId:'company_alpha',name:'ثان',requestId:'chat_link_3'});
  const foreign=await h.service.createManualEmployeeDraft({companyId:'company_beta',name:'باء',requestId:'chat_link_4'});
  const flowId='F12345678901234567890',otherFlowId='G12345678901234567890';
  await h.service.linkEmployeeFlow({companyId:'company_alpha',employeeId:first.recordId,flowId});
  await assert.rejects(()=>h.service.linkEmployeeFlow({companyId:'company_beta',employeeId:first.recordId,flowId:otherFlowId}),error=>error instanceof CompanyProfileError&&error.code==='employee_not_found');
  await assert.rejects(()=>h.service.linkEmployeeFlow({companyId:'company_alpha',employeeId:first.recordId,flowId:otherFlowId}),error=>error instanceof CompanyProfileError&&error.code==='employee_flow_conflict');
  await assert.rejects(()=>h.service.linkEmployeeFlow({companyId:'company_alpha',employeeId:second.recordId,flowId}),error=>error instanceof CompanyProfileError&&error.code==='employee_flow_conflict');
  await assert.rejects(()=>h.service.linkEmployeeFlow({companyId:'company_beta',employeeId:foreign.recordId,flowId}),error=>error instanceof CompanyProfileError&&error.code==='employee_flow_conflict');
  assert.equal(h.rows.find(row=>row.id===first.recordId).activepieces_flow_id,flowId);
  assert.equal(h.rows.find(row=>row.id===second.recordId).activepieces_flow_id,null);
  assert.equal(h.rows.find(row=>row.id===foreign.recordId).activepieces_flow_id,null);
});

test('migration is additive and retains existing employee flow references',async()=>{
  const h=draftFixture();await h.service.init();
  const migration=h.calls.find(call=>call.sql.includes('ALTER COLUMN activepieces_flow_id DROP NOT NULL'))?.sql;
  assert.ok(migration);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS creation_request_id/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS creation_payload_key/);
  assert.match(migration,/UNIQUE INDEX IF NOT EXISTS siyadah_employees_creation_request_idx/);
  assert.doesNotMatch(migration,/DROP TABLE|DROP COLUMN|UPDATE siyadah_digital_employees/);
});
