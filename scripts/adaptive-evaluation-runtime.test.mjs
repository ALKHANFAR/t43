import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateExperience,EXPERIENCE_CASES} from './adaptive-experience-eval.mjs';
test('preparation and missing credentials never count as real model quality evidence',async()=>{
  assert.equal(EXPERIENCE_CASES.length,20);
  const prepared=await evaluateExperience();assert.equal(prepared.modelCasesRun,0);assert.equal(prepared.quality_verified,false);
  const unavailable=await evaluateExperience({live:true,apiKey:''});assert.equal(unavailable.mode,'live_unavailable');assert.equal(unavailable.modelCasesRun,0);
});
test('real loop evaluation records model replies and usage but still requires human and provider acceptance',async()=>{
  const report=await evaluateExperience({live:true,apiKey:'synthetic-test-key',cases:EXPERIENCE_CASES.slice(0,1),fetchImpl:async()=>({ok:true,status:200,json:async()=>({usage:{prompt_tokens:100,completion_tokens:10,prompt_cache_hit_tokens:0},choices:[{message:{content:'الاسترجاع خلال 14 يومًا.'}}]})})});
  assert.equal(report.modelCasesRun,2);assert.equal(report.quality_verified,false);assert.equal(report.provider_execution_verified,false);
  assert.ok(report.results.every(r=>r.reply==='الاسترجاع خلال 14 يومًا.'&&r.usage[0].prompt_tokens===100&&r.cost.model_cost_usd===null));
});
