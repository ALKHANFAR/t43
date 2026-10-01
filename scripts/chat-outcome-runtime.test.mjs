import test from 'node:test';
import assert from 'node:assert/strict';
import {completedWithoutExecution,failedChatExecution} from '../lib/chat-outcome.mjs';

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
