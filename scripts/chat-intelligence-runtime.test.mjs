import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {conversationMemory,employeeRequestMode,flowName} from '../lib/chat-intelligence.mjs';

const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
const chat=await readFile(new URL('../app/chat.js',import.meta.url),'utf8');

test('central chat uses company knowledge, settings and team instead of the rigid fallback',()=>{
  assert.match(server,/deepseekReply\(\{company,settings,knowledge,team,history,message,employee=null,mcp=null,companyId=null,conversationId=null\}\)/);
  assert.match(server,/profiles\.ownedKnowledge\(companyId\)/);
  assert.match(server,/profiles\.readSettings\(companyId\)/);
  assert.match(server,/profiles\.listEmployees\(companyId\)/);
  assert.match(server,/profiles\.recordConversation/);
  assert.doesNotMatch(server,/reply:'وصل طلبك\. إنشاء الموظفين متاح الآن/);
  assert.match(server,/model:'deepseek-v4-pro'/);
  assert.match(server,/thinking:\{type:'enabled'\}/);
  assert.doesNotMatch(server,/جملتين إلى أربع جمل/);
  assert.match(server,/سياق العمل الحالي بصيغة JSON/);
  assert.match(server,/ذاكرة العمل من تعليمات المستخدم السابقة/);
  assert.match(server,/لا تدّع تنفيذ إجراء خارجي دون دليل تشغيل فعلي/);
  assert.match(server,/فكّر وتصرّف ورد بالطريقة التي تراها الأنسب/);
  assert.doesNotMatch(server,/لا تستخدم كلمات Activepieces/);
  assert.doesNotMatch(server,/نصًا نظيفًا بلا نجوم/);
  assert.doesNotMatch(server,/لا تطلب أكثر من سؤال/);
  assert.match(chat,/<strong>\$1<\/strong>/);
});

test('employee exploration does not create a flow until the user gives an explicit creation command',()=>{
  assert.equal(employeeRequestMode('أبغى موظف يتابع العملاء وما يضيع أحد'),'explore');
  assert.equal(employeeRequestMode('وش أفضل موظف رقمي للمبيعات؟'),'explore');
  assert.equal(employeeRequestMode('جهّز الموظف «منسق العملاء»'),'create');
  assert.equal(employeeRequestMode('أنشئ موظف رقمي للمبيعات'),'create');
  assert.equal(flowName('جهّز الموظف «منسق العملاء»'),'منسق العملاء');
  assert.match(server,/employeeRequestMode\(input\.message\)==='create'/);
  assert.doesNotMatch(server,/if\(wantsEmployee\(input\.message\)\)/);
});

test('working memory keeps older user constraints outside the recent message window',()=>{
  const history=[{role:'user',content:'لا ترسل أي رسالة إلا بعد موافقتي'}];
  for(let index=0;index<12;index++)history.push({role:index%2?'assistant':'user',content:`رسالة عادية ${index}`});
  history.push({role:'user',content:'أبغى الرد مختصر فقط'});
  const memory=conversationMemory(history);
  assert.match(memory,/لا ترسل أي رسالة إلا بعد موافقتي/);
  assert.match(memory,/أبغى الرد مختصر فقط/);
  assert.doesNotMatch(memory,/رسالة عادية/);
});

test('employee instructions have a tenant-scoped verified write path',()=>{
  assert.match(server,/input\.op==='employee_instructions'/);
  assert.match(server,/updateEmployeeInstructions\(\{companyId,employeeId:input\.employee_id,instructions\}\)/);
  assert.match(chat,/op:'employee_instructions',employee_id:e\.id,instructions:instructions/);
  assert.match(chat,/data\.employee\.instructions!==instructions/);
  assert.match(chat,/مصدر البداية: الدور المختار ومعرفة شركتك/);
});

test('employee conversation reads its saved instructions while external execution stays gated',()=>{
  assert.match(server,/deepseekReply\(\{company,settings,knowledge,team,history,message,employee=null,mcp=null,companyId=null,conversationId=null\}\)/);
  assert.match(server,/selectedEmployee=employee\?/);
  assert.match(server,/saved\.status==='active'&&wantsEmployeeExecution\(input\.message\)/);
  assert.match(server,/employee:saved/);
  assert.match(server,/instruction_version:Number\(saved\.prompt_version\|\|1\),external_execution:false/);
});

test('real account waiting state does not invent catalog scanning before server readback',()=>{
  assert.match(chat,/window\.__SIY_REAL__\?ui\('الطلب قيد المعالجة…','Processing your request…'\)/);
  assert.match(chat,/!window\.__SIY_REAL__&&scan\.length/);
  assert.doesNotMatch(chat,/أفحص الأدوات الأقرب للنتيجة/);
  assert.doesNotMatch(chat,/أدقق الخيار الأنسب لشركتك/);
});
