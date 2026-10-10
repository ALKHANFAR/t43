import test from 'node:test';
import assert from 'node:assert/strict';
import {QUALITY_CASES,scoreQualityAnswer,evaluateKnowledgeCase,runQualitySuite} from './knowledge-quality-eval.mjs';

test('quality retrieval suite exercises both production chat contexts without scoring a fake model',async()=>{
  const report=await runQualitySuite({fetchImpl:()=>{throw Error('network forbidden');}});
  assert.equal(report.mode,'retrieval_only');assert.equal(report.modelCasesRun,0);assert.equal(report.results.length,QUALITY_CASES.length*2);
  assert.ok(report.results.every(r=>r.context_passed&&r.effects===0&&r.modelCalls===0&&!Object.hasOwn(r,'answer_quality')));
});
test('missing DeepSeek key reports unavailable rather than a passing answer score',async()=>{
  const report=await runQualitySuite({live:true,apiKey:'',fetchImpl:()=>{throw Error('network forbidden');}});
  assert.equal(report.mode,'live_unavailable');assert.equal(report.reason,'missing_model_key');assert.equal(report.modelCasesRun,0);assert.deepEqual(report.results,[]);
});
test('quality scorer rejects outdated answers, fabricated citations, false abstention and malformed output',()=>{
  const price=QUALITY_CASES.find(c=>c.id==='latest_price'),missing=QUALITY_CASES.find(c=>c.id==='missing_fact');
  const score=(answer,c=price)=>scoreQualityAnswer(JSON.stringify(answer),c,'main');
  assert.equal(score({status:'answered',answer:'120',evidence_keys:['current_price']}).passed,true);
  assert.equal(score({status:'answered',answer:'100',evidence_keys:['current_price']}).passed,false);
  assert.equal(score({status:'answered',answer:'120',evidence_keys:['fabricated']}).passed,false);
  assert.equal(score({status:'answered',answer:'120',evidence_keys:['pricing:current_price']}).passed,false);
  assert.equal(scoreQualityAnswer(JSON.stringify({status:'answered',answer:'20',evidence_keys:['riyadh']}),QUALITY_CASES.find(c=>c.id==='multi_session'),'employee').passed,false);
  assert.equal(score({status:'unknown',answer:'120',evidence_keys:[]},missing).passed,false);
  assert.equal(score({status:'unknown',answer:'',evidence_keys:[]},missing).passed,true);
  assert.equal(scoreQualityAnswer('not JSON',price,'main').passed,false);
});
test('cross-language cases retain the policy source in both chats and reject the wrong answer language',async()=>{
  const cases=QUALITY_CASES.filter(c=>['arabic_question_english_source','english_question_arabic_source'].includes(c.id));
  assert.equal(cases.length,2);
  const report=await runQualitySuite({cases,fetchImpl:()=>{throw Error('network forbidden');}});
  assert.equal(report.results.length,4);
  assert.ok(report.results.every(r=>r.context_passed&&r.effects===0&&!Object.hasOwn(r,'answer_quality')));
  for(const c of cases)for(const chat of ['main','employee']){
    const reply=answer=>JSON.stringify({status:'answered',answer,evidence_keys:['refund_policy']});
    assert.equal(scoreQualityAnswer(reply(c.answer),c,chat).passed,true);
    assert.equal(scoreQualityAnswer(reply(c.answer==='14 days'?'14 يومًا':'14 days'),c,chat).passed,false);
    assert.equal(scoreQualityAnswer(JSON.stringify({status:'answered',answer:c.answer,evidence_keys:['parking']}),c,chat).passed,false);
  }
});
test('model quality harness uses actual chat request, scoped AP memory and bounded DeepSeek call',async()=>{
  const c=QUALITY_CASES.find(c=>c.id==='employee_scope');let calls=0;
  const report=await evaluateKnowledgeCase({testCase:c,chat:'employee',live:true,apiKey:'synthetic-test-key',fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://api.deepseek.com/chat/completions');
    const body=JSON.parse(options.body);assert.equal(body.model,'deepseek-v4-pro');assert.equal(body.reasoning_effort,'high');assert.equal(body.max_tokens,4096);
    const prompt=body.messages[0].content;assert.match(prompt,/my_style/);assert.doesNotMatch(prompt,/other_style|مطول/);
    return {ok:true,status:200,json:async()=>({model:'synthetic-model',usage:{total_tokens:50},choices:[{message:{content:'{"status":"answered","answer":"موجز","evidence_keys":["my_style"]}'}}]})};
  }});
  assert.equal(calls,1);assert.equal(report.answer_quality.passed,true);assert.equal(report.effects,0);assert.equal(report.mode,'live_model_synthetic_AP');
});
test('read-only evaluation refuses a model-requested write before the AP fixture can mutate',async()=>{
  let calls=0;const c=QUALITY_CASES.find(c=>c.id==='employee_scope');
  const result=await evaluateKnowledgeCase({testCase:c,chat:'employee',live:true,apiKey:'synthetic-test-key',fetchImpl:async(_url,options)=>{
    const body=JSON.parse(options.body);calls++;
    const message=calls===1?{content:'',tool_calls:[{id:'forbidden-write',function:{name:'ap_insert_records',arguments:JSON.stringify({tableId:'T'.repeat(21),records:[{scope:'company',key:'invented',value:'wrong'}]})}}]}:{content:'{"status":"answered","answer":"موجز","evidence_keys":["my_style"]}'};
    if(calls===2)assert.match(body.messages.find(m=>m.role==='tool').content,/chat_read_only/);
    return {ok:true,status:200,json:async()=>({choices:[{message}]})};
  }});
  assert.equal(calls,2);assert.equal(result.effects,0);assert.equal(result.answer_quality.passed,true);
});
test('provider failure reports an incomplete evaluation and cannot produce a quality pass',async()=>{
  const report=await runQualitySuite({live:true,apiKey:'synthetic-test-key',cases:[QUALITY_CASES[0]],fetchImpl:async()=>({ok:false,status:503,json:async()=>({})})});
  assert.equal(report.mode,'live_incomplete');assert.equal(report.modelCasesRun,0);assert.deepEqual(report.results,[]);
});
