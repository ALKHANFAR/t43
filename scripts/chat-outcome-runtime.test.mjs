import test from 'node:test';
import assert from 'node:assert/strict';
import {completedWithoutExecution,failedChatExecution,nativeActionReceipt,completedToolActions,flowTestSnapshot,chatExecutionBudget} from '../lib/chat-outcome.mjs';

const native=(output,note='')=>({content:[{type:'text',text:`✅ Gmail completed (run R12345678901234567890)${note}.\n\n${JSON.stringify(output)}`}]});
test('mixed action and flow results succeed only when every dispatch has its own confirmed receipt',()=>{
  const action={name:'ap_run_action',status:'returned',outcome:'action_completed',run_id:'A'.repeat(21),effect_attempted:true};
  const flow={name:'employee_mcp',status:'returned',outcome:'flow_completed',run_id:'R'.repeat(21),effect_attempted:true};
  const assess=receipts=>completedToolActions({flowToolAttempted:true,effects:['ap_run_action','employee_mcp'],toolReceipts:receipts}).work_status;
  assert.equal(assess([action,flow]),'succeeded');
  for(const receipts of [[action],[action,{...flow,outcome:'unverified'}],[{...action,status:'error'},flow],[{...action,run_id:''},flow],[flow,action]])assert.equal(assess(receipts),'unknown');
});
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

test('official AP footer does not hide native completion or imply full output',()=>{
  const result=native({messages:[{subject:'Full subject',body:'short…[truncated 9000 chars]'}]});
  result.content[0].text+='\n\n(Long values above end with "…[truncated]" — shortened, not missing. Every field and record is still listed. The full output was 140KB. Ask for fewer items or a narrower filter to see a shortened value in full.)';
  const receipt=nativeActionReceipt('ap_run_action',result);
  assert.equal(receipt.outcome,'action_completed');assert.equal(receipt.output_limited,true);
  assert.match(result.content[0].text,/truncated 9000 chars/);
  const empty=native([]);empty.content[0].text+='\n\nNote: empty result. Broaden your filter.';
  assert.equal(nativeActionReceipt('ap_run_action',empty).outcome,'action_completed');
  const bad=native({response:{status:403}});bad.content[0].text+='\n\nNote: empty result. Broaden your filter.';
  assert.equal(nativeActionReceipt('ap_run_action',bad).outcome,'unverified');
});


test('native test snapshot ignores only step test metadata and operation audit fields',()=>{
  const version={id:'v1',created:'same',updated:'before',trigger:{name:'trigger',settings:{sampleData:{lastTestDate:'before'},input:{sampleData:{business:'keep'},nested:{settings:{sampleData:'business'}}}},nextAction:{name:'loop',settings:{sampleData:{lastTestDate:'before'}},firstLoopAction:{name:'inner',settings:{input:{prompt:'keep'},sampleData:{sampleDataFileId:'before'}}},children:[{name:'branch',settings:{input:{prompt:'keep'},sampleData:{lastTestDate:'before'}}}]}}};
  const native=structuredClone(version);native.updated='after';native.updatedBy='tester';native.trigger.settings.sampleData={lastTestDate:'after'};native.trigger.nextAction.firstLoopAction.settings.sampleData={sampleDataFileId:'after'};native.trigger.nextAction.children[0].settings.sampleData={lastTestDate:'after'};
  assert.equal(flowTestSnapshot(native),flowTestSnapshot(version));
  for(const mutate of [v=>{v.id='v2';},v=>{v.created='changed';},v=>{v.trigger.settings.input.sampleData.business='changed';},v=>{v.trigger.settings.input.nested.settings.sampleData='changed';},v=>{v.trigger.nextAction.firstLoopAction.settings.input.prompt='changed';},v=>{v.trigger.nextAction.children[0].settings.input.prompt='changed';}]){
    const changed=structuredClone(native);mutate(changed);assert.notEqual(flowTestSnapshot(changed),flowTestSnapshot(version));
  }
});

