import test from 'node:test';
import assert from 'node:assert/strict';
import {stressCases,REPORT_TOOL} from './employee-stress-eval.mjs';
import {evaluateKnowledgeCase} from './knowledge-quality-eval.mjs';
const TABLE='Q'.repeat(21);
function scripted(steps){let i=0;return async()=>({ok:true,status:200,json:async()=>({model:'fixture',choices:[{message:steps[i++]}]})});}
const call=(name,args={})=>({content:'',tool_calls:[{id:name+Math.random(),function:{name,arguments:JSON.stringify(args)}}]});
const final=key=>({content:JSON.stringify({status:'answered',answer:'350',evidence_keys:[key]})});
test('stress simulation cannot pass a fabricated correct answer without tool execution',async()=>{
 const c=stressCases().find(c=>c.id==='effect_then_independent_readback');
 const r=await evaluateKnowledgeCase({testCase:c,chat:'main',live:true,apiKey:'fixture',fetchImpl:scripted([final('verified_total')])});
 assert.equal(r.answer_quality.passed,true);assert.equal(r.workflow_passed,false);assert.equal(r.effects,0);
});
test('simulated effect needs one execution and independent exact run readback in both chats',async()=>{
 const c=stressCases().find(c=>c.id==='effect_then_independent_readback');
 for(const chat of ['main','employee']){
 const r=await evaluateKnowledgeCase({testCase:c,chat,live:true,apiKey:'fixture',fetchImpl:scripted([call('ap_list_tables'),call(REPORT_TOOL),call('ap_find_records',{tableId:TABLE,filters:[{fieldName:'runId',operator:'EQ',value:'R'.repeat(21)}]}),final('verified_total')])});
 assert.equal(r.workflow_passed,true);assert.equal(r.effects,1);assert.equal(r.answer_quality.passed,true);
 }
});
test('temporary read failure must be recovered before aggregation can pass',async()=>{
 const c=stressCases().find(c=>c.id==='read_failure_recovery');
 const r=await evaluateKnowledgeCase({testCase:c,chat:'main',live:true,apiKey:'fixture',fetchImpl:scripted([call('ap_list_tables'),call('ap_find_records',{tableId:TABLE}),call('ap_find_records',{tableId:TABLE}),final('invoice_total')])});
 assert.equal(r.workflow_passed,true);assert.equal(r.effects,0);assert.equal(r.tool_trace[1].result.isError,true);assert.equal(r.answer_quality.passed,true);
});

test('employee flow receives server context even when the model supplies forged employee context',async()=>{
 const c=stressCases().find(c=>c.id==='effect_then_independent_readback');
 const r=await evaluateKnowledgeCase({testCase:c,chat:'employee',live:true,apiKey:'fixture',fetchImpl:scripted([call('ap_list_tables'),call(REPORT_TOOL,{siyadahContext:{context:{selectedEmployee:{id:'employee-b'}}}}),call('ap_find_records',{tableId:TABLE,filters:[{fieldName:'runId',value:'R'.repeat(21)}]}),final('verified_total')])});
 const injected=r.tool_trace.find(t=>t.name===REPORT_TOOL).args.siyadahContext;
 assert.equal(injected.context.selectedEmployee.id,'employee-a');assert.equal(injected.context.company.name,'شركة اختبار اصطناعية');assert.equal(injected.context.knowledge.facts[0].key,'obsolete_total');assert.match(injected.request,/نفذ فلو التقرير/);assert.equal(r.workflow_passed,true);
});
test('wrong version, foreign flow and failed native run never persist a completed employee run',async()=>{
 const {integrityCases}=await import('./employee-stress-eval.mjs');
 for(const c of integrityCases()){
 let persisted=0;c.services.companyProfiles=async()=>({recordEmployeeRun:async()=>{persisted++;throw Error('must not persist');}});
 const r=await evaluateKnowledgeCase({testCase:c,chat:'employee',live:true,apiKey:'fixture',fetchImpl:scripted([call('ap_list_tables'),call(REPORT_TOOL),call('ap_find_records',{tableId:TABLE,filters:[{fieldName:'runId',value:'R'.repeat(21)}]}),{content:'{"status":"unknown","answer":"","evidence_keys":[]}'}])});
 assert.equal(persisted,0,c.id);assert.equal(r.workflow_passed,true,c.id);assert.equal(r.answer_quality.passed,true,c.id);assert.equal(r.effects,1,c.id);
 }
});
test('repeated employee flow request is blocked before a second synthetic invocation',async()=>{
 const c=stressCases().find(c=>c.id==='effect_then_independent_readback');
 const r=await evaluateKnowledgeCase({testCase:c,chat:'employee',live:true,apiKey:'fixture',fetchImpl:scripted([call('ap_list_tables'),call(REPORT_TOOL),call(REPORT_TOOL),call('ap_find_records',{tableId:TABLE,filters:[{fieldName:'runId',value:'R'.repeat(21)}]}),final('verified_total')])});
 assert.equal(r.tool_trace.filter(t=>t.name===REPORT_TOOL).length,1);assert.equal(r.effects,1);assert.equal(r.workflow_passed,true);
});

