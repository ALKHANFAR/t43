const words=value=>new Set(String(value||'').normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').match(/[\p{L}\p{N}]{2,}/gu)||[]);

// Text retrieval over already tenant-scoped facts; AP remains the persistent memory owner.
// No embeddings, model calls, or provider writes occur here.
export function selectKnowledgeContext(facts,{message='',topics=[],maxFacts=40,maxChars=6000,minScore=0}={}){
  if(!Number.isSafeInteger(maxFacts)||maxFacts<0||!Number.isSafeInteger(maxChars)||maxChars<2||!Number.isFinite(minScore)||minScore<0)throw new TypeError('invalid knowledge context budget');
  const query=words(message),preferred=new Set(Array.isArray(topics)?topics:[]);
  const ranked=(Array.isArray(facts)?facts:[]).filter(fact=>fact&&typeof fact==='object'&&!Array.isArray(fact)).map((fact,index)=>{
    const vocabulary=words([fact.key,fact.topic,typeof fact.value==='string'?fact.value:JSON.stringify(fact.value)].join(' '));
    return {fact,index,score:[...query].filter(word=>vocabulary.has(word)).length,preferred:preferred.has(fact.topic)?1:0,time:Date.parse(fact.updatedAt||fact.observedAt||'')||0};
  }).sort((a,b)=>b.score-a.score||b.preferred-a.preferred||b.time-a.time||a.index-b.index);
  const selected=[];let chars=2;
  for(const {fact,score} of ranked){
    if(score<minScore)continue;
    if(selected.length>=maxFacts)break;
    const size=JSON.stringify(fact).length+(selected.length?1:0);
    if(chars+size>maxChars)continue;
    selected.push(fact);chars+=size;
  }
  return selected;
}
