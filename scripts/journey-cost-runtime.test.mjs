import test from 'node:test';
import assert from 'node:assert/strict';
import {measureJourney} from '../lib/journey-cost.mjs';
const row={company_id:'synthetic-company',request_id:'r1',conversation_id:'c1',model_call:1,model:'fixture',observed_at:'2026-10-10T00:00:00Z',prompt_tokens:1000,cache_hit_tokens:400,completion_tokens:200};
const price={model:'fixture',source:'synthetic test rates, not real DeepSeek pricing',valid_from:'2026-10-01',valid_until:'2026-11-01',input_uncached:2,input_cached:1,output:3};
test('journey cost counts cached usage separately and refuses unknown or duplicate evidence',()=>{
  assert.equal(measureJourney([row],price).model_cost_usd,0.0022);
  for(const records of [[{...row,cache_hit_tokens:undefined}],[row,row],[{...row,request_id:null}]])assert.equal(measureJourney(records,price).model_cost_usd,null);
  assert.equal(measureJourney([row],{...price,valid_until:'2026-10-02'}).model_cost_usd,null);
  assert.equal(measureJourney([row],null).model_cost_usd,null);
  assert.equal(measureJourney([],null).model_cost_usd,null,'missing journey logs cannot prove zero cost');
  assert.equal(measureJourney([],null,{localOnly:true}).model_cost_usd,0,'explicitly local UI has zero model token cost');
});
