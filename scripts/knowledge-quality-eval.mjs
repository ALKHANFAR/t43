import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {pathToFileURL} from 'node:url';
import {selectKnowledgeContext} from '../lib/knowledge-context.mjs';
import {createCumulativeMemory,MEMORY_TABLE,MEMORY_FIELDS,MEMORY_LIMITS} from '../lib/cumulative-memory.mjs';
import {TenantProjectError} from '../lib/tenant-projects.mjs';
import {CompanyProfileError} from '../lib/company-profile.mjs';
import {conversationMemory,draftOnlyIntent,doNotRunIntent} from '../lib/chat-intelligence.mjs';
import {employeeFlowMcpToolName,bindEmployeeFlowContext,scopeMcpTool} from '../lib/mcp-flow-scope.mjs';
import {nativeActionReceipt,flowTestSnapshot} from '../lib/chat-outcome.mjs';

const fact=(key,value,date='2026-10-07',topic='pricing')=>({key,value,topic,sourceUrl:`https://example.invalid/evidence/${key}`,certainty:'user_confirmed',observedAt:date});
export const QUALITY_CASES=[
  {id:'latest_price',question:'كم سعر الخدمة الحالي؟ أجب بالرقم فقط في answer.',facts:[fact('old_price','سعر الخدمة 100 حتى نهاية 2025.','2025-01-01'),fact('current_price','سعر الخدمة الحالي 120 من بداية 2026.')],answer:'120',evidence:['current_price']},
  {id:'older_needle',question:'كم سعر الاشتراك؟ أجب بالرقم فقط في answer.',facts:[...Array.from({length:75},(_,i)=>fact('noise_'+i,'ملاحظة روتينية '+i)),fact('subscription','سعر الاشتراك 199.')],answer:'199',evidence:['subscription']},
  {id:'multi_session',question:'كم مجموع مقاعد فرعي الرياض وجدة؟ أجب بالرقم فقط في answer.',facts:[fact('riyadh','فرع الرياض لديه 12 مقعدًا.','2026-09-01','offices'),fact('jeddah','فرع جدة لديه 8 مقاعد.','2026-10-01','offices')],answer:'20',evidence:['riyadh','jeddah']},
  {id:'historical_price',question:'كم كان سعر الخدمة في سنة 2025؟ أجب بالرقم فقط في answer.',facts:[fact('old_price','سعر الخدمة 100 حتى نهاية 2025.','2025-01-01'),fact('current_price','سعر الخدمة الحالي 120 من بداية 2026.')],answer:'100',evidence:['old_price']},
  {id:'missing_fact',question:'ما رقم الحساب البنكي للشركة؟',facts:[fact('current_price','سعر الخدمة 120.')],status:'unknown',evidence:[]},
  {id:'conflicting_sources',question:'كم سعر الخدمة الحالي؟ المصدران الحاليان متساويان في الاعتماد.',facts:[fact('source_a','سعر الخدمة الحالي 100.'),fact('source_b','سعر الخدمة الحالي 120.')],status:'conflict',evidence:['source_a','source_b']},
  {id:'employee_scope',question:'ما تفضيل أسلوب الرد للموظف الحالي؟ أجب بالكلمة فقط في answer.',facts:[],memories:[{scope:'employee',owner:'employee-a',key:'my_style',value:'تفضيل أسلوب الرد للموظف الحالي: موجز'},{scope:'employee',owner:'employee-b',key:'other_style',value:'تفضيل أسلوب الرد للموظف الآخر: مطول'}],main:{status:'unknown',evidence:[],forbiddenEvidence:['my_style','other_style']},employee:{answer:'موجز',evidence:['my_style'],forbiddenEvidence:['other_style']}},
];
const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const start=source.indexOf('async function deepseekReply('),end=source.indexOf('async function publicChat(',start);
if(start<0||end<=start)throw new Error('production chat loop was not found');
const TABLE='T'.repeat(21),toolNames=['ap_list_tables','ap_find_records','ap_insert_records','ap_update_record','ap_delete_records'];
const outputFormat='للقراءة فقط. أجب JSON فقط بالشكل {"status":"answered|unknown|conflict","answer":"قيمة مختصرة أو فارغة عند عدم الجزم","evidence_keys":["مفاتيح المعلومات الداعمة من السياق"]}. لا تختلق معلومة أو مصدرًا. evidence_keys هي القيم الحرفية للحقل key أو evidence_key في السياق أو نتيجة الأداة؛ لا تضف topic أو scope أو أي بادئة.';
const normalized=value=>String(value??'').normalize('NFKC').trim().replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
export function scoreQualityAnswer(reply,testCase,chat){
  const expected={status:'answered',...testCase,...testCase[chat]};let answer;
  try{answer=JSON.parse(String(reply).trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/,'$1'));}catch{return {passed:false,reasons:['invalid_json']};}
  const reasons=[];
  if(answer?.status!==expected.status)reasons.push('wrong_status');
  if(expected.status!=='answered'&&normalized(answer?.answer)!=='')reasons.push('unsupported_answer');
  if(expected.status==='answered'&&normalized(answer?.answer)!==normalized(expected.answer))reasons.push('wrong_answer');
  const evidence=answer?.evidence_keys;
  if(!Array.isArray(evidence)||evidence.some(key=>typeof key!=='string')||JSON.stringify([...new Set(evidence)].sort())!==JSON.stringify([...expected.evidence].sort()))reasons.push('unsupported_or_missing_evidence');
  return {passed:reasons.length===0,reasons};
}

