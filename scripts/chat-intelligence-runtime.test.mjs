import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {builtFlowResult,conversationMemory,createdTableReadback,flowName,hasActiveFlowConnections} from '../lib/chat-intelligence.mjs';

const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
const chat=await readFile(new URL('../app/chat.js',import.meta.url),'utf8');

test('central chat uses company knowledge, settings and team instead of the rigid fallback',()=>{
  assert.match(server,/deepseekReply\(\{company,settings,knowledge,team,history,message,/);
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

test('the model chooses when to build while a quoted employee name remains usable',()=>{
  assert.equal(flowName('جهّز الموظف «منسق العملاء»'),'منسق العملاء');
  assert.doesNotMatch(server,/employeeRequestMode\(input\.message\)/);
  assert.doesNotMatch(server,/const newEmployee=creating/);
  assert.match(server,/مستشار أعمال متمرس/);
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
});

test('employee conversation reads its saved instructions while external execution stays gated',()=>{
  assert.match(server,/deepseekReply\(\{company,settings,knowledge,team,history,message,/);
  assert.match(server,/selectedEmployee=employee\?/);
  assert.match(server,/employeeFlowMcpToolName\(published\.flow\)/);
  assert.match(server,/name,arguments:args/);
  assert.match(server,/answer\.flowToolAttempted/);
  assert.doesNotMatch(server,/siyadah_run_employee_flow|\.runFlow\(/);
  assert.doesNotMatch(server,/wantsEmployeeExecution\(input\.message\)/);
  assert.match(server,/employee:saved/);
  assert.match(server,/instruction_version:Number\(saved\.prompt_version\|\|1\),external_execution:false/);
});

test('real account waiting state does not invent catalog scanning before server readback',()=>{
  assert.match(chat,/window\.__SIY_REAL__\?ui\('الطلب قيد المعالجة…','Processing your request…'\)/);
  assert.match(chat,/!window\.__SIY_REAL__&&scan\.length/);
  assert.doesNotMatch(chat,/أفحص الأدوات الأقرب للنتيجة/);
  assert.doesNotMatch(chat,/أدقق الخيار الأنسب لشركتك/);
});

test('MCP build response provides one valid flow ID and keeps incomplete steps as a draft',()=>{
  const flowId='F12345678901234567890';
  assert.deepEqual(builtFlowResult({structuredContent:{flowId,invalidSteps:[{name:'send_email',reason:'connection required'}]}}),{flowId,incomplete:true});
  assert.deepEqual(builtFlowResult({content:[{type:'text',text:JSON.stringify({flowId,skippedSteps:['send_email']})}]}),{flowId,incomplete:true});
  assert.deepEqual(builtFlowResult({structuredContent:{flowId,invalidSteps:[],skippedSteps:[],unknownProps:[]}}),{flowId,incomplete:false});
  assert.deepEqual(builtFlowResult({structuredContent:{flowId,invalidSteps:[]}}),{flowId,incomplete:true});
});

test('MCP build response cannot link an error, missing ID, or conflicting flow IDs',()=>{
  const flowId='F12345678901234567890',otherFlowId='G12345678901234567890';
  assert.equal(builtFlowResult({isError:true,structuredContent:{flowId}}),null);
  assert.equal(builtFlowResult({structuredContent:{success:true}}),null);
  assert.equal(builtFlowResult({structuredContent:{flowId:'invalid'}}),null);
  assert.equal(builtFlowResult({structuredContent:{flowId},content:[{type:'text',text:JSON.stringify({flowId:otherFlowId})}]}),null);
});

test('activation accepts only complete project connection readback for every required flow connection',()=>{
  const required=['gmail-connection','calendar-connection'];
  const valid={structuredContent:{count:2,connections:[
    {externalId:'gmail-connection',scope:'PROJECT',status:'ACTIVE'},
    {externalId:'calendar-connection',scope:'PROJECT',status:'ACTIVE'},
  ]}};
  assert.equal(hasActiveFlowConnections(required,valid),true);
  assert.equal(hasActiveFlowConnections([],null),true);
  assert.equal(hasActiveFlowConnections(required,{content:[{type:'text',text:'All connections active'}]}),false);
  assert.equal(hasActiveFlowConnections(required,{...valid,isError:true}),false);
  assert.equal(hasActiveFlowConnections(required,{structuredContent:{...valid.structuredContent,count:3}}),false);
  assert.equal(hasActiveFlowConnections(required,{structuredContent:{count:200,connections:Array(200).fill(valid.structuredContent.connections[0])}}),false);
  for(const status of ['PENDING','EXPIRED','DISABLED']){
    const changed={structuredContent:{count:2,connections:[valid.structuredContent.connections[0],{...valid.structuredContent.connections[1],status}]}};
    assert.equal(hasActiveFlowConnections(required,changed),false);
  }
  assert.equal(hasActiveFlowConnections(required,{structuredContent:{count:2,connections:[valid.structuredContent.connections[0],{...valid.structuredContent.connections[1],scope:'PLATFORM'}]}}),false);
  assert.equal(hasActiveFlowConnections(['missing'],valid),false);
});

test('employee activation reads provider state after publish and requires structured validation',()=>{
  const start=server.indexOf('async function changeEmployeeState('),end=server.indexOf("if(input.op==='employee_state')",start),activation=server.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(activation,/validation\.structuredContent\?\.valid!==true/);
  assert.match(activation,/name:'ap_lock_and_publish'/);
  assert.match(activation,/ownedFlow\(companyId,saved\.activepieces_flow_id\)/);
  assert.match(activation,/flow\.status!=='ENABLED'\|\|!flow\.publishedVersionId/);
  assert.ok(activation.lastIndexOf('ownedFlow(companyId,saved.activepieces_flow_id)')>activation.indexOf("name:'ap_lock_and_publish'"));
  assert.match(activation,/assertOwnedExternal\(\{tenantId:companyId,externalId,pieceName:/);
  assert.ok(activation.indexOf('assertOwnedExternal(')<activation.indexOf("name:'ap_validate_flow'"));
  assert.match(server.slice(end),/if\(input\.op==='employee_state'\)[\s\S]*changeEmployeeState\(saved,status\)/);
  assert.match(server.slice(end),/if\(input\.op==='resume_employee_activation'\)[\s\S]*changeEmployeeState\(saved,'active'\)/);
});

test('generic MCP flow build is returned as a disabled draft only after owned readback',()=>{
  const start=server.indexOf("if(input.op==='approve')"),end=server.indexOf("if(input.op==='message')",start),approval=server.slice(start,end);
  assert.ok(start>=0&&end>start);
  const branch=approval.slice(approval.indexOf("if(['ap_build_flow','ap_create_flow'].includes(pending.toolName)&&!employee)"));
  assert.match(branch,/builtFlowResult\(result\)/);
  assert.match(branch,/ownedFlow\(companyId,flowDraft\.flowId\)/);
  assert.match(branch,/flow\.status!=='DISABLED'/);
  assert.match(branch,/completedWithoutExecution\('conversation_reply',\{ok:true,conversation_id:conversationId,reply,flow_id:flowDraft\.flowId,draft:true\}\)/);
  assert.ok(branch.indexOf('ownedFlow(companyId,flowDraft.flowId)')<branch.indexOf("completedWithoutExecution('conversation_reply'"));
  assert.equal(builtFlowResult({content:[{type:'text',text:'Flow built successfully'}]}),null);
});

test('table creation is confirmed only by one exact structured inventory match',()=>{
  const table={id:'T12345678901234567890',externalId:'E12345678901234567890',name:'Leads'};
  const created={structuredContent:table},listed={structuredContent:{count:1,tables:[table]}};
  assert.deepEqual(createdTableReadback(created,listed),table);
  assert.equal(createdTableReadback({content:[{type:'text',text:'Table created'}]},listed),null);
  assert.equal(createdTableReadback({...created,isError:true},listed),null);
  assert.equal(createdTableReadback(created,{...listed,isError:true}),null);
  assert.equal(createdTableReadback(created,{structuredContent:{count:1,tables:[{...table,name:'Other'}]}}),null);
  assert.equal(createdTableReadback(created,{structuredContent:{count:2,tables:[table]}}),null);
  assert.equal(createdTableReadback(created,{structuredContent:{count:2,tables:[table,table]}}),null);
  assert.equal(createdTableReadback(created,{content:[{type:'text',text:'The table is present'}]}),null);
});

test('confirmed table resumes planning without creating another table and keeps flow build approval',()=>{
  const start=server.indexOf("if(pending.toolName==='ap_create_table')"),end=server.indexOf('const raw=Array.isArray(result.content)',start),continuation=server.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(continuation,/name:'ap_list_tables'/);
  assert.match(continuation,/createdTableReadback\(result,listed\)/);
  assert.match(continuation,/deepseekReply\(/);
  assert.match(continuation,/excludedTools:\['ap_create_table'\]/);
  assert.match(continuation,/answer\?\.approval\?\{approval:answer\.approval\}/);
  assert.match(server,/!excludedTools\.includes\(tool\.name\)/);
  assert.ok(continuation.indexOf('createdTableReadback(result,listed)')<continuation.indexOf('deepseekReply('));
  assert.match(server.slice(end,end+700),/outcome_kind:'unverified'/);
});
