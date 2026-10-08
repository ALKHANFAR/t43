import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCompanyProfileService} from '../lib/company-profile.mjs';
import {draftOnlyIntent} from '../lib/chat-intelligence.mjs';

const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');

test('only a new linked disabled Flow records a durable activation intent',()=>{
  assert.match(server,/!draftOnly&&answer\.flowId&&answer\.employee\?\.flowId===answer\.flowId&&answer\.employee\.status==='disabled'/);
  assert.match(server,/draftOnlyIntent\(input\.message\)/);
  assert.match(server,/auto_activate_after_connection:true,auto_activate_employee_id:answer\.employee\.recordId,auto_activate_flow_id:answer\.flowId/);
  assert.equal((server.match(/\.\.\.activationIntent/g)||[]).length,2);
});

test('a request to leave the Flow unpublished and disabled cannot queue activation',()=>{
  for(const message of ['أنشئ مسودة. اتركه DRAFT وDISABLED. لا تنشر أو تفعّل أو تشغّل.','ابنِ Flow ولا تنشره','أنشئ Flow بدون نشر','Create a flow, do not publish it','جهز طريقة العمل بدون تنفيذ','Prepare without executing'])assert.equal(draftOnlyIntent(message),true);
  assert.equal(draftOnlyIntent('أنشئ موظفًا واختبره ثم فعّله عند الجاهزية'),false);
});

test('resume selects at most two exact company employee and Flow matches and clears only that intent',async()=>{
  const calls=[];
  const service=createCompanyProfileService({query:async(sql,args)=>{
    calls.push({sql,args});
    return {rows:sql.includes('GROUP BY e.id')?[{employee_id:'employee-1',flow_id:'F'.repeat(21)}]:[]};
  }});
  const pending=await service.pendingEmployeeActivation('company-1');
  assert.deepEqual(pending,[{employee_id:'employee-1',flow_id:'F'.repeat(21)}]);
  assert.deepEqual(calls[0].args,['company-1',null]);
  assert.match(calls[0].sql,/e\.company_id=r\.company_id/);
  assert.match(calls[0].sql,/\$2::text IS NULL OR e\.id::text=\$2/);
  assert.match(calls[0].sql,/e\.id::text=r\.response_json->>'auto_activate_employee_id'/);
  assert.match(calls[0].sql,/e\.activepieces_flow_id=r\.response_json->>'auto_activate_flow_id'/);
  assert.match(calls[0].sql,/e\.status<>'active'/);
  assert.match(calls[0].sql,/LIMIT 2/);
  await service.pendingEmployeeActivation('company-1','employee-1');
  assert.deepEqual(calls[1].args,['company-1','employee-1']);
  await service.clearEmployeeActivationIntent({companyId:'company-1',employeeId:'employee-1',flowId:'F'.repeat(21)});
  assert.deepEqual(calls[2].args,['company-1','employee-1','F'.repeat(21)]);
  assert.match(calls[2].sql,/response_json=jsonb_set/);
});

test('manual activation and connection resume share one tested activation path',()=>{
  const helper=server.indexOf('async function changeEmployeeState(');
  const manual=server.indexOf("if(input.op==='employee_state')",helper);
  const resume=server.indexOf("if(input.op==='resume_employee_activation')",manual);
  const next=server.indexOf("if(input.op==='employee_instructions')",resume);
  assert.ok(helper>=0&&manual>helper&&resume>manual&&next>resume);
  assert.match(server.slice(helper,manual),/name:'ap_test_flow'/);
  assert.match(server.slice(helper,manual),/successfulFlowTest\(mcp,companyId,saved\.activepieces_flow_id,test,flow\.version\.id\)/);
  assert.match(server.slice(manual,resume),/changeEmployeeState\(saved,status\)/);
  assert.match(server.slice(resume,next),/pending\.length!==1/);
  assert.match(server.slice(resume,next),/pendingEmployeeActivation\(companyId,typeof input\.employee_id==='string'\?input\.employee_id:null\)/);
  assert.match(server.slice(resume,next),/changeEmployeeState\(saved,'active'\)/);
  assert.match(server.slice(resume,next),/activation_status:'pending',employee_id:target\.employee_id,message:error\.message/);
});

test('explicit employee disable consumes auto activation intent so hydrate cannot restart it',()=>{
  const helper=server.slice(server.indexOf('async function changeEmployeeState('),server.indexOf("if(input.op==='employee_state')"));
  assert.match(helper,/name:'ap_change_flow_status',arguments:\{flowId:saved\.activepieces_flow_id,status:desired\}/);
  assert.match(helper,/if\(status==='disabled'\)await profiles\.clearEmployeeActivationIntent/);
  assert.ok(helper.indexOf("if(status==='disabled')await profiles.clearEmployeeActivationIntent")<helper.indexOf("name:'ap_change_flow_status'"));
  assert.match(helper,/const updated=await profiles\.setEmployeeState\(\{companyId,employeeId:saved\.id,status\}\);\s*if\(status==='active'\)await profiles\.clearEmployeeActivationIntent/);
});
