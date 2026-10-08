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
