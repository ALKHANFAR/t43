import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {builtFlowResult,conversationMemory} from '../lib/chat-intelligence.mjs';
import {employeeMcpToolReady,scopeMcpTool,visibleMcpTool} from '../lib/mcp-flow-scope.mjs';
import {TenantProjectError} from '../lib/tenant-projects.mjs';
import {CompanyProfileError} from '../lib/company-profile.mjs';

// Runs the real chat loop from server.mjs against a scripted model and a scripted Activepieces MCP.
const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const start=source.indexOf('async function buildOwnedDraftFlow('),end=source.indexOf('async function publicChat(',start);
assert.ok(start>0&&end>start);
const flowId='F'.repeat(21);
const hint=readOnlyHint=>({annotations:{readOnlyHint}});
const catalog=[
  {name:'ap_list_connections',...hint(true),inputSchema:{type:'object',properties:{}}},
  {name:'ap_research_pieces',...hint(true)},
  {name:'ap_validate_flow',...hint(true),inputSchema:{type:'object',properties:{flowId:{type:'string'}}}},
  {name:'ap_build_flow',...hint(false)},
  {name:'ap_add_step',...hint(false),inputSchema:{type:'object',properties:{flowId:{type:'string'}}}},
  {name:'ap_lock_and_publish',...hint(false),inputSchema:{type:'object',properties:{flowId:{type:'string'}}}},
  {name:'ap_run_action',...hint(false)},
  {name:'ap_set_project_context',...hint(false)},
];
const say=content=>({content});
const use=(...calls)=>({content:'',tool_calls:calls.map(([name,args],index)=>({id:`call_${name}_${index}`,function:{name,arguments:typeof args==='string'?args:JSON.stringify(args||{})}}))});

function setup({script,toolResults={},flowStatus='DISABLED',published=false}={}){
  const log={model:[],tools:[],effects:0,states:[],owned:[]};
  let step=0,status=flowStatus,publishedVersionId=published?'v1':null;
  const mcp={call:async(_company,method,params)=>{
    if(method==='tools/list')return {tools:catalog};
    if(method==='initialize')return {instructions:'## Activepieces MCP Server\n1. Discover 2. Schema 3. Build 4. Validate 5. Publish'};
    log.tools.push([params.name,params.arguments]);
    if(Object.hasOwn(toolResults,params.name)){const value=toolResults[params.name];return typeof value==='function'?value(params.arguments):value;}
    if(params.name==='ap_build_flow')return {content:[{type:'text',text:`✅ Flow created (id: ${flowId})`}],structuredContent:{flowId,invalidSteps:[],skippedSteps:[],unknownProps:[]}};
    if(params.name==='ap_lock_and_publish'){status='ENABLED';publishedVersionId='v1';return {content:[{type:'text',text:'✅ published and enabled'}]};}
    return {content:[{type:'text',text:`ok ${params.name}`}]};
  }};
  const ctx={
    console:{error:()=>{},info:()=>{},warn:()=>{}},process:{env:{DEEPSEEK_API_KEY:'test-key'}},
    AbortController,setTimeout,clearTimeout,Date,JSON,String,Array,Object,Math,
    TenantProjectError,CompanyProfileError,builtFlowResult,conversationMemory,employeeMcpToolReady,scopeMcpTool,visibleMcpTool,
    fetch:async(url,options)=>{
      const request=JSON.parse(options.body);log.model.push(request);
      const message=script[Math.min(step++,script.length-1)];
      return {ok:true,json:async()=>({choices:[{message:typeof message==='function'?message(request):message}]})};
    },
    database:async()=>({connect:async()=>({query:async()=>({rows:[{locked:true}]}),release:()=>{}})}),
    companyProfiles:async()=>({
      findEmployee:async()=>({id:'employee-1',status:'draft',activepieces_flow_id:null}),
      linkEmployeeFlow:async({flowId:id})=>({recordId:'employee-1',flowId:id,name:'أمين المحتوى',status:'disabled'}),
      setEmployeeState:async({employeeId,status:next})=>{log.states.push([employeeId,next]);return {recordId:employeeId,flowId,name:'أمين المحتوى',status:next};},
    }),
    tenantProjects:async()=>({ownedFlow:async(_company,id)=>{log.owned.push(id);return {flow:{id,status,publishedVersionId}};}}),
    toolConnections:async()=>({assertOwnedExternal:async({externalId})=>{if(externalId==='foreign')throw new TenantProjectError('connection_not_owned','الاتصال لا يخص هذه الشركة.',403);}}),
  };
  const deepseekReply=runInNewContext(`${source.slice(start,end)}; deepseekReply`,ctx);
  const run=(extra={})=>deepseekReply({company:{name:'شركة'},settings:{},knowledge:{},team:[],history:[],message:'جهّز الموظف',mcp,companyId:'company-1',conversationId:'c1',deadlineMs:600_000,onEffectStart:()=>{log.effects++;},...extra});
  return {run,log};
}
const toolMessages=request=>request.messages.filter(item=>item.role==='tool').map(item=>item.content);