test('valid independent readback may succeed without a prescribed catalog discovery sequence',async()=>{
 const c=stressCases().find(c=>c.id==='effect_then_independent_readback');
 const r=await evaluateKnowledgeCase({testCase:c,chat:'employee',live:true,apiKey:'fixture',fetchImpl:scripted([call(REPORT_TOOL),final('verified_total')])});
 assert.equal(r.workflow_passed,true);assert.equal(r.tool_trace.some(t=>t.name==='ap_list_tables'),false);assert.equal(r.tool_trace.some(t=>t.name==='ap_get_run'),true);
});
test('outcome composition accepts alternative useful tools and identifies missing connections without fixing a tool count',async()=>{
 const {intentCompositionCase}=await import('./employee-stress-eval.mjs'),c=intentCompositionCase(),trace=[{name:'ap_search_actions'},{name:'ap_list_connections'}];
 const plan={status:'draft',steps:['gmail_read','deepseek_qualify','ap_record','gmail_followup','slack_handoff'].map(action_id=>({action_id,reason:'يحقق متابعة العميل'})),connection_requests:['gmail'],success_measure:'نسبة العملاء الذين تلقوا متابعة موثقة'};
 assert.equal(c.scoreAnswer(JSON.stringify(plan),trace).passed,true);
 assert.equal(c.scoreAnswer('```json\n'+JSON.stringify(plan)+'\n```',trace).passed,true);
 plan.steps.push({action_id:'asana_handoff',reason:'إسناد الحالات التي تحتاج تدخلًا'});plan.connection_requests.push('asana');assert.equal(c.scoreAnswer(JSON.stringify(plan),trace).passed,true);
 plan.connection_requests=[];assert.equal(c.scoreAnswer(JSON.stringify(plan),trace).passed,false);
 assert.equal(c.scoreAnswer('null',trace).passed,false);assert.equal(c.scoreAnswer('{"steps":{}}',trace).passed,false);
});

test('known wrong version can be rejected from its explicit receipt without forcing unnecessary reads',async()=>{
 const {integrityCases}=await import('./employee-stress-eval.mjs'),c=integrityCases().find(c=>c.id==='wrong_version');
 const r=await evaluateKnowledgeCase({testCase:c,chat:'main',live:true,apiKey:'fixture',fetchImpl:scripted([call(REPORT_TOOL),{content:'{"status":"unknown","answer":"","evidence_keys":[]}'}])});
 assert.equal(r.workflow_passed,true);assert.equal(r.answer_quality.passed,true);assert.equal(r.tool_trace.length,1);
});

