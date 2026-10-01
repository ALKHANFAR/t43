const NO_EXECUTION_OUTCOMES=new Set(['conversation_reply','employee_draft']);

export function completedWithoutExecution(kind,response){
  if(!NO_EXECUTION_OUTCOMES.has(kind))throw new TypeError('invalid no-execution outcome');
  if(Object.hasOwn(response,'runId')||Object.hasOwn(response,'recent_work'))throw new TypeError('execution proof in no-execution outcome');
  if(kind==='employee_draft'&&response.employee?.status!=='disabled')throw new TypeError('employee draft must be disabled');
  return {...response,request_status:'succeeded',work_status:'not_started',outcome_kind:kind};
}
