import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {builtFlowResult,conversationMemory} from '../lib/chat-intelligence.mjs';
import {employeeFlowMcpToolName,employeeMcpToolReady,scopeMcpTool,visibleMcpTool} from '../lib/mcp-flow-scope.mjs';
import {TenantProjectError} from '../lib/tenant-projects.mjs';
import {nativeActionReceipt,completedToolActions,flowTestSnapshot,chatExecutionBudget,failedChatExecution} from '../lib/chat-outcome.mjs';
import {CompanyProfileError} from '../lib/company-profile.mjs';

// Runs the real chat loop and Flow lifecycle against a scripted model and Activepieces MCP.
const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const lifecycle=readFileSync(new URL('../lib/chat-flow-lifecycle.mjs',import.meta.url),'utf8');
const helpers=lifecycle.slice(lifecycle.indexOf('async function buildOwnedDraftFlow('),lifecycle.indexOf('  return {buildOwnedDraftFlow,successfulFlowTest};'));
const start=source.indexOf('async function deepseekReply('),end=source.indexOf('async function publicChat(',start);
assert.ok(start>0&&end>start);
const flowId='F'.repeat(21);
const runId='R'.repeat(21);
const publishedFlow={id:flowId,status:'ENABLED',publishedVersionId:'v1',version:{id:'v1',displayName:'نور',trigger:{settings:{pieceName:'@activepieces/piece-mcp',triggerName:'mcp_tool',input:{toolName:'nour',returnsResponse:true}}}}};
const flowToolName=employeeFlowMcpToolName(publishedFlow);
const hint=readOnlyHint=>({annotations:{readOnlyHint}});
const catalog=[
  {name:'ap_list_connections',...hint(true),inputSchema:{type:'object',properties:{}}},
  {name:'ap_research_pieces',...hint(true)},
  {name:'ap_validate_flow',...hint(true),inputSchema:{type:'object',properties:{flowId:{type:'string'}}}},
  {name:'ap_test_flow',...hint(false),inputSchema:{type:'object',properties:{flowId:{type:'string'}}}},
  {name:'ap_get_run',...hint(true),inputSchema:{type:'object',properties:{flowRunId:{type:'string'}}}},
  {name:'ap_build_flow',...hint(false)},
  {name:'ap_create_flow',...hint(false)},
  {name:'ap_list_flows',...hint(true)},
  {name:'ap_delete_flow',...hint(false),inputSchema:{type:'object',properties:{flowId:{type:'string'}}}},
  {name:'ap_duplicate_flow',...hint(false),inputSchema:{type:'object',properties:{flowId:{type:'string'},name:{type:'string'}}}},
  {name:'ap_list_tables',...hint(true)},
  {name:'ap_list_ai_models',...hint(true)},
  {name:'ap_retry_run',...hint(false),inputSchema:{type:'object',properties:{flowRunId:{type:'string'},strategy:{type:'string'}}}},
  {name:'ap_add_step',...hint(false),inputSchema:{type:'object',properties:{flowId:{type:'string'}}}},
  {name:'ap_lock_and_publish',...hint(false),inputSchema:{type:'object',properties:{flowId:{type:'string'}}}},
  {name:'ap_change_flow_status',...hint(false),inputSchema:{type:'object',properties:{flowId:{type:'string'},status:{type:'string'}}}},
  {name:'ap_run_action',...hint(false)},
  {name:'ap_set_project_context',...hint(false)},
  {name:flowToolName,...hint(false),inputSchema:{type:'object',properties:{task:{type:'string'}}}},
];
const say=content=>({content});
const use=(...calls)=>({content:'',tool_calls:calls.map(([name,args],index)=>({id:`call_${name}_${index}`,function:{name,arguments:typeof args==='string'?args:JSON.stringify(args||{})}}))});

function setup({script,toolResults={},flowStatus='DISABLED',published=false,editDuringTest=false,nativeTestMetadata=false,editInputDuringTest=false,publishDifferentVersion=false,saveStateFailure=false,saveRunFailure=false}={}){
  const log={model:[],tools:[],effects:0,states:[],owned:[],runs:[]};
  let stateAttempts=0,step=0,status=flowStatus,publishedVersionId=published?'v1':null,draftVersionId='v1',versionState=published?'LOCKED':'DRAFT',sampleData,updated='before',updatedBy,taskInput='{{trigger.task}}';
  const mcp={call:async(_company,method,params)=>{
    if(method==='tools/list')return {tools:catalog};
    if(method==='initialize')return {instructions:'## Activepieces MCP Server\n1. Discover 2. Schema 3. Build 4. Validate 5. Publish'};
    log.tools.push([params.name,params.arguments]);
    if(Object.hasOwn(toolResults,params.name)){const value=toolResults[params.name];return typeof value==='function'?value(params.arguments):value;}
    if(params.name==='ap_build_flow')return {content:[{type:'text',text:`✅ Flow created (id: ${flowId})`}],structuredContent:{flowId,invalidSteps:[],skippedSteps:[],unknownProps:[]}};
    if(params.name==='ap_test_flow'){if(editDuringTest)draftVersionId='v2';if(nativeTestMetadata){sampleData={lastTestDate:'2026-10-05T21:13:05.105Z',sampleDataFileId:'S'.repeat(21)};updated='after';updatedBy='test-user';}if(editInputDuringTest)taskInput='changed task';return {structuredContent:{runId,status:'SUCCEEDED',usedMockTriggerData:false}};}
    if(params.name==='ap_get_run')return {structuredContent:{id:runId,flowId,status:'SUCCEEDED',environment:'TESTING',steps:[{name:'trigger',status:'SUCCEEDED'}]}};
    if(params.name==='ap_change_flow_status'){status=params.arguments.status;return {content:[{type:'text',text:'status changed'}]};}
    if(params.name==='ap_lock_and_publish'){versionState='LOCKED';status='ENABLED';publishedVersionId=publishDifferentVersion?'v2':'v1';return {content:[{type:'text',text:'✅ published and enabled'}]};}
    return {content:[{type:'text',text:`ok ${params.name}`}]};
  }};
  const ctx={
    console:{error:()=>{},info:()=>{},warn:()=>{}},process:{env:{DEEPSEEK_API_KEY:'test-key'}},
    AbortController,setTimeout,clearTimeout,Date,JSON,String,Array,Object,Math,
    TenantProjectError,CompanyProfileError,nativeActionReceipt,flowTestSnapshot,builtFlowResult,conversationMemory,employeeFlowMcpToolName,employeeMcpToolReady,scopeMcpTool,visibleMcpTool,
    fetch:async(url,options)=>{
      const request=JSON.parse(options.body);log.model.push(request);
      const message=script[Math.min(step++,script.length-1)];
      return {ok:true,json:async()=>({choices:[{message:typeof message==='function'?message(request):message}]})};
    },
    database:async()=>({connect:async()=>({query:async()=>({rows:[{locked:true}]}),release:()=>{}})}),
    companyProfiles:async()=>({
      clearEmployeeActivationIntent:async()=>{},
      findEmployee:async()=>({id:'employee-1',status:'draft',activepieces_flow_id:null}),
      linkEmployeeFlow:async({flowId:id})=>({recordId:'employee-1',flowId:id,name:'أمين المحتوى',status:'disabled'}),
      recordEmployeeRun:async input=>{if(saveRunFailure)throw new Error('save failed');log.runs.push(input);return {recordId:input.employeeId,flowId:input.flowId,lastRunId:input.runId,status:'active'};},
      setEmployeeState:async({employeeId,status:next})=>{if(saveStateFailure===true||saveStateFailure==='once'&&stateAttempts++===0)throw new Error('save failed');log.states.push([employeeId,next]);return {recordId:employeeId,flowId,name:'أمين المحتوى',status:next};},
    }),
    tenantProjects:async()=>({requireProject:async()=> 'P'.repeat(21),ownedFlow:async(_company,id)=>{log.owned.push(id);return {flow:{...publishedFlow,id,status,publishedVersionId,version:{...publishedFlow.version,id:draftVersionId,state:versionState,updated,...(updatedBy?{updatedBy}:{}),trigger:{...publishedFlow.version.trigger,settings:{...publishedFlow.version.trigger.settings,input:{...publishedFlow.version.trigger.settings.input,task:taskInput},...(sampleData?{sampleData}:{})}}}}};}}),
    toolConnections:async()=>({assertOwnedExternal:async({externalId})=>{if(externalId==='foreign')throw new TenantProjectError('connection_not_owned','الاتصال لا يخص هذه الشركة.',403);}}),
  };
  const deepseekReply=runInNewContext(`${helpers}\n${source.slice(start,end)}; deepseekReply`,ctx);
  const run=(extra={})=>deepseekReply({company:{name:'شركة'},settings:{},knowledge:{},team:[],history:[],message:'جهّز الموظف',mcp,companyId:'company-1',conversationId:'c1',deadlineMs:600_000,onEffectStart:()=>{log.effects++;},...extra});
  return {run,log};
}
const toolMessages=request=>request.messages.filter(item=>item.role==='tool').map(item=>item.content);