function builtPlan(){return {status:'draft',steps:['gmail_read','deepseek_qualify','ap_record','gmail_followup','slack_handoff'].map(action_id=>({action_id,reason:'متابعة العميل وتوثيق نتيجته'})),connection_requests:['gmail'],success_measure:'نسبة العملاء الذين تلقوا متابعة موثقة'};}
function buildScript(plan,{brokenDependency=false,omitRead=false,omitBusinessGuard=false}={}){
 const steps=plan.steps.map((s,i)=>({...s,input_from:i?plan.steps[i-1].action_id:null}));if(brokenDependency)steps[2].input_from='missing_action';
 if(!omitBusinessGuard)for(const s of steps.filter(s=>['gmail_followup','slack_handoff'].includes(s.action_id))){s.guard={source:'deepseek_qualify',field:'qualified',equals:true};s.bindings={lead_id:'gmail_read.lead_id'};}
 return [call('ap_search_actions',{query:'lead recovery'}),call('ap_list_connections'),call('ap_build_flow',{flowName:'استرجاع العملاء',steps}),...omitRead?[]:[call('ap_get_flow',{flowId:'F'.repeat(21)})],{content:JSON.stringify(plan)}];
}
test('both chats build through the real lifecycle and independently read the connected stored draft',async()=>{
 const {draftBuildCase}=await import('./employee-stress-eval.mjs');
 for(const chat of ['main','employee']){
 const r=await evaluateKnowledgeCase({testCase:draftBuildCase(),chat,live:true,apiKey:'fixture',fetchImpl:scripted(buildScript(builtPlan()))});
 assert.equal(r.answer_quality.passed,true,chat);assert.equal(r.workflow_passed,true,chat);assert.equal(r.effects,1,chat);
 }
});
test('a good final plan cannot hide omitted readback, a missing dependency, a verbal-only condition, or a lost stored step',async()=>{
 const {draftBuildCase}=await import('./employee-stress-eval.mjs');
 for(const [fixture,script] of [[{}, {omitRead:true}],[{}, {brokenDependency:true}],[{}, {omitBusinessGuard:true}],[{corruptReadback:true}, {}]]){
 const r=await evaluateKnowledgeCase({testCase:draftBuildCase(fixture),chat:'employee',live:true,apiKey:'fixture',fetchImpl:scripted(buildScript(builtPlan(),script))});
 assert.equal(r.answer_quality.passed,true);assert.equal(r.workflow_passed,false);
 }
});

test('draft grading uses the last readback and rejects a subsequently changed stored graph',async()=>{
 const {draftBuildCase}=await import('./employee-stress-eval.mjs'),c=draftBuildCase();
 const fixture=c.toolFixture;let reads=0;
 c.toolFixture=async(...args)=>{const result=await fixture(...args);if(args[0].name==='ap_get_flow'&&++reads===2)result.structuredContent.version.steps.pop();return result;};
 const script=buildScript(builtPlan());script.splice(-1,0,call('ap_get_flow',{flowId:'F'.repeat(21)}));
 const r=await evaluateKnowledgeCase({testCase:c,chat:'employee',live:true,apiKey:'fixture',fetchImpl:scripted(script)});
 assert.equal(r.answer_quality.passed,true);assert.equal(r.workflow_passed,false);
});
test('independent trials evaluate both chats and retain failure after later successful trials',async()=>{
 const {runStressSuite}=await import('./employee-stress-eval.mjs');
 const bad=buildScript(builtPlan());bad[bad.length-1]={content:'not JSON'};
 const sequence=[...bad,...buildScript(builtPlan()),...buildScript(builtPlan()),...buildScript(builtPlan())];
 const r=await runStressSuite({build:true,live:true,apiKey:'fixture',trials:2,fetchImpl:scripted(sequence)});
 assert.equal(r.summary.total,4);assert.equal(r.summary.passed,3);assert.equal(r.trials.completed,2);
 assert.deepEqual(r.results.map(x=>[x.trial,x.chat]),[[1,'main'],[1,'employee'],[2,'main'],[2,'employee']]);
 assert.equal(r.results[0].answer_quality.passed,false);assert.equal(r.results[2].workflow_passed,true);
 assert.deepEqual(r.trials.chats,[{chat:'main',evaluated:2,passed:1,failed:1},{chat:'employee',evaluated:2,passed:2,failed:0}]);
});
test('missing live key reports unavailable without model calls or successful trials',async()=>{
 const {runStressSuite}=await import('./employee-stress-eval.mjs');let calls=0;
 const r=await runStressSuite({build:true,live:true,apiKey:'',trials:3,fetchImpl:async()=>{calls++;throw Error('must not call');}});
 assert.equal(r.mode,'live_unavailable');assert.equal(r.reason,'missing_model_key');assert.equal(r.modelCasesRun,0);assert.equal(calls,0);
 assert.equal(r.trials.requested,3);assert.equal(r.trials.completed,0);assert.equal(r.summary.passed,0);
 await assert.rejects(()=>runStressSuite({trials:11}),/invalid_trial_count/);
});
