import test from 'node:test';
import assert from 'node:assert/strict';
import {completedWithoutExecution,failedChatExecution,nativeActionReceipt,completedToolActions,chatExecutionBudget} from '../lib/chat-outcome.mjs';

const native=(output,note='')=>({content:[{type:'text',text:`✅ Gmail completed (run R12345678901234567890)${note}.\n\n${JSON.stringify(output)}`}]});
test('native ActionRun completion is distinct from provider or FlowRun proof',()=>{
  const receipt=nativeActionReceipt('ap_run_action',native({messages:[{subject:'private subject'}]}));
  assert.deepEqual(receipt,{name:'ap_run_action',status:'returned',run_id:'R12345678901234567890',outcome:'action_completed'});
  assert.equal(JSON.stringify(receipt).includes('private'),false);
  const result=completedToolActions({effects:['ap_run_action'],toolReceipts:[{...receipt,effect_attempted:true}]});
  assert.deepEqual(result,{request_status:'succeeded',work_status:'succeeded',outcome_kind:'tool_result'});
  assert.equal(result.runId,undefined);
});
test('engine success cannot mask HTTP, provider, empty, malformed or transport errors',()=>{
  for(const result of [native({response:{status:403,body:{error:'permission'}}}),native({ok:true},' (HTTP 429)'),native({success:false}),native({error:{message:'expired'}}),native(null),native(false),{isError:true,...native({ok:true})},{content:[{type:'text',text:'✅ Gmail completed (run R12345678901234567890).\n\nnot-json'}]}]){
    assert.notEqual(nativeActionReceipt('ap_run_action',result).outcome,'action_completed');
  }
  assert.equal(nativeActionReceipt('ap_test_flow',native({ok:true})).run_id,undefined);
  assert.equal(nativeActionReceipt('ap_run_action',{isError:true}).status,'error');
});
test('a completed action never covers a missing or uncertain dispatch or a different write',()=>{
  const receipt={...nativeActionReceipt('ap_run_action',native({ok:true})),effect_attempted:true};
  for(const answer of [
    {effects:['ap_run_action','ap_run_action'],toolReceipts:[receipt]},
    {effects:['ap_run_action','ap_run_action'],toolReceipts:[receipt,{name:'ap_run_action',status:'error',effect_attempted:true}]},
    {effects:['ap_run_action','ap_build_flow'],toolReceipts:[receipt]},
    {effects:[],toolReceipts:[receipt]},
  ])assert.equal(completedToolActions(answer).work_status,'unknown');
});

test('ordinary replies complete the request without claiming an external run',()=>{
  const reply=completedWithoutExecution('conversation_reply',{ok:true,conversation_id:'chat_1',reply:'وصل جواب السؤال.',experience:{external_execution:false}});
  assert.equal(reply.request_status,'succeeded');
  assert.equal(reply.outcome_kind,'conversation_reply');
  assert.equal(reply.work_status,'not_started');
  assert.equal(reply.reply,'وصل جواب السؤال.');
  assert.equal(reply.runId,undefined);
  assert.equal(reply.recent_work,undefined);
});

test('saving a disabled employee draft does not imply tool execution',()=>{
  const draft=completedWithoutExecution('employee_draft',{ok:true,conversation_id:'chat_2',reply:'تم تجهيز المسودة.',employee:{status:'disabled',flowId:'flow_1'}});
  assert.equal(draft.request_status,'succeeded');
  assert.equal(draft.outcome_kind,'employee_draft');
  assert.equal(draft.work_status,'not_started');
  assert.equal(draft.employee.status,'disabled');
  assert.equal(draft.runId,undefined);
  assert.equal(draft.recent_work,undefined);
});

test('no-execution contract rejects an external-run claim',()=>{
  assert.throws(()=>completedWithoutExecution('external_run',{ok:true}),TypeError);
  assert.throws(()=>completedWithoutExecution('conversation_reply',{ok:true,runId:'run_1'}),TypeError);
  assert.throws(()=>completedWithoutExecution('conversation_reply',{ok:true,recent_work:[]}),TypeError);
  assert.throws(()=>completedWithoutExecution('employee_draft',{ok:true,employee:{status:'active'}}),TypeError);
});

test('rejected preflight tells the customer no task started and carries no run proof',()=>{
  const result=failedChatExecution({conversationId:'chat_1',requestId:'request_1',effectStarted:false,executionAttempt:true});
  assert.equal(result.request_status,'failed');
  assert.equal(result.work_status,'failed');
  assert.match(result.reply,/لم يبدأ تنفيذ المهمة/);
  assert.equal(result.transport_receipt,undefined);
});

test('HTTP transport receipt remains unverified and does not imply business success',()=>{
  const result=failedChatExecution({conversationId:'chat_1',requestId:'request_2',effectStarted:true,executionAttempt:true,transportReceipt:{runId:'R12345678901234567890',httpStatus:201,receivedAt:'2026-10-01T00:00:00Z',outcome:'unverified'}});
  assert.equal(result.request_status,'not_observed');
  assert.equal(result.work_status,'unknown');
  assert.equal(result.transport_receipt.httpStatus,201);
  assert.equal(result.transport_receipt.outcome,'unverified');
  assert.match(result.reply,/نتيجتها النهائية قيد التحقق/);
  assert.equal(result.recent_work,undefined);
});

test('an unconfirmed dispatch or missing tool output does not claim receipt or success',()=>{
  const pending=failedChatExecution({conversationId:'chat_1',requestId:'request_3',effectStarted:true,executionAttempt:true});
  assert.equal(pending.work_status,'unknown');
  assert.match(pending.reply,/لم نؤكد وصولها/);
  assert.equal(pending.transport_receipt,undefined);
  const noOutput=failedChatExecution({conversationId:'chat_1',requestId:'request_4',effectStarted:true,executionAttempt:true,transportReceipt:{runId:'R12345678901234567890',httpStatus:null,receivedAt:null,outcome:'unverified'}});
  assert.equal(noOutput.work_status,'unknown');
  assert.match(noOutput.reply,/رد الأداة غير مؤكد/);
  assert.equal(noOutput.transport_receipt.httpStatus,null);
});

test('queued time reduces execution budget before another request can expire it',()=>{
  assert.equal(chatExecutionBudget(0,0),600_000);
  assert.equal(chatExecutionBudget(0,600_000),120_000);
  assert.equal(chatExecutionBudget(0,720_000),1);
  assert.equal(chatExecutionBudget(0,900_000),1);
  assert.ok(600_000+chatExecutionBudget(0,600_000)<900_000);
});