test('employee readiness never marks unrelated actions, table writes or another Flow successful',()=>{
  const readiness={employee_id:'e',flow_id:'F'.repeat(21),published_version_id:'v1',test_run_id:'R'.repeat(21),test_environment:'TESTING'};
  for(const [name,flow] of [['ap_run_action',readiness.flow_id],['ap_update_table',readiness.flow_id],['ap_update_step','X'.repeat(21)]]){
    const answer={readinessReceipt:readiness,effects:['ap_test_flow',name],toolReceipts:[{name:'ap_test_flow',flow_id:readiness.flow_id,effect_attempted:true,status:'returned'},{name,flow_id:flow,effect_attempted:true,status:'returned'}]};
    const result=completedToolActions(answer);assert.equal(result.outcome_kind,'unverified');assert.equal(result.work_status,'unknown');assert.deepEqual(result.readiness_receipt,readiness);
  }
});


test('an active tested employee does not turn a failed setup request into overall success',()=>{
  const readiness={employee_id:'e',flow_id:'F'.repeat(21),published_version_id:'v1',test_run_id:'R'.repeat(21),test_environment:'TESTING'};
  const result=completedToolActions({readinessReceipt:readiness,effects:['ap_test_flow','ap_lock_and_publish','ap_change_flow_status'],toolReceipts:[{name:'ap_test_flow',flow_id:readiness.flow_id,effect_attempted:true,status:'returned'},{name:'ap_lock_and_publish',flow_id:readiness.flow_id,effect_attempted:true,status:'returned'},{name:'ap_change_flow_status',flow_id:readiness.flow_id,effect_attempted:true,status:'error'}]});
  assert.equal(result.work_status,'unknown');assert.equal(result.outcome_kind,'unverified');assert.deepEqual(result.readiness_receipt,readiness);
});


test('verified native Flow runs complete only the exact recorded effects without provider or KPI claims',()=>{
  const receipt={name:'qa_mcp',status:'returned',effect_attempted:true,run_id:'R'.repeat(21),outcome:'flow_completed'};
  const answer={flowToolAttempted:true,effects:['qa_mcp'],toolReceipts:[receipt]};
  assert.deepEqual(completedToolActions(answer),{request_status:'succeeded',work_status:'succeeded',outcome_kind:'tool_result'});
  for(const modified of [{effects:['qa_mcp','ap_add_step']},{effects:['other_mcp']},{toolReceipts:[{...receipt,status:'error'}]},{flowToolAttempted:false}])assert.equal(completedToolActions({...answer,...modified}).work_status,'unknown');
});

test('verified memory persistence is distinct from a provider result and does not mask mixed action failures',()=>{
  const memory={name:'ap_update_record',status:'returned',effect_attempted:true,outcome:'memory_saved',memory_table_id:'T'.repeat(21),memory_operation:'update'};
  const only=completedToolActions({effects:[memory.name],toolReceipts:[memory]});assert.equal(only.outcome_kind,'memory_updated');
  const action={name:'ap_run_action',status:'returned',effect_attempted:true,outcome:'action_completed'};
  const mixed=completedToolActions({effects:[action.name,memory.name],toolReceipts:[action,memory]});assert.equal(mixed.outcome_kind,'tool_result');assert.equal(mixed.memory_updates.length,1);
  const failed=completedToolActions({effects:[action.name,memory.name],toolReceipts:[{...action,outcome:'unverified'},memory]});assert.equal(failed.outcome_kind,'unverified');
  assert.equal(completedToolActions({effects:[memory.name],toolReceipts:[{...memory,memory_table_id:'invalid'}]}).outcome_kind,'unverified');
});


test('model billing failure is explicit only before execution starts',()=>{
  const args={conversationId:'c',requestId:'r',failureCode:'assistant_billing_unavailable'};
  const failed=failedChatExecution(args);
  assert.equal(failed.work_status,'failed');assert.match(failed.reply,/الرصيد/);
  const uncertain=failedChatExecution({...args,effectStarted:true,executionAttempt:true});
  assert.equal(uncertain.work_status,'unknown');assert.doesNotMatch(uncertain.reply,/الرصيد/);
  const receipt=failedChatExecution({...args,effectStarted:true,transportReceipt:{runId:'R12345678901234567890',outcome:'unverified',httpStatus:200}});
  assert.equal(receipt.transport_receipt.runId,'R12345678901234567890');assert.doesNotMatch(receipt.reply,/الرصيد/);
});