// Reuse the real production chat loop. AP is a synthetic read-only fixture, never a live endpoint.
export async function evaluateKnowledgeCase({testCase,chat,live=false,apiKey='',fetchImpl=fetch}){
  const startedAt=Date.now();testCase.resetFixture?.();
  if(!['main','employee'].includes(chat))throw new TypeError('invalid chat');
  if(live&&!apiKey)throw new Error('missing_model_key');
  const companyId='quality-company',rows=(testCase.memories||[]).map((cells,i)=>({id:String(i).padStart(21,'0'),cells:{...cells,source_quote:cells.value,source_request:'synthetic-source',updated_at:'2026-10-07T10:00:00Z'}}));
  const catalog=rows.length?toolNames.map(name=>({name,annotations:{readOnlyHint:['ap_list_tables','ap_find_records'].includes(name)},inputSchema:{type:'object',properties:{}}})):[];
  catalog.push(...(testCase.tools||[]));const toolTrace=[];
  const mcp={call:async(_company,method,params)=>{
    if(_company!==companyId)throw new Error('wrong_tenant');
    if(method==='tools/list')return {tools:catalog};
    if(method==='initialize')return {};
    if(testCase.toolFixture){const result=await testCase.toolFixture(params,toolTrace);if(result!==undefined){toolTrace.push({name:params.name,args:params.arguments,result});return result;}}
    if(params.name==='ap_list_tables')return {structuredContent:{tables:[{id:TABLE,name:MEMORY_TABLE,rowCount:rows.length,fields:MEMORY_FIELDS.map(name=>({name,type:'TEXT'}))}],count:1}};
    if(params.name==='ap_find_records'){
      if(params.arguments.tableId!==TABLE)throw new Error('wrong_table');
      const records=rows.filter(row=>!(params.arguments.filters||[]).some(f=>row.cells[f.fieldName]!==f.value)).slice(0,params.arguments.limit||128);
      return {structuredContent:{records,count:records.length}};
    }
    throw new Error('fixture_effect_rejected');
  }};
  let captured,modelCalls=0;const usage=[];
  const modelFetch=async(url,options)=>{
    if(url!=='https://api.deepseek.com/chat/completions')throw new Error('unexpected_model_endpoint');
    const request=JSON.parse(options.body);captured=request;modelCalls++;
    if(modelCalls>(testCase.maxModelCalls||3))throw new Error('quality_model_call_budget');
    if(!live)return {ok:true,status:200,json:async()=>({choices:[{message:{content:'{"status":"unknown","answer":"","evidence_keys":[]}'}}]})};
    const response=await fetchImpl(url,{...options,body:JSON.stringify({...request,max_tokens:4096})});const data=await response.json();usage.push({model:data.model||null,tokens:data.usage?.total_tokens||null});
    return {ok:response.ok,status:response.status,json:async()=>data};
  };
  const context={console:{info:()=>{},warn:()=>{},error:()=>{}},process:{env:{DEEPSEEK_API_KEY:apiKey||'offline-fixture'}},AbortController,setTimeout,clearTimeout,fetch:modelFetch,
    selectKnowledgeContext,createCumulativeMemory,MEMORY_TABLE,MEMORY_FIELDS,MEMORY_LIMITS,TenantProjectError,CompanyProfileError,conversationMemory,draftOnlyIntent,doNotRunIntent,employeeFlowMcpToolName,bindEmployeeFlowContext,scopeMcpTool,nativeActionReceipt,flowTestSnapshot};
  Object.assign(context,testCase.services||{});
  const run=runInNewContext(source.slice(start,end)+';deepseekReply',context);
  const answer=await run({company:{name:'شركة اختبار اصطناعية'},settings:{},knowledge:{facts:testCase.facts},team:[],history:testCase.history||[],message:(testCase.answerFormat||(testCase.allowSyntheticEffects?outputFormat.replace('للقراءة فقط. ',''):outputFormat))+'\n'+testCase.question,employee:chat==='employee'?testCase.employeeFixture||{id:'employee-a',name:'موظف الاختبار',status:'draft',prompt:'أجب بدقة من المصادر المتاحة.'}:null,mcp,companyId,conversationId:'quality-'+testCase.id,memoryRequestId:'quality-'+testCase.id,deadlineMs:testCase.deadlineMs||60_000,onEffectStart:()=>{if(!testCase.allowSyntheticEffects)throw new Error('quality_effect_rejected');}});
  const system=captured.messages[0].content,knowledge=JSON.parse(system.split('سياق العمل الحالي بصيغة JSON:\n')[1].split('\n')[0]).knowledge;
  const memoryLine=system.split('\n').find(line=>line.startsWith('ذاكرة تراكمية موثقة'));
  const memories=memoryLine?JSON.parse(memoryLine.slice(memoryLine.indexOf(': ')+2)):[];
  const expected={...testCase,...testCase[chat]},keys=new Set([...knowledge.facts,...memories].map(f=>f.key));
  return {id:testCase.id,chat,mode:live?'live_model_synthetic_AP':'retrieval_only',context_passed:(expected.contextEvidence||expected.evidence).every(key=>keys.has(key))&&!(expected.forbiddenEvidence||[]).some(key=>keys.has(key)),...(live?{answer_quality:testCase.scoreAnswer?testCase.scoreAnswer(answer.reply,toolTrace):scoreQualityAnswer(answer.reply,testCase,chat)}:{}),elapsedMs:Date.now()-startedAt,effects:answer.effects.length,...(testCase.toolFixture?{tool_trace:toolTrace,workflow_passed:live?testCase.verifyTrace(toolTrace,answer,chat):null}:{}),modelCalls:live?modelCalls:0,usage};
}
export async function runQualitySuite({live=false,apiKey=process.env.DEEPSEEK_API_KEY||'',fetchImpl=fetch,cases=QUALITY_CASES}={}){
  if(live&&!apiKey)return {mode:'live_unavailable',reason:'missing_model_key',modelCasesRun:0,results:[]};
  const results=[];
  for(const testCase of cases)for(const chat of ['main','employee']){
    try{results.push(await evaluateKnowledgeCase({testCase,chat,live,apiKey,fetchImpl}));}
    catch{return {mode:live?'live_incomplete':'retrieval_incomplete',reason:'evaluation_failed',modelCasesRun:results.filter(r=>r.mode==='live_model_synthetic_AP').length,results};}
  }
  return {mode:live?'live_model_synthetic_AP':'retrieval_only',modelCasesRun:live?results.length:0,results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2);
  if(args.some(arg=>arg!=='--live')||args.length>1){process.stdout.write(JSON.stringify({reason:'arguments_not_supported'})+'\n');process.exitCode=2;}
  else{const report=await runQualitySuite({live:args.includes('--live')});process.stdout.write(JSON.stringify(report,null,2)+'\n');process.exitCode=report.mode.endsWith('incomplete')||report.mode==='live_unavailable'?2:report.results.some(r=>!r.context_passed||r.effects||r.answer_quality?.passed===false)?1:0;}
}
