import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmployeeRunRecovery} from '../lib/employee-run-recovery.mjs';

const flowId='F'.repeat(21),runId='R'.repeat(21),projectId='P'.repeat(21);
function fixture(){
  const context={companyId:'company-1',requestId:'request-1',conversationId:'conversation-1',claimToken:'claim-1',employee:null,flowId,publishedVersion:'version-1',execution:{runId,flowId,projectId,flowVersionId:'version-1',environment:'PRODUCTION'}};
  let row={conversation_id:context.conversationId,status:'pending',response_json:{activity:[{id:1,name:'flow_mcp',state:'returned'}]}},run={id:runId,flowId,flowVersionId:'version-1',projectId,environment:'PRODUCTION',status:'SUCCEEDED',steps:[{output:{status:200,body:'verified reply'}}]},captureAllowed=true,writeAllowed=true,failWrite=false;
  const queries=[],calls=[],owned=[];
  const query=async(sql,values)=>{
    queries.push({sql,values});assert.doesNotMatch(sql,/siyadah_digital_employees/);
    if(sql.includes('SET execution_identity_json')){if(!captureAllowed||row.execution_identity_json&&JSON.stringify(row.execution_identity_json)!==values[4])return {rows:[]};row.execution_identity_json=JSON.parse(values[4]);return {rows:[{request_id:context.requestId}]};}
    if(sql.startsWith('SELECT '))return {rows:[row]};
    assert.ok(sql.startsWith('UPDATE siyadah_chat_requests SET status='));assert.deepEqual(values.slice(0,3),[context.companyId,context.requestId,context.conversationId]);assert.equal(values[4],JSON.stringify(row.execution_identity_json));assert.match(sql,/status IN \('pending','unknown','succeeded'\)/);
    if(failWrite)throw new Error('receipt write failed');if(!writeAllowed)return {rows:[]};row={...row,status:'succeeded',response_json:JSON.parse(values[3])};return {rows:[{created_at:'now'}]};
  };
  const recovery=createEmployeeRunRecovery({query,projects:{requireProject:async company=>{assert.equal(company,context.companyId);return projectId;},ownedFlow:async(...args)=>{owned.push(args);assert.deepEqual(args,[context.companyId,flowId,'version-1']);}},mcp:{call:async(company,method,params)=>{calls.push(params);assert.equal(company,context.companyId);assert.equal(method,'tools/call');assert.deepEqual(params,{name:'ap_get_run',arguments:{flowRunId:runId}});return {structuredContent:run};}}});
  return {context,recovery,queries,calls,owned,row:()=>row,setRow:patch=>{row={...row,...patch};},setRun:patch=>{run={...run,...patch};},denyCapture:()=>{captureAllowed=false;},denyWrite:()=>{writeAllowed=false;},failWrite:()=>{failWrite=true;}};
}

test('one-off identity and successful receipt survive reread without any employee write or dispatch',async()=>{
  const f=fixture(),identity=await f.recovery.capture(f.context);assert.deepEqual(identity,{runId,projectId,flowId,flowVersionId:'version-1',environment:'PRODUCTION'});
  const result=await f.recovery.reconcile(f.context);assert.equal(result.run_id,runId);assert.equal(result.flow_id,flowId);assert.equal(result.work_status,'succeeded');assert.match(result.reply,/verified reply/);assert.equal(Object.hasOwn(result,'result'),false);assert.deepEqual(result.activity,f.row().response_json.activity);
  assert.deepEqual(await f.recovery.reconcile(f.context),result);assert.equal(f.calls.length,1);assert.equal(f.owned.length,1);assert.ok(f.queries.every(({sql})=>!sql.includes('employee')));
});

test('one-off capture rejects missing trusted flow, mismatched identity and missing native claim persistence',async()=>{
  for(const patch of [{flowId:null},{publishedVersion:null},{execution:{runId,flowId:'X'.repeat(21),projectId,flowVersionId:'version-1',environment:'PRODUCTION'}},{publishedVersion:'other'},{execution:{runId,flowId,projectId:'X'.repeat(21),flowVersionId:'version-1',environment:'PRODUCTION'}},{execution:{runId,flowId,projectId,flowVersionId:'version-1',environment:'TESTING'}}]){
    const f=fixture();assert.equal(await f.recovery.capture({...f.context,...patch}),null);assert.equal(f.queries.length,0);
  }
  const f=fixture();f.denyCapture();await assert.rejects(f.recovery.capture(f.context),error=>error.code==='execution_identity_not_saved');
});

test('one-off recovery rejects wrong conversation, nonterminal and mismatched exact run identity',async()=>{
  const f=fixture();await f.recovery.capture(f.context);assert.equal(await f.recovery.reconcile({...f.context,conversationId:'foreign'}),null);assert.equal(f.calls.length,0);
  for(const patch of [{id:'X'.repeat(21)},{flowId:'X'.repeat(21)},{flowVersionId:'other'},{flowVersionId:undefined},{projectId:'X'.repeat(21)},{projectId:undefined},{environment:'TESTING'},...['RUNNING','FAILED','CANCELED','TIMED_OUT'].map(status=>({status})),{steps:[]}]){
    const g=fixture();await g.recovery.capture(g.context);g.setRun(patch);assert.equal(await g.recovery.reconcile(g.context),null);assert.equal(g.queries.filter(({sql})=>sql.startsWith('UPDATE siyadah_chat_requests SET status=')).length,0);
  }
});

