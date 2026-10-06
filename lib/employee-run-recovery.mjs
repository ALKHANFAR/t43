import {TenantProjectError} from './tenant-projects.mjs';

export function createEmployeeRunRecovery({query,projects,mcp}){
  async function capture({companyId,requestId,conversationId,claimToken,employee,execution,publishedVersion}){
    const projectId=await projects.requireProject(companyId);
    if(!execution||!/^[A-Za-z0-9]{21}$/.test(String(execution.runId||''))||execution.projectId!==projectId||execution.flowId!==employee.activepieces_flow_id||execution.flowVersionId!==publishedVersion||execution.environment!=='PRODUCTION')return null;
    const identity={runId:execution.runId,projectId,flowId:execution.flowId,flowVersionId:execution.flowVersionId,environment:'PRODUCTION',employeeId:employee.id,employeeUpdatedAt:employee.run_snapshot_updated_at,previousRunId:employee.last_run_id||null};
    const saved=await query(`UPDATE siyadah_chat_requests SET execution_identity_json=$5::jsonb
      WHERE company_id=$1 AND request_id=$2 AND conversation_id=$3 AND claim_token=$4
        AND (execution_identity_json IS NULL OR execution_identity_json=$5::jsonb)
      RETURNING request_id`,[companyId,requestId,conversationId,claimToken,JSON.stringify(identity)]);
    if(!saved.rows?.[0])throw new TenantProjectError('execution_identity_not_saved','لم نتأكد من حفظ معرّف التشغيل.',502);
    return identity;
  }
  async function reconcile({companyId,requestId,conversationId}){
    const row=(await query(`SELECT conversation_id,request_hash,execution_identity_json,response_json,status FROM siyadah_chat_requests
      WHERE company_id=$1 AND request_id=$2`,[companyId,requestId])).rows?.[0];
    if(!row?.execution_identity_json||row.conversation_id!==conversationId)return null;
    const identity=row.execution_identity_json;
    if(identity.projectId!==await projects.requireProject(companyId))return null;
    if(row.status==='succeeded'&&row.response_json?.run_id===identity.runId&&row.response_json?.outcome_kind==='tool_result')return row.response_json;
    // Ownership is rechecked; later disabling or publishing cannot erase an earlier invocation.
    await projects.ownedFlow(companyId,identity.flowId,identity.flowVersionId);
    const detail=await mcp.call(companyId,'tools/call',{name:'ap_get_run',arguments:{flowRunId:identity.runId}}),run=detail?.structuredContent;
    if(detail?.isError===true||run?.id!==identity.runId||run.flowId!==identity.flowId||run.environment!=='PRODUCTION'||run.flowVersionId&&run.flowVersionId!==identity.flowVersionId||run.projectId&&run.projectId!==identity.projectId||run.status!=='SUCCEEDED'||!Array.isArray(run.steps)||!run.steps.length)return null;
    const output=run.steps.at(-1).output??null;
    const response={...row.response_json,ok:true,conversation_id:conversationId,request_status:'succeeded',work_status:'succeeded',outcome_kind:'tool_result',work_id:`request_${requestId}`,run_id:identity.runId,flow_id:identity.flowId,result:output,reply:`اكتملت المهمة وتأكدت نتيجة التشغيل.\n${JSON.stringify(output).slice(0,5000)}`};
    const saved=await query(`WITH receipt AS (
      UPDATE siyadah_chat_requests SET status='succeeded',http_status=200,response_json=$4::jsonb,completed_at=COALESCE(completed_at,now())
      WHERE company_id=$1 AND request_id=$2 AND conversation_id=$3 AND execution_identity_json=$5::jsonb
        AND status IN ('pending','unknown','succeeded') RETURNING created_at
    ), employee_result AS (
      UPDATE siyadah_digital_employees e SET last_run_id=$6,last_result_json=$7::jsonb,last_run_at=receipt.created_at,last_conversation_id=$3
      FROM receipt WHERE e.company_id=$1 AND e.id::text=$8 AND e.activepieces_flow_id=$9 AND e.status='active'
        AND e.updated_at=$10::timestamptz AND (e.last_run_id IS NOT DISTINCT FROM $11::varchar OR e.last_run_at<receipt.created_at)
        AND (e.last_run_at IS NULL OR e.last_run_at<=receipt.created_at)
      RETURNING e.id
    ) SELECT created_at FROM receipt`,[companyId,requestId,conversationId,JSON.stringify(response),JSON.stringify(identity),identity.runId,JSON.stringify(run.steps.at(-1).output??null),identity.employeeId,identity.flowId,identity.employeeUpdatedAt,identity.previousRunId]);
    return saved.rows?.[0]?response:null;
  }
  return {capture,reconcile};
}
