// The conversation queue and execution share one lifetime below the ledger's 15-minute expiry.
export function chatExecutionBudget(acceptedAt,now=Date.now()){return Math.max(1,Math.min(600_000,720_000-(now-acceptedAt)));}

const NO_EXECUTION_OUTCOMES=new Set(['conversation_reply','employee_draft']);

// Native ActionRun receipts are not persisted FlowRuns or business/KPI proof.
export function nativeActionReceipt(name,result){
  const receipt={name,status:result?.isError===true?'error':'returned'};
  if(name!=='ap_run_action'||result?.isError===true)return receipt;
  const raw=(result?.content||[]).filter(item=>item?.type==='text').map(item=>item.text).join('\n');
  const match=/^✅ [^\n]+ completed \(run ([A-Za-z0-9]{21})\)/.exec(raw);
  if(!match)return receipt;
  receipt.run_id=match[1];receipt.outcome='unverified';
  if(/\bHTTP\s+[345]\d\d\b/i.test(raw.split('\n')[0]))return receipt;
  const output=raw.slice(raw.indexOf('\n\n')+2).trim();
  let parsed;try{parsed=JSON.parse(output);}catch{return receipt;}
  const failed=value=>value&&typeof value==='object'&&(
    Object.entries(value).some(([key,item])=>/^(?:status|statusCode|httpStatus)$/.test(key)&&Number.isInteger(item)&&(item<200||item>=300))||
    value.success===false||value.ok===false||Object.hasOwn(value,'error')&&Boolean(value.error)||
    Object.values(value).some(item=>item&&typeof item==='object'&&failed(item)));
  if(parsed!==null&&parsed!==false&&!failed(parsed))receipt.outcome='action_completed';
  return receipt;
}

export function completedToolActions(answer){
  const attempted=answer.toolReceipts?.filter(receipt=>receipt.effect_attempted)||[];
  return answer.effects?.length>0&&answer.effects.every(name=>name==='ap_run_action')&&
    attempted.length===answer.effects.length&&attempted.every(receipt=>receipt.name==='ap_run_action'&&receipt.outcome==='action_completed')?
    {request_status:'succeeded',work_status:'succeeded',outcome_kind:'tool_result'}:
    {request_status:'not_observed',work_status:'unknown',outcome_kind:'unverified'};
}

export function completedWithoutExecution(kind,response){
  if(!NO_EXECUTION_OUTCOMES.has(kind))throw new TypeError('invalid no-execution outcome');
  if(Object.hasOwn(response,'runId')||Object.hasOwn(response,'recent_work'))throw new TypeError('execution proof in no-execution outcome');
  if(kind==='employee_draft'&&response.employee?.status!=='disabled')throw new TypeError('employee draft must be disabled');
  return {...response,request_status:'succeeded',work_status:'not_started',outcome_kind:kind};
}

export function failedChatExecution({conversationId,requestId,effectStarted,executionAttempt,transportReceipt}){
  const receipt=effectStarted&&transportReceipt?.outcome==='unverified'&&/^[A-Za-z0-9]{21}$/.test(String(transportReceipt.runId||''))?
    {runId:transportReceipt.runId,httpStatus:Number.isInteger(transportReceipt.httpStatus)?transportReceipt.httpStatus:null,receivedAt:typeof transportReceipt.receivedAt==='string'?transportReceipt.receivedAt:null,outcome:'unverified'}:null;
  const reply=receipt&&receipt.httpStatus!==null?'وصل رد الأداة، لكن نتيجتها النهائية قيد التحقق. لم نعد تنفيذ المهمة.':receipt?'وجدنا سجل تشغيل المهمة، لكن رد الأداة غير مؤكد. لم نعد تنفيذها.':effectStarted?'بدأت محاولة إرسال المهمة، لكن لم نؤكد وصولها أو نتيجتها. لم نعد تنفيذها.':executionAttempt?'لم يبدأ تنفيذ المهمة. تحقّق من جاهزية الموظف وطريقة عمله ثم حاول بطلب جديد.':'تعذّر إكمال الطلب. لم نعد تنفيذه.';
  return {ok:true,conversation_id:conversationId,request_status:effectStarted?'not_observed':'failed',work_status:effectStarted?'unknown':'failed',outcome_kind:'unverified',work_id:`request_${requestId}`,reply,...(receipt?{transport_receipt:receipt}:{})};
}