test('one-off stale identity or failed receipt write cannot turn the request into success',async()=>{
  const f=fixture();await f.recovery.capture(f.context);f.denyWrite();assert.equal(await f.recovery.reconcile(f.context),null);assert.equal(f.row().status,'pending');
  const g=fixture();await g.recovery.capture(g.context);g.failWrite();await assert.rejects(g.recovery.reconcile(g.context),/receipt write failed/);assert.equal(g.row().status,'pending');assert.ok(g.calls.every(call=>call.name==='ap_get_run'));
});

test('one-off recovery keeps bounded reply and discards stale full output',async()=>{
  const f=fixture();await f.recovery.capture(f.context);f.setRow({status:'unknown',response_json:{result:'private stale blob'}});f.setRun({steps:[{output:{status:200,body:'x'.repeat(20000)}}]});const result=await f.recovery.reconcile(f.context);
  assert.equal(Object.hasOwn(result,'result'),false);assert.ok(result.reply.length<5100);assert.equal(Object.hasOwn(result,'employee'),false);
});

test('legacy employee capture and reconciliation retain their employee snapshot and atomic CTE',async()=>{
  let row,capturedIdentity;const writes=[];
  const context={companyId:'company-legacy',requestId:'r1',conversationId:'c1',claimToken:'claim',employee:{id:'employee-legacy',activepieces_flow_id:flowId,run_snapshot_updated_at:'2026-10-08T00:00:00Z',last_run_id:null},publishedVersion:'v1',execution:{runId,flowId,projectId,flowVersionId:'v1',environment:'PRODUCTION'}};
  const recovery=createEmployeeRunRecovery({query:async(sql,values)=>{
    if(sql.includes('SET execution_identity_json')){capturedIdentity=JSON.parse(values[4]);row={conversation_id:'c1',status:'pending',execution_identity_json:capturedIdentity};return {rows:[{request_id:'r1'}]};}
    if(sql.startsWith('SELECT '))return {rows:[row]};
    assert.ok(sql.startsWith('WITH receipt AS'));assert.match(sql,/UPDATE siyadah_digital_employees/);writes.push(values);return {rows:[{created_at:'now'}]};
  },projects:{requireProject:async()=>projectId,ownedFlow:async()=>({})},mcp:{call:async()=>({structuredContent:{id:runId,flowId,environment:'PRODUCTION',status:'SUCCEEDED',steps:[{output:{status:200}}]}})}});
  assert.deepEqual(await recovery.capture(context),{runId,projectId,flowId,flowVersionId:'v1',environment:'PRODUCTION',employeeId:'employee-legacy',employeeUpdatedAt:'2026-10-08T00:00:00Z',previousRunId:null});
  assert.equal((await recovery.reconcile(context)).run_id,runId);assert.equal(writes[0][7],'employee-legacy');assert.equal(writes[0][9],context.employee.run_snapshot_updated_at);assert.equal(writes[0][10],null);assert.equal(writes[0][6],JSON.stringify({status:200}));
});


test('employee recovery saves only bounded successful reply bodies for the saved result view',async()=>{
  for(const [output,expected] of [
    [{status:200,body:'نتيجة الموظف',headers:{authorization:'private'},extra:'private'},{status:200,body:'نتيجة الموظف'}],
    [{status:201,body:{items:[1,2]}},{status:201,body:'{"items":[1,2]}'}],
    [{status:200,body:'x'.repeat(12000)},{status:200,body:'x'.repeat(12000)}],
    [{status:200,body:'x'.repeat(12001)},{status:200}],
    [{status:200,body:'  '},{status:200}],
    [{status:500,body:'failure'},{status:500}],
    [{status:200,body:null},{status:200}],
    [{value:42},{status:null}],
  ]){
    const identity={runId,flowId,projectId,flowVersionId:'v1',employeeId:'employee-1',employeeUpdatedAt:'2026-10-08T00:00:00Z',previousRunId:null};let persisted;
    const recovery=createEmployeeRunRecovery({query:async(sql,values)=>{
      if(sql.startsWith('SELECT '))return {rows:[{conversation_id:'c1',status:'pending',execution_identity_json:identity}]};
      assert.ok(sql.startsWith('WITH receipt AS'));assert.deepEqual(values.slice(0,3),['company-1','r1','c1']);
      assert.match(sql,/e.updated_at=\$10::timestamptz/);persisted=JSON.parse(values[6]);return {rows:[{created_at:'now'}]};
    },projects:{requireProject:async()=>projectId,ownedFlow:async()=>({})},mcp:{call:async()=>({structuredContent:{id:runId,flowId,projectId,flowVersionId:'v1',environment:'PRODUCTION',status:'SUCCEEDED',steps:[{output}]}})}});
    const result=await recovery.reconcile({companyId:'company-1',requestId:'r1',conversationId:'c1'});
    assert.equal(result.run_id,runId);assert.deepEqual(persisted,expected);assert.equal(Object.hasOwn(result,'result'),false);
  }
});
