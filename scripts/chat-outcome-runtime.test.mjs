import test from 'node:test';
import assert from 'node:assert/strict';
import {completedWithoutExecution} from '../lib/chat-outcome.mjs';

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
