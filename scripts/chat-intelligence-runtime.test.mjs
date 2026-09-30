import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
const chat=await readFile(new URL('../app/chat.js',import.meta.url),'utf8');

test('central chat uses company knowledge, settings and team instead of the rigid fallback',()=>{
  assert.match(server,/deepseekReply\(\{company,settings,knowledge,team,history,message,employee=null\}\)/);
  assert.match(server,/profiles\.ownedKnowledge\(companyId\)/);
  assert.match(server,/profiles\.readSettings\(companyId\)/);
  assert.match(server,/profiles\.listEmployees\(companyId\)/);
  assert.match(server,/profiles\.recordConversation/);
  assert.doesNotMatch(server,/reply:'وصل طلبك\. إنشاء الموظفين متاح الآن/);
  assert.match(server,/model:'deepseek-v4-pro'/);
  assert.match(server,/thinking:\{type:'enabled'\}/);
  assert.doesNotMatch(server,/جملتين إلى أربع جمل/);
  assert.match(server,/سياق العمل الحالي بصيغة JSON/);
  assert.match(server,/فكّر وتصرّف ورد بالطريقة التي تراها الأنسب/);
  assert.doesNotMatch(server,/لا تستخدم كلمات Activepieces/);
  assert.doesNotMatch(server,/نصًا نظيفًا بلا نجوم/);
  assert.doesNotMatch(server,/لا تطلب أكثر من سؤال/);
  assert.match(chat,/<strong>\$1<\/strong>/);
});

test('employee instructions have a tenant-scoped verified write path',()=>{
  assert.match(server,/input\.op==='employee_instructions'/);
  assert.match(server,/updateEmployeeInstructions\(\{companyId,employeeId:input\.employee_id,instructions\}\)/);
  assert.match(chat,/op:'employee_instructions',employee_id:e\.id,instructions:instructions/);
  assert.match(chat,/data\.employee\.instructions!==instructions/);
  assert.match(chat,/مصدر البداية: الدور المختار ومعرفة شركتك/);
});

test('employee conversation reads its saved instructions while external execution stays gated',()=>{
  assert.match(server,/deepseekReply\(\{company,settings,knowledge,team,history,message,employee=null\}\)/);
  assert.match(server,/selectedEmployee=employee\?/);
  assert.match(server,/saved\.status==='active'&&wantsEmployeeExecution\(input\.message\)/);
  assert.match(server,/employee:saved/);
  assert.match(server,/instruction_version:Number\(saved\.prompt_version\|\|1\),external_execution:false/);
});

test('thinking experience scans the real catalog and remains reduced-motion safe',()=>{
  assert.match(chat,/TOOLS\.map\(/);
  assert.match(chat,/\.slice\(0,50\)/);
  assert.match(chat,/intentOrder/);
  assert.match(chat,/أفحص الأدوات الأقرب للنتيجة/);
  assert.match(chat,/أدقق الخيار الأنسب لشركتك/);
  assert.match(chat,/stopExperience\(\)/);
});