test('the model builds, validates and publishes in one request and writes the reply itself',async()=>{
  const {run,log}=setup({script:[
    use(['ap_list_connections',{}]),
    use(['ap_build_flow',{flowName:'أمين المحتوى',trigger:{pieceName:'schedule',triggerName:'every_week'},steps:[{type:'PIECE',displayName:'توليد'},{type:'PIECE',displayName:'Slack'},{type:'PIECE',displayName:'Gmail'}]}]),
    use(['ap_validate_flow',{flowId}],['ap_lock_and_publish',{flowId}]),
    say('بُنيت ثلاث خطوات ونُشرت.'),
  ]});
  const answer=await run({draftEmployee:{id:'employee-1',name:'أمين المحتوى',activepieces_flow_id:null}});
  assert.equal(answer.reply,'بُنيت ثلاث خطوات ونُشرت.');
  assert.equal(answer.flowId,flowId);
  assert.equal(answer.approval,undefined);
  assert.deepEqual(log.tools.map(item=>item[0]),['ap_list_connections','ap_build_flow','ap_validate_flow','ap_lock_and_publish']);
  assert.equal(log.tools[1][1].steps.length,3);
  assert.deepEqual(log.states,[['employee-1','active']]);
  assert.equal(answer.employee.status,'active');
  assert.ok(log.effects>=2);
  const first=log.model[0],last=log.model.at(-1);
  assert.deepEqual(first.thinking,{type:'enabled'});
  assert.match(first.messages[0].content,/## Activepieces MCP Server/);
  assert.ok(first.tools.some(tool=>tool.function.name==='ap_lock_and_publish'));
  assert.ok(!first.tools.some(tool=>tool.function.name==='ap_set_project_context'));
  assert.equal(toolMessages(last).length,4);
  assert.match(toolMessages(last)[1],/Flow created/);
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

test('a Flow built with no saved draft creates the employee under the name the model designed',async()=>{
  const names=[];
  const {run}=setup({script:[use(['ap_build_flow',{flowName:'أمين المحتوى الاجتماعي',trigger:{},steps:[]}]),say('بُنيت.')]});
  const answer=await run({createDraft:async name=>{names.push(name);return {id:'employee-1',name,activepieces_flow_id:null};}});
  assert.deepEqual(names,['أمين المحتوى الاجتماعي']);
  assert.equal(answer.employee.recordId,'employee-1');
  assert.equal(answer.flowId,flowId);
});

test('invalid calls and company boundaries are answered to the model without dispatch',async()=>{
  const {run,log}=setup({script:[
    use(['ap_set_project_context',{projectId:'other'}],['ap_unknown',{}],['ap_add_step','not json'],['ap_run_action',{pieceName:'gmail',actionName:'send_email',connectionExternalId:'foreign'}]),
    say('لم يُنفّذ شيء خارج مشروع الشركة.'),
  ]});
  const answer=await run();
  assert.equal(answer.reply,'لم يُنفّذ شيء خارج مشروع الشركة.');
  assert.deepEqual(log.tools,[]);
  const replies=toolMessages(log.model[1]);
  assert.equal(replies.length,4);
  assert.match(replies[0],/mcp_tool_invalid/);assert.match(replies[2],/mcp_arguments_invalid/);assert.match(replies[3],/connection_not_owned/);
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

test('selected employee chat stays on its own Flow and can still ask for a run',async()=>{
  const employee={id:'employee-9',name:'نور',status:'active',activepieces_flow_id:flowId};
  const {run,log}=setup({script:[use(['ap_add_step',{flowId:'G'.repeat(21)}],['ap_add_step',{}]),use(['siyadah_run_employee_flow',{}])]});
  const answer=await run({employee});
  assert.equal(answer.runRequested,true);
  assert.deepEqual(log.tools,[['ap_add_step',{flowId}]]);
  assert.match(toolMessages(log.model[1])[0],/employee_flow_scope/);
});

test('a long request answers queued once, keeps working, and settles the same request ID',async()=>{
  const chatStart=source.indexOf('async function publicChat('),chatEnd=source.indexOf('async function deepseek(req,res)',chatStart);
  const jsonStart=source.indexOf('function json(res,status,body,headers={})'),jsonEnd=source.indexOf('\n',jsonStart);
  assert.ok(chatStart>0&&chatEnd>chatStart&&jsonStart>0);
  const timers=[],settled=[],recorded=[];let release;
  const profiles={
    claimChatRequest:async()=>({claimed:true,claimToken:'t'}),
    settleChatRequest:async entry=>{settled.push(entry);return {status:entry.status,httpStatus:entry.httpStatus,response:entry.response};},
    read:async()=>({company_name:'شركة'}),readSettings:async()=>({}),ownedKnowledge:async()=>({}),listEmployees:async()=>[],listConversations:async()=>[],
    findConversationDraft:async()=>null,recordConversation:async entry=>{recorded.push(entry);},
  };
  const ctx={
    console:{error:()=>{},info:()=>{},warn:()=>{}},JSON,String,Object,Number,Array,Boolean,
    setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:id=>{if(timers[id-1])timers[id-1].cleared=true;},
    randomUUID:()=>'11111111-1111-4111-8111-111111111111',createHash:()=>({update(){return this;},digest:()=>'hash'}),
    TenantProjectError,CompanyProfileError,GmailPilotError:class extends Error{},GMAIL_PILOT_COMMAND:'pilot',
    body:async()=>({op:'message',message:'ابنِ طريقة عمل كاملة',conversation_id:'c1',request_id:'r1'}),
    tenantSession:async()=>({session:{companyId:'company-1'},account:{company_name:'شركة'},headers:{}}),
    companyProfiles:async()=>profiles,activepiecesMcp:async()=>({}),
    employeeRequestMode:()=>'explore',explicitNewEmployee:()=>false,flowName:()=>'x',
    completedWithoutExecution:(kind,response)=>({...response,request_status:'succeeded',outcome_kind:kind,work_status:'not_started'}),
    failedChatExecution:()=>({ok:true,request_status:'failed'}),
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
  assert.equal(recorded[0].assistantMessage,'بُنيت ونُشرت.');
  assert.ok(wait.cleared);
});
