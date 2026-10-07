import {TenantProjectError} from './tenant-projects.mjs';
import {CompanyProfileError} from './company-profile.mjs';
import {builtFlowResult} from './chat-intelligence.mjs';

// Flow construction and test readback stay separate from HTTP and model orchestration.
export function createChatFlowLifecycle({database,companyProfiles,tenantProjects,logger=console}){
  const console=logger;
async function buildOwnedDraftFlow({mcp,companyId,args,draftEmployee=null,onEffectStart,toolName='ap_build_flow'}){
  const client=draftEmployee?await (await database()).connect():null;
  let locked=false;
  try{
    if(client){
      locked=(await client.query('SELECT pg_try_advisory_lock(hashtext($1),hashtext($2)) AS locked',[companyId,draftEmployee.id])).rows?.[0]?.locked===true;
      if(!locked)throw new CompanyProfileError('employee_build_busy','تجهيز هذا الموظف قيد التنفيذ. تحقّق من نتيجته قبل المحاولة مجددًا.',409);
      const current=await (await companyProfiles()).findEmployee(companyId,draftEmployee.id);
      if(current?.status!=='draft'||current.activepieces_flow_id)throw new CompanyProfileError('employee_flow_conflict','طريقة عمل هذا الموظف مجهزة بالفعل.',409);
    }
    onEffectStart();
    const result=await mcp.call(companyId,'tools/call',{name:toolName,arguments:args});
    if(result?.isError===true)return {result,built:null,updated:null};
    const built=builtFlowResult(result);
    if(!built)throw new TenantProjectError('flow_build_unverified','تعذّر تأكيد إنشاء طريقة العمل؛ تحقّق من حالة الطلب قبل إعادته.',502);
    const {flow}=await (await tenantProjects()).ownedFlow(companyId,built.flowId);
    if(flow.status!=='DISABLED')throw new TenantProjectError('flow_state_invalid','طريقة العمل لم تُحفظ كمسودة متوقفة.',409);
    const updated=draftEmployee?await (await companyProfiles()).linkEmployeeFlow({companyId,employeeId:draftEmployee.id,flowId:built.flowId}):null;
    return {result,built,updated};
  }finally{
    if(locked)try{await client.query('SELECT pg_advisory_unlock(hashtext($1),hashtext($2))',[companyId,draftEmployee.id]);}catch(error){console.error('employee build lock release failed',error?.code||error?.name||'unknown_error');}
    if(client)client.release();
  }
}
async function successfulFlowTest(mcp,companyId,flowId,test){
  const runId=test?.structuredContent?.runId;
  if(test?.isError===true||test?.structuredContent?.status!=='SUCCEEDED'||!/^[A-Za-z0-9]{21}$/.test(String(runId||'')))return null;
  const detail=await mcp.call(companyId,'tools/call',{name:'ap_get_run',arguments:{flowRunId:runId}});
  const run=detail?.structuredContent;
  return detail?.isError!==true&&run?.id===runId&&run.flowId===flowId&&run.environment==='TESTING'&&run.status==='SUCCEEDED'&&Array.isArray(run.steps)&&run.steps.length>0?{...run,...(typeof test.structuredContent.usedMockTriggerData==='boolean'?{usedMockTriggerData:test.structuredContent.usedMockTriggerData}:{})}:null;
}
  return {buildOwnedDraftFlow,successfulFlowTest};
}