test('a previous task restriction in memory does not block the current explicit publish request',async()=>{
  const prior='أريد مسودة فقط للمهمة السابقة، بدون تشغيل أو تفعيل.';
  const current='اختبر النسخة الحالية ثم انشرها وفعّل الموظف الآن.';
  const {run,log}=setup({script:[use(['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}]),say('اختبرت ونشرت النسخة الحالية.')]});
  const answer=await run({history:[{role:'user',content:prior},{role:'assistant',content:'المهمة السابقة انتهت.'}],message:current,draftEmployee:{id:'employee-1',activepieces_flow_id:flowId}});
  // This scripted harness verifies the prompt contract, not live LLM interpretation.
  assert.match(log.model[0].messages[0].content,/قيد مهمة سابقة ليس قاعدة دائمة/);
  assert.match(log.model[0].messages[0].content,/التوجيه الأحدث يحسم التعارض/);
  assert.ok(log.model[0].messages[0].content.includes(prior.slice(0,-1)));
  assert.equal(log.model[0].messages.at(-1).content,current);
  assert.deepEqual(log.tools.map(([name])=>name),['ap_test_flow','ap_get_run','ap_lock_and_publish']);
  assert.deepEqual(log.states,[['employee-1','active']]);
  assert.equal(answer.readinessReceipt.published_version_id,'v1');
});

test('current draft-only or read-only requests block every effectful call while permitting reads',async()=>{
  for(const message of ['أريد مسودة فقط، بدون تشغيل أو تفعيل.','راجع الموظف للقراءة فقط.','draft only','read-only']){
    const {run,log}=setup({script:[use(['ap_validate_flow',{flowId}],['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}],['ap_change_flow_status',{flowId,status:'ENABLED'}],['ap_run_action',{pieceName:'gmail',actionName:'send_email'}]),say('راجعت دون تنفيذ.')]});
    const answer=await run({message,history:[{role:'user',content:'اختبر وانشر وفعّل الموظف.'}],draftEmployee:{id:'employee-1',activepieces_flow_id:flowId}});
    assert.deepEqual(log.tools.map(([name])=>name),['ap_validate_flow'],message);
    assert.equal(log.effects,0,message);
    assert.deepEqual(log.states,[]);
    assert.deepEqual(log.runs,[]);
    assert.equal(answer.readinessReceipt,undefined);
    assert.equal(answer.effects.length,0);
    assert.ok(answer.toolReceipts.filter(item=>item.status==='error').every(item=>!item.effect_attempted));
    assert.equal(toolMessages(log.model.at(-1)).filter(item=>/chat_read_only/.test(item)).length,4);
  }
});

test('explicit publication requires a successful test of the current version even with old memory approval',async()=>{
  for(const changed of [false,true]){
    const {run,log}=setup({editDuringTest:changed,script:[...(changed?[use(['ap_test_flow',{flowId}])]:[]),use(['ap_lock_and_publish',{flowId}],['ap_change_flow_status',{flowId,status:'ENABLED'}]),say('يلزم اختبار النسخة الحالية.') ]});
    const answer=await run({message:'انشر وفعّل الموظف الآن.',history:[{role:'user',content:'اختبرت النسخة السابقة ووافقت على النشر.'}],draftEmployee:{id:'employee-1',activepieces_flow_id:flowId}});
    assert.deepEqual(log.tools.map(([name])=>name),changed?['ap_test_flow','ap_get_run']:[]);
    assert.deepEqual(log.states,[]);
    assert.equal(answer.readinessReceipt,undefined);
    assert.equal(toolMessages(log.model.at(-1)).filter(item=>/employee_test_required/.test(item)).length,2);
    assert.ok(answer.toolReceipts.slice(-2).every(item=>item.status==='error'&&!item.effect_attempted));
  }
});

test('the model builds, tests and publishes in one request and writes the reply itself',async()=>{
  const {run,log}=setup({script:[
    use(['ap_list_connections',{}]),
    use(['ap_build_flow',{flowName:'أمين المحتوى',trigger:{pieceName:'schedule',triggerName:'every_week'},steps:[{type:'PIECE',displayName:'توليد'},{type:'PIECE',displayName:'Slack'},{type:'PIECE',displayName:'Gmail'}]}]),
    use(['ap_validate_flow',{flowId}],['ap_test_flow',{flowId}],['ap_lock_and_publish',{flowId}]),
    say('بُنيت ثلاث خطوات ونُشرت.'),
  ]});
  const answer=await run({draftEmployee:{id:'employee-1',name:'أمين المحتوى',activepieces_flow_id:null}});
  assert.equal(answer.reply,'بُنيت ثلاث خطوات ونُشرت.');
  assert.equal(answer.flowId,flowId);
  assert.equal(answer.approval,undefined);
  assert.deepEqual(log.tools.map(item=>item[0]),['ap_list_connections','ap_build_flow','ap_validate_flow','ap_test_flow','ap_get_run','ap_lock_and_publish']);
  assert.equal(log.tools[1][1].steps.length,3);
  assert.deepEqual(log.states,[['employee-1','active']]);
  assert.equal(answer.employee.status,'active');
  assert.ok(log.effects>=2);
  const first=log.model[0],last=log.model.at(-1);
  assert.deepEqual(first.thinking,{type:'enabled'});
  assert.match(first.messages[0].content,/## Activepieces MCP Server/);
  assert.ok(first.tools.some(tool=>tool.function.name==='ap_lock_and_publish'));
  assert.ok(first.tools.some(tool=>tool.function.name==='ap_set_project_context'));
  assert.equal(toolMessages(last).length,5);
  assert.match(toolMessages(last)[1],/Flow created/);
});

test('an employee cannot be published from chat without a successful test run readback',async()=>{
  const {run,log}=setup({script:[use(['ap_lock_and_publish',{flowId}]),say('التجربة مطلوبة أولًا.')]});
  const answer=await run({draftEmployee:{id:'employee-1',name:'أمين المحتوى',activepieces_flow_id:flowId}});
  assert.deepEqual(log.tools,[]);
  assert.deepEqual(log.states,[]);
  assert.match(toolMessages(log.model.at(-1))[0],/employee_test_required/);
  assert.equal(answer.employee,undefined);
});

test('a failed test or a later edit invalidates employee activation',async()=>{
  const failed=setup({script:[use(['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}]),say('لم أنشره.')],toolResults:{ap_test_flow:{structuredContent:{runId,status:'FAILED'}}}});
  await failed.run({draftEmployee:{id:'employee-1',name:'أمين المحتوى',activepieces_flow_id:flowId}});
  assert.deepEqual(failed.log.tools.map(item=>item[0]),['ap_test_flow']);
  assert.match(toolMessages(failed.log.model.at(-1))[1],/employee_test_required/);
  const edited=setup({script:[use(['ap_test_flow',{flowId}]),use(['ap_add_step',{flowId}]),use(['ap_lock_and_publish',{flowId}]),say('تحتاج تجربة جديدة.')],toolResults:{ap_add_step:{content:[{type:'text',text:'step added'}]}}});
  await edited.run({draftEmployee:{id:'employee-1',name:'أمين المحتوى',activepieces_flow_id:flowId}});
  assert.deepEqual(edited.log.tools.map(item=>item[0]),['ap_test_flow','ap_get_run','ap_add_step']);
  assert.match(toolMessages(edited.log.model.at(-1))[2],/employee_test_required/);
});

test('a concurrent Flow version change during the test cannot authorize publishing',async()=>{
  const changed=setup({script:[use(['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}]),say('تغيّرت النسخة أثناء التجربة.')],editDuringTest:true});
  await changed.run({draftEmployee:{id:'employee-1',name:'أمين المحتوى',activepieces_flow_id:flowId}});
  assert.deepEqual(changed.log.tools.map(item=>item[0]),['ap_test_flow','ap_get_run']);
  assert.match(toolMessages(changed.log.model.at(-1))[1],/employee_test_required/);
});

test('a tool error returns to the model, which corrects itself and continues',async()=>{
  const failed={isError:true,content:[{type:'text',text:'❌ Failed to get run: FlowRun "x" not found. Check the ID or name and try again.'}]};
  const {run,log}=setup({script:[use(['ap_validate_flow',{flowId:'bad'}]),use(['ap_list_connections',{}]),say('صحّحت وأكملت.')],toolResults:{ap_validate_flow:failed}});
  const answer=await run();
  assert.equal(answer.reply,'صحّحت وأكملت.');
  assert.match(toolMessages(log.model[1])[0],/Check the ID or name and try again/);
  assert.deepEqual(log.tools.map(item=>item[0]),['ap_validate_flow','ap_list_connections']);
  assert.equal(log.effects,0);
});

test('a failed build is handed back as Activepieces wrote it and no employee is linked',async()=>{
  const failed={isError:true,content:[{type:'text',text:'❌ Failed to build flow: trigger "every_weak" not found'}]};
  const {run,log}=setup({script:[use(['ap_build_flow',{flowName:'x'}]),say('فشل البناء لاسم المشغّل.')],toolResults:{ap_build_flow:failed}});
  const answer=await run({draftEmployee:{id:'employee-1',name:'x',activepieces_flow_id:null}});
  assert.equal(answer.flowId,undefined);assert.equal(answer.employee,undefined);
  assert.match(toolMessages(log.model[1])[0],/every_weak/);
});

test('a failed first build reports the local employee record for later recovery',async()=>{
  const failed={isError:true,content:[{type:'text',text:'trigger connection missing'}]};
  const {run}=setup({script:[use(['ap_build_flow',{flowName:'مستشار المبيعات'}]),say('ينقص اتصال المشغّل.')],toolResults:{ap_build_flow:failed}});
  const answer=await run({createDraft:async name=>({id:'employee-1',name,status:'disabled',activepieces_flow_id:null})});
  assert.equal(answer.employee.name,'مستشار المبيعات');
  assert.equal(answer.flowId,undefined);
});

test('a Flow built with no saved draft creates the employee under the name the model designed',async()=>{
  const names=[];
  const {run}=setup({script:[use(['ap_build_flow',{flowName:'أمين المحتوى الاجتماعي',trigger:{},steps:[]}]),say('بُنيت.')]});
  const answer=await run({createDraft:async name=>{names.push(name);return {id:'employee-1',name,activepieces_flow_id:null};}});
  assert.deepEqual(names,['أمين المحتوى الاجتماعي']);
  assert.equal(answer.employee.recordId,'employee-1');
  assert.equal(answer.flowId,flowId);
});

test('a second build in one chat request cannot create an orphan Flow',async()=>{
  const {run,log}=setup({script:[
    use(['ap_build_flow',{flowName:'أمين المحتوى',trigger:{},steps:[]}]),
    use(['ap_build_flow',{flowName:'نسخة أخرى',trigger:{},steps:[]}]),
    say('أكملت تعديل التدفق الأول.'),
  ]});
  const answer=await run({createDraft:async name=>({id:'employee-1',name,activepieces_flow_id:null})});
  assert.equal(answer.flowId,flowId);
  assert.deepEqual(log.tools.map(item=>item[0]),['ap_build_flow']);
  assert.match(toolMessages(log.model.at(-1))[1],/employee_flow_conflict/);
});

test('invalid calls and company boundaries are answered to the model without dispatch',async()=>{
  const {run,log}=setup({script:[
    use(['ap_set_project_context',{projectId:'other'}],['ap_unknown',{}],['ap_add_step','not json'],['ap_run_action',{pieceName:'gmail',actionName:'send_email',connectionExternalId:'foreign'}]),
    say('لم يُنفّذ شيء خارج مشروع الشركة.'),
  ]});
  const answer=await run();
  assert.equal(answer.reply,'لم يُنفّذ شيء خارج مشروع الشركة.');
  assert.deepEqual(log.tools,[]);
  assert.equal(answer.toolReceipts.length,4);
  assert.ok(answer.toolReceipts.every(item=>item.status==='error'&&!item.effect_attempted));
  const replies=toolMessages(log.model[1]);
  assert.equal(replies.length,4);
  assert.match(replies[0],/mcp_project_switch_forbidden/);assert.match(replies[2],/mcp_arguments_invalid/);assert.match(replies[3],/connection_not_owned/);
});

test('the chat keeps ordered MCP results without storing tool inputs or claiming provider success',async()=>{
  let calls=0;
  const {run}=setup({script:[
    use(['ap_run_action',{pieceName:'gmail',actionName:'get_profile',connectionExternalId:'owned'}]),
    use(['ap_run_action',{pieceName:'gmail',actionName:'get_profile',connectionExternalId:'owned'}]),
    say('المحاولة الأولى أخطأت، والثانية أعادت ردًا.'),
  ],toolResults:{ap_run_action:()=>++calls===1?{isError:true,content:[{type:'text',text:'invalid_request: private detail'}]}:{content:[{type:'text',text:'✅ Get Profile completed (run RRR). private result'}]}}});
  const answer=await run();
  assert.deepEqual(JSON.parse(JSON.stringify(answer.toolReceipts)),[{name:'ap_run_action',status:'error',effect_attempted:true},{name:'ap_run_action',status:'returned',effect_attempted:true}]);
  assert.equal(calls,2);
  assert.doesNotMatch(JSON.stringify(answer.toolReceipts),/private|connectionExternalId|owned|invalid_request/);
});

test('the step limit ends with a written account instead of a fixed sentence',async()=>{
  const {run,log}=setup({script:[request=>request.tools?use(['ap_research_pieces',{}]):say('قرأت الكتالوج ولم أبنِ شيئًا بعد.')]});
  const answer=await run();
  assert.equal(answer.reply,'قرأت الكتالوج ولم أبنِ شيئًا بعد.');
  assert.equal(log.tools.length,40);
  assert.equal(log.model.at(-1).tools,undefined);
});

test('a request that runs out of time still ends with an account of what ran',async()=>{
  const near=setup({script:[request=>request.tools?use(['ap_add_step',{flowId}]):say('أضفت خطوة واحدة وبقي النشر.')]});
  const written=await near.run({deadlineMs:60_000});
  assert.equal(written.reply,'أضفت خطوة واحدة وبقي النشر.');
  assert.equal(near.log.tools.length,0);
  const late=setup({script:[use(['ap_add_step',{flowId}])],toolResults:{ap_add_step:async()=>{await new Promise(resolve=>setTimeout(resolve,30));return {content:[{type:'text',text:'ok'}]};}}});
  const fallback=await late.run({deadlineMs:75_020});
  assert.match(fallback.reply,/ap_add_step/);
  assert.match(fallback.reply,/أكمل/);
});

test('selected employee chat calls only its published native MCP Flow tool',async()=>{
  const employee={id:'employee-9',name:'نور',status:'active',activepieces_flow_id:flowId};
  const {run,log}=setup({flowStatus:'ENABLED',published:true,script:[use(['ap_add_step',{flowId:'G'.repeat(21)}]),use([flowToolName,{task:'نفذ'}]),say('وصل رد الأداة.')]});
  const answer=await run({employee});
  assert.equal(answer.flowToolAttempted,true);
  assert.deepEqual(log.tools,[[flowToolName,{task:'نفذ'}]]);
  assert.match(toolMessages(log.model[1])[0],/employee_flow_scope/);
  assert.match(toolMessages(log.model.at(-1)).at(-1),new RegExp(`ok ${flowToolName}`));
  assert.ok(log.model[0].tools.some(tool=>tool.function.name===flowToolName));
  assert.ok(!log.model[0].tools.some(tool=>tool.function.name==='siyadah_run_employee_flow'));
});

test('account company name survives researched website identity in hydrate and export',async()=>{
  const chatStart=source.indexOf('async function publicChat('),chatEnd=source.indexOf('function staticFile(req,res)',chatStart);
  for(const op of ['hydrate','export']){
    const profiles={read:async()=>({company_name:'Website Vendor'}),listEmployees:async()=>[],recentWork:async()=>[],readSettings:async()=>({}),ownedKnowledge:async()=>({}),listConversations:async()=>[],pendingChatWork:async()=>[]};
    let response;
    const ctx={JSON,String,Object,Number,Array,Date,TenantProjectError,CompanyProfileError,GmailPilotError:class extends Error{},
      body:async()=>({op}),tenantSession:async()=>({session:{companyId:'company-1'},account:{company_name:'Registered Company'},headers:{}}),companyProfiles:async()=>profiles,
      json:(_res,status,value)=>{assert.equal(status,200);response=value;}};
    const publicChat=runInNewContext(`${source.slice(chatStart,chatEnd)};publicChat`,ctx);
    await publicChat({headers:{}},{});
    assert.equal(op==='hydrate'?response.company:response.export.company.name,'Registered Company');
    if(op==='export')assert.equal(response.filename,'Registered Company-siyadah.json');
  }
});

test('a long request answers queued once, keeps working, and settles the same request ID',async()=>{
  const chatStart=source.indexOf('async function publicChat('),chatEnd=source.indexOf('function staticFile(req,res)',chatStart);
  const jsonStart=source.indexOf('function json(res,status,body,headers={})'),jsonEnd=source.indexOf('\n',jsonStart);
  assert.ok(chatStart>0&&chatEnd>chatStart&&jsonStart>0);
  const timers=[],settled=[],recorded=[];let release;
  const profiles={
    claimChatRequest:async()=>({claimed:true,claimToken:'t'}),
    earlierPendingChatRequest:async()=>null,
    settleChatRequest:async entry=>{settled.push(entry);return {status:entry.status,httpStatus:entry.httpStatus,response:entry.response};},
    read:async()=>({company_name:'شركة'}),readSettings:async()=>({}),ownedKnowledge:async()=>({}),listEmployees:async()=>[],listConversations:async()=>[],conversationHistory:async()=>[],
    findConversationDraft:async()=>null,recordConversation:async entry=>{recorded.push(entry);},
  };
  const ctx={
    console:{error:()=>{},info:()=>{},warn:()=>{}},JSON,String,Object,Number,Array,Boolean,
    setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:id=>{if(timers[id-1])timers[id-1].cleared=true;},
    randomUUID:()=>'11111111-1111-4111-8111-111111111111',createHash:()=>({update(){return this;},digest:()=>'hash'}),
    TenantProjectError,CompanyProfileError,chatExecutionBudget,Date,GmailPilotError:class extends Error{},GMAIL_PILOT_COMMAND:'pilot',
    body:async()=>({op:'message',message:'ابنِ طريقة عمل كاملة',conversation_id:'c1',request_id:'r1'}),
    tenantSession:async()=>({session:{companyId:'company-1'},account:{company_name:'شركة'},headers:{}}),
    companyProfiles:async()=>profiles,activepiecesMcp:async()=>({}),
    employeeRequestMode:()=>'explore',explicitNewEmployee:()=>false,flowName:()=>'x',
    completedWithoutExecution:(kind,response)=>({...response,request_status:'succeeded',outcome_kind:kind,work_status:'not_started'}),
    failedChatExecution,
    deepseekReply:()=>new Promise(resolve=>{release=resolve;}),
  };
  const publicChat=runInNewContext(`${source.slice(jsonStart,jsonEnd)}\n${source.slice(chatStart,chatEnd)}; publicChat`,ctx);
  const writes=[];
  const res={headersSent:false,writeHead(status){this.headersSent=true;writes.push({status});},end(text){writes.at(-1).body=JSON.parse(text);}};
  const running=publicChat({headers:{}},res);
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  const wait=timers.find(timer=>timer.ms===20_000&&!timer.cleared);
  assert.ok(wait);
  wait.fn();
  assert.equal(writes.length,1);
  assert.deepEqual([writes[0].body.request_status,writes[0].body.work_id],['queued','request_r1']);
  release({reply:'بُنيت ونُشرت.',flowId});
  await running;
  assert.equal(writes.length,1);
  assert.equal(settled.length,1);
  assert.equal(settled[0].status,'succeeded');
  assert.equal(settled[0].response.reply,'بُنيت ونُشرت.');
  assert.equal(settled[0].response.flow_id,flowId);
  assert.equal(recorded.at(-1).assistantMessage,'بُنيت ونُشرت.');
  assert.ok(wait.cleared);
  // A failed accepted message survives reload too; it is not left as an unanswered user row.
  ctx.deepseekReply=async()=>{throw new Error('model unavailable');};
  const failedWrites=[];
  const failedRes={headersSent:false,writeHead(status){this.headersSent=true;failedWrites.push({status});},end(text){failedWrites.at(-1).body=JSON.parse(text);}};
  await publicChat({headers:{}},failedRes);
  assert.equal(failedWrites[0].body.request_status,'failed');
  assert.equal(recorded.at(-1).assistantMessage,failedWrites[0].body.reply);
  assert.match(recorded.at(-1).assistantMessage,/تعذّر إكمال الطلب/);
});

test('a second message waits for the first result before reaching the model',async()=>{
  const chatStart=source.indexOf('async function publicChat('),chatEnd=source.indexOf('function staticFile(req,res)',chatStart);
  const jsonStart=source.indexOf('function json(res,status,body,headers={})'),jsonEnd=source.indexOf('\n',jsonStart);
  let firstDone=false,releaseFirst,modelCalls=0;const messages=[];
  const profiles={
    claimChatRequest:async()=>({claimed:true,claimToken:'t'}),
    earlierPendingChatRequest:async({requestId})=>requestId==='r2'&&!firstDone?'r1':null,
    settleChatRequest:async entry=>{if(entry.requestId==='r1')firstDone=true;return {httpStatus:entry.httpStatus,response:entry.response};},
    read:async()=>({company_name:'شركة'}),readSettings:async()=>({}),ownedKnowledge:async()=>({}),listEmployees:async()=>[],
    listConversations:async()=>[{id:'c1',messages:[...messages]}],conversationHistory:async({requestId})=>messages.filter(m=>m.requestId<requestId).map(({role,content})=>({role,content})),expireChatRequest:async()=>{},findConversationDraft:async()=>null,
    recordConversation:async entry=>{for(const [role,content] of [['user',entry.userMessage],['assistant',entry.assistantMessage]])if(content!==undefined&&!messages.some(m=>m.requestId===entry.requestId&&m.role===role))messages.push({requestId:entry.requestId,role,content});},
  };
  const ctx={console:{error:()=>{}},JSON,String,Object,Number,Array,Boolean,Date,
    setTimeout:(fn,ms)=>ms===1000?setTimeout(fn,1):1,clearTimeout:()=>{},
    randomUUID:()=> 'u1',createHash:()=>({update(){return this;},digest:()=> 'hash'}),
    TenantProjectError,CompanyProfileError,chatExecutionBudget,Date,GmailPilotError:class extends Error{},GMAIL_PILOT_COMMAND:'pilot',
    body:async req=>({op:'message',message:req.id,conversation_id:'c1',request_id:req.id}),
    tenantSession:async()=>({session:{companyId:'company-1'},account:{company_name:'شركة'},headers:{}}),
    companyProfiles:async()=>profiles,activepiecesMcp:async()=>({}),
    completedWithoutExecution:(kind,response)=>({...response,request_status:'succeeded',outcome_kind:kind,work_status:'not_started'}),
    failedChatExecution:()=>({ok:true,request_status:'failed'}),
    deepseekReply:async args=>{modelCalls++;if(args.message==='r1')await new Promise(resolve=>{releaseFirst=resolve;});return {reply:`رد ${args.message}: ${args.history.length}`};},
  };
  const publicChat=runInNewContext(`${source.slice(jsonStart,jsonEnd)}\n${source.slice(chatStart,chatEnd)}; publicChat`,ctx);
  const response=()=>({headersSent:false,writeHead(){this.headersSent=true;},end(){}});
  const first=publicChat({id:'r1',headers:{}},response());
  while(!releaseFirst)await new Promise(resolve=>setImmediate(resolve));
  const second=publicChat({id:'r2',headers:{}},response());
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(modelCalls,1);
  releaseFirst();await Promise.all([first,second]);
  assert.equal(modelCalls,2);
  assert.equal(messages.at(-1).content,'رد r2: 2');
});


test('large MCP results reach the model as complete JSON with every returned record',async()=>{
  const records=Array.from({length:5},(_,i)=>({id:String(i),subject:`subject ${i}`,body:'x'.repeat(8000)}));
  const native={content:[{type:'text',text:JSON.stringify(records)}]};
  const {run}=setup({toolResults:{ap_run_action:native},script:[
    use(['ap_run_action',{pieceName:'gmail',actionName:'gmail_search_email',input:{max_results:5}}]),
    request=>{const received=JSON.parse(toolMessages(request).at(-1));assert.deepEqual(JSON.parse(received.content[0].text),records);return say('خمسة سجلات كاملة.');},
  ]});
  assert.equal((await run()).reply,'خمسة سجلات كاملة.');
});


test('main-chat draft carries saved owner instructions into the model instead of losing them during build',async()=>{
  const instruction='اكتب التقارير بالعربية واحتفظ بمراجع المصادر.';
  const {run,log}=setup({script:[say('قرأت تعليمات المسودة.') ]});
  await run({draftEmployee:{id:'employee-1',name:'أمين المحتوى',activepieces_flow_id:null,prompt:instruction,prompt_source:'owner',prompt_version:3}});
  const system=log.model[0].messages[0].content;
  assert.ok(system.includes(instruction));
  assert.ok(system.includes('"instructionSource":"owner"'));
  assert.ok(system.includes('"instructionVersion":3'));
  assert.match(system,/ليست دليلًا على تعليمات التشغيل/);
  assert.deepEqual(log.tools,[]);
});


test('large company context does not cut saved employee instructions or produce partial JSON',async()=>{
  const instruction=('"قرار"\n').repeat(1700);
  const {run,log}=setup({script:[say('قرأت السياق كاملاً.') ]});
  await run({company:{name:'شركة',profile:{about:'معلومة '.repeat(5000)}},draftEmployee:{id:'employee-1',name:'أمين المحتوى',activepieces_flow_id:null,prompt:instruction,prompt_source:'owner',prompt_version:4}});
  const content=log.model[0].messages[0].content;
  const raw=content.split('سياق العمل الحالي بصيغة JSON:\n')[1].split('\n\n## Activepieces MCP Server')[0];
  const context=JSON.parse(raw);
  assert.equal(context.currentDraft.instructions,instruction);
  assert.equal(context.company.profile.about,'معلومة '.repeat(5000));
  assert.deepEqual(log.tools,[]);
});


test('native AP test metadata does not invalidate unchanged instructions and returns scoped readiness',async()=>{
  const {run}=setup({nativeTestMetadata:true,script:[use(['ap_build_flow',{flowName:'نور'}]),use(['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}]),say('اختبرت ونشرت.') ]});
  const answer=await run({draftEmployee:{id:'employee-1',name:'نور',activepieces_flow_id:null}});
  assert.equal(answer.employee.status,'active');
  assert.deepEqual(JSON.parse(JSON.stringify(answer.readinessReceipt)),{employee_id:'employee-1',flow_id:flowId,published_version_id:'v1',test_run_id:runId,test_environment:'TESTING',used_mock_trigger_data:false});
  assert.equal(completedToolActions(answer).outcome_kind,'employee_ready');
  assert.equal(completedToolActions(answer).work_status,'succeeded');
  assert.equal(answer.toolReceipts.filter(r=>r.effect_attempted).every(r=>r.flow_id===flowId),true);
});

test('native metadata tolerance cannot mask a concurrent instruction change',async()=>{
  const {run,log}=setup({nativeTestMetadata:true,editInputDuringTest:true,script:[use(['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}]),say('تحتاج تجربة جديدة.') ]});
  const answer=await run({draftEmployee:{id:'employee-1',name:'نور',activepieces_flow_id:flowId}});
  assert.deepEqual(log.tools.map(item=>item[0]),['ap_test_flow','ap_get_run']);
  assert.equal(answer.readinessReceipt,undefined);
  assert.equal(completedToolActions(answer).work_status,'unknown');
});

test('a different published version or failed local state readback never produces readiness',async()=>{
  for(const option of [{publishDifferentVersion:true},{saveStateFailure:true}]){
    const {run}=setup({...option,script:[use(['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}]),say('قرأت النتيجة.') ]});
    const answer=await run({draftEmployee:{id:'employee-1',name:'نور',activepieces_flow_id:flowId}});
    assert.equal(answer.readinessReceipt,undefined);
    assert.equal(completedToolActions(answer).outcome_kind,'unverified');
  }
});

test('an old active employee without a fresh tested and published receipt stays unverified',async()=>{
  const {run}=setup({flowStatus:'ENABLED',published:true,script:[use(['ap_add_step',{flowId}]),say('عدلت المسودة.') ]});
  const answer=await run({employee:{id:'employee-1',status:'active',activepieces_flow_id:flowId}});
  assert.equal(answer.readinessReceipt,undefined);
  assert.equal(completedToolActions(answer).outcome_kind,'unverified');
});


test('readiness retains the native mock-data flag and never infers it from a FlowRun',async()=>{
  for(const flag of [true,undefined]){
    const {run}=setup({script:[use(['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}]),say('اختبرت ونشرت.')],toolResults:{ap_test_flow:{structuredContent:{runId,status:'SUCCEEDED',...(flag===undefined?{}:{usedMockTriggerData:flag})}}}});
    const answer=await run({draftEmployee:{id:'employee-1',name:'نور',activepieces_flow_id:flowId}});
    assert.equal(answer.readinessReceipt.used_mock_trigger_data,flag);
    assert.equal(Object.hasOwn(answer.readinessReceipt,'used_mock_trigger_data'),flag!==undefined);
  }
});


test('native DRAFT to LOCKED publication does not reject subsequent enabling of the tested version',async()=>{
  const {run,log}=setup({nativeTestMetadata:true,script:[use(['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}]),use(['ap_change_flow_status',{flowId,status:'ENABLED'}]),say('فعّلت النسخة المختبرة.') ]});
  const answer=await run({draftEmployee:{id:'employee-1',name:'نور',activepieces_flow_id:flowId}});
  assert.deepEqual(log.tools.map(item=>item[0]),['ap_test_flow','ap_get_run','ap_lock_and_publish','ap_change_flow_status']);
  assert.equal(completedToolActions(answer).outcome_kind,'employee_ready');
});


test('the next model call sees the saved employee link alongside the unchanged native build result',async()=>{
  const {run}=setup({script:[use(['ap_build_flow',{flowName:'نور'}]),request=>{
    const result=JSON.parse(toolMessages(request).at(-1));
    assert.equal(result.structuredContent.flowId,flowId);
    assert.match(result.content[0].text,/Flow created/);
    assert.equal(result.siyadahContext.employee.recordId,'employee-1');
    assert.equal(result.siyadahContext.employee.flowId,flowId);
    assert.equal(result.siyadahContext.employee.status,'disabled');
    assert.equal(result.siyadahContext.readinessReceipt,undefined);
    return say('الموظف مربوط بالمسودة.');
  }]});
  const answer=await run({draftEmployee:{id:'employee-1',activepieces_flow_id:null}});
  assert.equal(answer.employee.status,'disabled');
});

test('publication reconciles the employee and readiness before the model writes its final reply',async()=>{
  const {run,log}=setup({script:[use(['ap_build_flow',{flowName:'نور'}]),use(['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}]),request=>{
    const result=JSON.parse(toolMessages(request).at(-1));
    assert.match(result.content[0].text,/published and enabled/);
    assert.equal(result.siyadahContext.employee.status,'active');
    assert.equal(result.siyadahContext.readinessReceipt.test_run_id,runId);
    assert.equal(result.siyadahContext.readinessReceipt.published_version_id,'v1');
    return say('الموظف مربوط ومفعّل.');
  }]});
  const answer=await run({draftEmployee:{id:'employee-1',activepieces_flow_id:null}});
  assert.equal(answer.employee.status,'active');
  assert.equal(log.states.length,1);
});

test('failed employee reconciliation exposes uncertainty without an active state or readiness to the model',async()=>{
  const {run}=setup({saveStateFailure:true,script:[use(['ap_build_flow',{flowName:'نور'}]),use(['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}]),request=>{
    const result=JSON.parse(toolMessages(request).at(-1));
    assert.equal(result.siyadahContext.employee,undefined);
    assert.equal(result.siyadahContext.employeeStateVerified,false);
    assert.equal(result.siyadahContext.readinessReceipt,undefined);
    return say('نُشر التدفق وبقي تأكيد تفعيل الموظف.');
  }]});
  const answer=await run({draftEmployee:{id:'employee-1',activepieces_flow_id:null}});
  assert.equal(answer.employee.status,'disabled');
  assert.equal(answer.readinessReceipt,undefined);
});


test('publishing then disabling a newly linked employee sends its latest disabled state to the model',async()=>{
  const {run,log}=setup({script:[use(['ap_build_flow',{flowName:'نور'}]),use(['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}]),use(['ap_change_flow_status',{flowId,status:'DISABLED'}]),request=>{
    const result=JSON.parse(toolMessages(request).at(-1));
    assert.equal(result.siyadahContext.employee.status,'disabled');
    assert.equal(result.siyadahContext.readinessReceipt,undefined);
    return say('الموظف متوقف.');
  }]});
  const answer=await run({draftEmployee:{id:'employee-1',activepieces_flow_id:null}});
  assert.equal(answer.employee.status,'disabled');
  assert.equal(answer.readinessReceipt,undefined);
  assert.deepEqual(log.states,[['employee-1','active'],['employee-1','disabled']]);
});


test('a transient employee state readback failure remains retryable at finalization',async()=>{
  const {run,log}=setup({saveStateFailure:'once',script:[use(['ap_build_flow',{flowName:'نور'}]),use(['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}]),request=>{
    const result=JSON.parse(toolMessages(request).at(-1));
    assert.equal(result.siyadahContext.employeeStateVerified,false);
    assert.equal(result.siyadahContext.employee,undefined);
    return say('نُشر التدفق؛ تأكيد حالة الموظف يحتاج قراءة.');
  }]});
  const answer=await run({draftEmployee:{id:'employee-1',activepieces_flow_id:null}});
  assert.equal(answer.employee.status,'active');
  assert.equal(answer.readinessReceipt.test_run_id,runId);
  assert.equal(log.states.length,1);
});


const executionResult=(overrides={})=>({content:[{type:'text',text:'native reply'}],structuredContent:{execution:{runId,flowId,projectId:'P'.repeat(21),flowVersionId:'v1',environment:'PRODUCTION',...overrides}}});
const productionRun=(overrides={})=>({structuredContent:{id:runId,flowId,environment:'PRODUCTION',status:'SUCCEEDED',steps:[{name:'trigger',output:{}},{name:'reply',output:{status:200,body:{result:'QA'}}}],...overrides}});
const runningEmployee={id:'employee-9',status:'active',activepieces_flow_id:flowId,tools_json:['mcp']};

test('a newly prepared employee executes a subsequent work request through its published native tool',async()=>{
  const preparation=setup({nativeTestMetadata:true,script:[use(['ap_build_flow',{flowName:'نور'}]),use(['ap_test_flow',{flowId}]),use(['ap_lock_and_publish',{flowId}]),say('الموظف جاهز.')]});
  const ready=await preparation.run({message:'ابن الموظف واختبره وانشره وفعّله',draftEmployee:{id:'employee-1',name:'نور',activepieces_flow_id:null}});
  assert.equal(completedToolActions(ready).outcome_kind,'employee_ready');
  assert.equal(ready.employee.status,'active');
  assert.equal(ready.employee.flowId,ready.readinessReceipt.flow_id);
  const employee={id:ready.employee.recordId,status:ready.employee.status,activepieces_flow_id:ready.employee.flowId,tools_json:['mcp']};
  const work=setup({published:true,flowStatus:'ENABLED',toolResults:{[flowToolName]:executionResult(),ap_get_run:productionRun()},script:[use([flowToolName,{task:'أرجع نتيجة العمل'}]),say('native reply')]});
  const result=await work.run({message:'نفّذ العمل الآن',employee});
  assert.deepEqual(JSON.parse(JSON.stringify(work.log.tools)),[[flowToolName,{task:'أرجع نتيجة العمل'}],['ap_get_run',{flowRunId:runId}]]);
  assert.equal(work.log.runs[0].employeeId,employee.id);
  assert.equal(work.log.runs[0].flowId,ready.readinessReceipt.flow_id);
  assert.equal(result.toolReceipts[0].run_id,runId);
  assert.equal(result.toolReceipts[0].outcome,'flow_completed');
  assert.equal(completedToolActions(result).outcome_kind,'tool_result');
  assert.equal(completedToolActions(result).work_status,'succeeded');
  assert.equal(result.reply,'native reply');
});

test('earlier Flow edits including failed writes block native dispatch in the same batch or next turn',async()=>{
  for(const sameBatch of [true,false])for(const failedWrite of [true,false]){
    let nativeReconciliations=0;
    const edit=['ap_add_step',{flowId}],native=[flowToolName,{}];
    const {run,log}=setup({published:true,flowStatus:'ENABLED',toolResults:failedWrite?{ap_add_step:()=>{throw new Error('ambiguous write failure');}}:{},script:sameBatch?[use(edit,native),say('اطلب تشغيل الموظف بصورة مستقلة.')]:[use(edit),use(native),say('اطلب تشغيل الموظف بصورة مستقلة.')]});
    const answer=await run({employee:runningEmployee,onNativeExecution:async()=>{nativeReconciliations++;}});
    assert.deepEqual(log.tools.map(x=>x[0]),['ap_add_step']);
    assert.equal(nativeReconciliations,0);assert.equal(answer.flowToolAttempted,false);
    assert.equal(completedToolActions(answer).work_status,'unknown');
  }
});

test('native dispatch blocks later effects in the same batch or next turn while readonly remains allowed',async()=>{
  for(const sameBatch of [true,false])for(const name of ['ap_add_step','ap_test_flow','ap_lock_and_publish']){
    const native=[flowToolName,{}],effect=[name,{flowId}];
    const script=[use(['ap_validate_flow',{flowId}]),...(sameBatch?[use(native,effect)]:[use(native),use(effect)]),use(['ap_validate_flow',{flowId}]),say('اكتملت المهمة؛ التعديل يحتاج طلبًا آخر.')];
    const {run,log}=setup({published:true,flowStatus:'ENABLED',toolResults:{[flowToolName]:executionResult(),ap_get_run:productionRun()},script});
    const answer=await run({employee:runningEmployee});
    assert.deepEqual(log.tools.map(x=>x[0]),['ap_validate_flow',flowToolName,'ap_get_run','ap_validate_flow']);
    assert.deepEqual(Array.from(answer.effects),[flowToolName]);assert.equal(log.runs.length,1);
    assert.equal(completedToolActions(answer).work_status,'succeeded');
  }
});

test('native employee execution receipt reads its exact production run and saves proof before the next model call',async()=>{
  const {run,log}=setup({published:true,flowStatus:'ENABLED',toolResults:{[flowToolName]:executionResult(),ap_get_run:productionRun()},script:[use([flowToolName,{}]),request=>{
    const result=JSON.parse(toolMessages(request).at(-1));
    assert.equal(result.content[0].text,'native reply');
    assert.equal(result.siyadahContext.employee.lastRunId,runId);
    return say('وصل رد الموظف.');
  }]});
  const answer=await run({employee:runningEmployee});
  assert.equal(answer.toolReceipts[0].run_id,runId);
  assert.equal(answer.toolReceipts[0].outcome,'flow_completed');
  assert.equal(completedToolActions(answer).work_status,'succeeded');
  assert.equal(log.runs.length,1);
  assert.equal(log.runs[0].employeeId,'employee-9');
  assert.equal(log.runs[0].conversationId,'c1');
  assert.deepEqual(log.tools.map(x=>x[0]),[flowToolName,'ap_get_run']);
});

test('missing, mismatched, nonterminal or unsaved native execution stays unknown without repeating dispatch',async()=>{
  const cases=[
    {result:{content:[{type:'text',text:'native reply'}]}},
    ...[{projectId:'X'.repeat(21)},{flowId:'X'.repeat(21)},{flowVersionId:'v2'},{environment:'TESTING'}].map(x=>({result:executionResult(x)})),
    ...[{id:'X'.repeat(21)},{flowId:'X'.repeat(21)},{environment:'TESTING'},{status:'RUNNING'},{status:'FAILED'},{steps:[]}].map(x=>({detail:productionRun(x)})),
    {detail:{isError:true}},{saveRunFailure:true},
  ];
  for(const item of cases){
    const {run,log}=setup({published:true,flowStatus:'ENABLED',saveRunFailure:item.saveRunFailure,toolResults:{[flowToolName]:item.result||executionResult(),ap_get_run:item.detail||productionRun()},script:[use([flowToolName,{}]),say('النتيجة قيد التحقق.')]});
    const answer=await run({employee:runningEmployee});
    assert.equal(completedToolActions(answer).work_status,'unknown');
    assert.equal(answer.toolReceipts[0].run_id,undefined);
    assert.equal(answer.employee,undefined);
    assert.equal(log.tools.filter(x=>x[0]===flowToolName).length,1);
  }
});


test('paused employee actually uses native action tables and AI discovery in its chat',async()=>{
  const {run,log}=setup({script:[use(['ap_list_tables',{}],['ap_list_ai_models',{}],['ap_run_action',{pieceName:'gmail',actionName:'read_email'}]),say('قرأت النتائج الأصلية.')]});
  await run({employee:{id:'employee-1',status:'draft',activepieces_flow_id:flowId}});
  assert.deepEqual(log.tools.map(x=>x[0]),['ap_list_tables','ap_list_ai_models','ap_run_action']);
  assert.ok(log.model[0].tools.some(x=>x.function.name==='ap_retry_run'));
});
test('employee without a Flow builds and edits its own linked Flow in one chat',async()=>{
  const {run,log}=setup({script:[use(['ap_build_flow',{flowName:'نور',trigger:{},steps:[]}]),use(['ap_add_step',{displayName:'خطوة'}]),say('بنيت المسودة وعدلتها.')]});
  const result=await run({employee:{id:'employee-1',status:'draft',activepieces_flow_id:null}});
  assert.equal(result.employee.recordId,'employee-1');assert.equal(result.employee.flowId,flowId);
  assert.deepEqual(log.tools.map(x=>x[0]),['ap_build_flow','ap_add_step']);
  assert.equal(log.tools[1][1].flowId,flowId);
  assert.equal(log.model.at(-1).tools.some(x=>x.function.name==='ap_build_flow'),true);
});
test('native employee Flow listing removes other Flow data from text and structured output',async()=>{
  const foreign='G'.repeat(21);
  const {run,log}=setup({script:[use(['ap_list_flows',{}]),say('هذه طريقة عملي.')],toolResults:{ap_list_flows:{structuredContent:{flows:[{id:flowId,displayName:'نور'},{id:foreign,displayName:'secret-other'}],count:2},content:[{type:'text',text:'secret-other '+foreign}]}}});
  await run({employee:{id:'employee-1',status:'draft',activepieces_flow_id:flowId}});
  const outputs=toolMessages(log.model.at(-1));
  assert.equal(outputs.length,1);assert.doesNotMatch(outputs[0],/secret-other|GGGGG/);
  assert.equal(JSON.parse(outputs[0]).structuredContent.count,1);
});
test('employee retry cannot dispatch a run belonging to a different Flow',async()=>{
  const {run,log}=setup({script:[use(['ap_retry_run',{flowRunId:runId,strategy:'FROM_FAILED_STEP'}]),say('هذا التشغيل لا يخصني.')],toolResults:{ap_get_run:{structuredContent:{id:runId,flowId:'G'.repeat(21),status:'FAILED'}}}});
  await run({employee:{id:'employee-1',status:'draft',activepieces_flow_id:flowId}});
  assert.deepEqual(log.tools.map(x=>x[0]),['ap_get_run']);assert.equal(log.effects,0);
  assert.match(toolMessages(log.model.at(-1))[0],/employee_run_scope/);
});
test('employee create Flow uses native MCP and links its existing record',async()=>{
  const {run,log}=setup({script:[use(['ap_create_flow',{flowName:'نور'}]),say('حفظت المسودة الفارغة.')],toolResults:{ap_create_flow:{structuredContent:{flowId,displayName:'نور'}}}});
  const result=await run({employee:{id:'employee-1',status:'draft',activepieces_flow_id:null}});
  assert.deepEqual(log.tools.map(x=>x[0]),['ap_create_flow']);assert.equal(result.employee.recordId,'employee-1');assert.equal(result.employee.flowId,flowId);
});


test('employee duplication creates a company artifact without replacing its saved Flow',async()=>{
  const duplicate='D'.repeat(21);
  const {run,log}=setup({script:[use(['ap_duplicate_flow',{name:'نسخة مستقلة'}]),say('أنشأت نسخة مستقلة في الشركة.')],toolResults:{ap_duplicate_flow:{structuredContent:{flowId:duplicate}}}});
  const answer=await run({employee:{id:'employee-1',status:'draft',activepieces_flow_id:flowId}});
  assert.equal(log.tools[0][1].flowId,flowId);assert.equal(answer.employee,undefined);assert.equal(log.states.length,0);
  const context=JSON.parse(toolMessages(log.model.at(-1))[0]).siyadahContext;
  assert.equal(context.employee_flow_id,flowId);assert.equal(context.employee_link_changed,false);assert.equal(context.duplicate_scope,'independent_company_flow');
});


test('accepted native deletion pauses the employee without claiming final Flow deletion',async()=>{
  const {run,log}=setup({published:true,flowStatus:'ENABLED',script:[use(['ap_delete_flow',{}]),say('طلب الحذف قُبل وأوقفت الموظف.')],toolResults:{ap_delete_flow:{structuredContent:{success:true}}}});
  const result=await run({employee:{id:'employee-1',status:'active',activepieces_flow_id:flowId}});
  assert.deepEqual(log.states,[['employee-1','disabled']]);assert.equal(result.employee.status,'disabled');assert.equal(result.employee.flowId,flowId);
  assert.equal(result.readinessReceipt,undefined);assert.equal(log.model.at(-1).tools.some(x=>x.function.name===flowToolName),true);
});


test('main and every employee state receive the complete native catalog without a fixed count',async()=>{
  for(const employee of [null,{id:'employee-1',status:'draft',activepieces_flow_id:null},{id:'employee-1',status:'disabled',activepieces_flow_id:flowId},{id:'employee-1',status:'active',activepieces_flow_id:flowId}]){
    const {run,log}=setup({script:[say('الكتالوج متاح')],published:true,flowStatus:'ENABLED'});
    await run({employee});
    assert.deepEqual(log.model[0].tools.map(x=>x.function.name),catalog.map(x=>x.name));
  }
});

test('saved draft sees creation tools but cannot create a replacement Flow',async()=>{
  const {run,log}=setup({script:[use(['ap_create_flow',{flowName:'replacement'}]),say('نستخدم المسودة الموجودة')]});
  await run({draftEmployee:{id:'employee-1',status:'draft',activepieces_flow_id:flowId}});
  assert.ok(log.model[0].tools.some(x=>x.function.name==='ap_create_flow'));
  assert.deepEqual(log.tools,[]);
  assert.match(toolMessages(log.model[1])[0],/employee_flow_conflict/);
});

test('completed effect stays visible but cannot be dispatched again in a continuation',async()=>{
  const {run,log}=setup({script:[use(['ap_list_tables',{}]),say('أكمل من النتيجة')]});
  await run({excludedTools:['ap_list_tables']});
  assert.ok(log.model[0].tools.some(x=>x.function.name==='ap_list_tables'));
  assert.deepEqual(log.tools,[]);
  assert.match(toolMessages(log.model[1])[0],/mcp_effect_already_completed/);
});
