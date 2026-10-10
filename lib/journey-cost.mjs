// Provider-reported usage only. A dated, reviewed price sheet is supplied by the operator.
// Missing usage or prices remain unknown; never treat them as zero.
export function measureJourney(records,price,{localOnly=false}={}){
  const unknown=[];let usd=0,prompt=0,completion=0,cached=0;
  const seen=new Set();
  if(!records.length&&!localOnly)unknown.push('no_provider_usage_evidence');
  for(const row of records){
    const id=JSON.stringify([row.company_id,row.request_id,row.conversation_id,row.model_call]);
    if(!row.request_id||!row.company_id||!Number.isInteger(row.model_call)||row.model_call<1||seen.has(id)){unknown.push('missing_or_duplicate_call_identity');continue;}
    seen.add(id);
    const counts=[row.prompt_tokens,row.completion_tokens,row.cache_hit_tokens];
    if(counts.some(n=>!Number.isInteger(n)||n<0)||row.cache_hit_tokens>row.prompt_tokens){unknown.push('provider_usage_incomplete');continue;}
    prompt+=row.prompt_tokens;completion+=row.completion_tokens;cached+=row.cache_hit_tokens;
    const rates=[price?.input_uncached,price?.input_cached,price?.output];
    const at=Number.isFinite(row.observed_at_ms)?row.observed_at_ms:Date.parse(row.observed_at),start=Date.parse(price?.valid_from),end=Date.parse(price?.valid_until);
    if(price?.model!==row.model||!price?.source||!Number.isFinite(at)||!Number.isFinite(start)||!Number.isFinite(end)||at<start||at>=end||rates.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0)){
      unknown.push('reviewed_price_unavailable');continue;
    }
    usd+=((row.prompt_tokens-row.cache_hit_tokens)*rates[0]+row.cache_hit_tokens*rates[1]+row.completion_tokens*rates[2])/1e6;
  }
  return {model_calls:records.length,prompt_tokens:prompt,completion_tokens:completion,cached_tokens:cached,model_cost_usd:unknown.length?null:usd,cost_status:unknown.length?'unmeasured':'provider_usage_with_reviewed_prices',unknown:[...new Set(unknown)],external_tool_cost:'not_included'};
}
