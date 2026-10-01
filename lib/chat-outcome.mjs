const NO_EXECUTION_OUTCOMES=new Set(['conversation_reply','employee_draft']);

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
