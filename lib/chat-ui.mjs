// Presentation only: derives UI from server-owned response metadata, with no model or tool calls.
const text=value=>typeof value==='string'?value:null;
export function chatUiForResponse(response){
  if(!response||response.ok!==true||typeof response.conversation_id!=='string')return null;
  const components=[],actions=[],employee=response.employee;
  if(employee&&text(employee.recordId)&&text(employee.name)){
    components.push({type:'employee',title:employee.name,role:text(employee.role)||'',employee_id:employee.recordId,state:employee.status==='active'?'active':employee.flowId?'paused':'draft',skills:Array.isArray(employee.tools)?employee.tools.filter(x=>typeof x==='string'):[]});
    for(const operation_id of ['edit_employee','review_employee','test_employee'])actions.push({operation_id,employee_id:employee.recordId,approval_required:operation_id==='test_employee',idempotency_key:`${response.conversation_id}:${employee.recordId}:${operation_id}`});
  }
  if(['queued','running','awaiting_input','failed','unknown','cancelled'].includes(response.work_status))components.push({type:'status',state:response.work_status});
  // Approval and verified result controls retain their existing server contracts; no parallel executor.
  return components.length?{version:1,type:'adaptive_reply',components,actions}:null;
}
