const PROJECT_ID=/^[0-9A-Za-z]{21}$/;
const TENANT_ID=/^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;

export class TenantProjectError extends Error{
  constructor(code,message,status=500){super(message);this.name='TenantProjectError';this.code=code;this.status=status;}
}

function cleanName(value){
  const name=String(value||'').trim().replace(/[./]/g,'-').slice(0,120);
  if(!name)throw new TenantProjectError('invalid_display_name','اسم العميل مطلوب.',400);
  return name;
}

function projectFrom(body,externalId){
  const rows=Array.isArray(body?.data)?body.data:[];
  const exact=rows.find(project=>project?.externalId===externalId);
  if(!exact)return null;
  if(!PROJECT_ID.test(String(exact.id||'')))throw new TenantProjectError('invalid_provider_project','تعذّر تأكيد مساحة عمل الشركة.',502);
  return exact;
}

function httpActions(trigger){
  const actions=[],seen=new Set();
  let action=trigger?.nextAction;
  while(action){
    if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(String(action.name||''))||seen.has(action.name)||action.type!=='PIECE'||action.settings?.pieceName!=='@activepieces/piece-http'){
      throw new TenantProjectError('provider_result_unverified','لم نبدأ التشغيل؛ لا نستطيع التحقق من نتيجة أدوات هذا التدفق.',502);
    }
    seen.add(action.name);actions.push(action);
    if(actions.length>30)throw new TenantProjectError('provider_result_unverified','لم نبدأ التشغيل؛ لا نستطيع التحقق من نتيجة أدوات هذا التدفق.',502);
    action=action.nextAction;
  }
  if(!actions.length)throw new TenantProjectError('provider_result_unverified','لم نبدأ التشغيل؛ التدفق بلا إجراء يمكن التحقق منه.',502);
  return actions;
}

export function createTenantProjectService({query,fetchImpl=fetch,activepiecesUrl,apiKey,defaultMaxConcurrentJobs=2}){
  const base=String(activepiecesUrl||'').replace(/\/$/,'');
  const inFlight=new Map();
  const projectConcurrency=Number.isInteger(Number(defaultMaxConcurrentJobs))&&Number(defaultMaxConcurrentJobs)>0?Math.min(Number(defaultMaxConcurrentJobs),100):2;
  if(typeof query!=='function')throw new TypeError('query is required');

  async function provider(path,options={}){
    if(!base||!apiKey)throw new TenantProjectError('provider_not_configured','خدمة تنفيذ المهام غير مهيأة.',503);
    const response=await fetchImpl(base+path,{...options,headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json',...(options.headers||{})}});
    const body=await response.json().catch(()=>({}));
    if(!response.ok){
      if(response.status===401)throw new TenantProjectError('provider_unauthorized','تعذّر التحقق من خدمة تنفيذ المهام.',502);
      if(response.status===402||response.status===403)throw new TenantProjectError('team_plan_required','تفعيل باقة Team مطلوب لإنشاء مشاريع العملاء.',409);
      throw new TenantProjectError('provider_error','تعذّر تنفيذ الطلب.',502);
    }
    return body;
  }

  async function init(){
    await query(`CREATE TABLE IF NOT EXISTS siyadah_tenant_projects (
      tenant_id varchar(128) PRIMARY KEY,
      external_id varchar(160) UNIQUE NOT NULL,
      activepieces_project_id varchar(21) UNIQUE,
      display_name varchar(120) NOT NULL,
      provision_status varchar(24) NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async function read(tenantId){
    if(!TENANT_ID.test(String(tenantId||'')))throw new TenantProjectError('invalid_tenant','معرّف العميل غير صالح.',400);
    const result=await query('SELECT tenant_id, external_id, activepieces_project_id, display_name, provision_status FROM siyadah_tenant_projects WHERE tenant_id=$1',[tenantId]);
    return result.rows?.[0]||null;
  }

  async function save({tenantId,externalId,projectId,displayName}){
    const result=await query(`INSERT INTO siyadah_tenant_projects
      (tenant_id,external_id,activepieces_project_id,display_name,provision_status)
      VALUES ($1,$2,$3,$4,'ready')
      ON CONFLICT (tenant_id) DO UPDATE SET
        external_id=EXCLUDED.external_id,
        activepieces_project_id=EXCLUDED.activepieces_project_id,
        display_name=EXCLUDED.display_name,
        provision_status='ready',
        updated_at=now()
      RETURNING tenant_id,external_id,activepieces_project_id,display_name,provision_status`,[tenantId,externalId,projectId,displayName]);
    return result.rows[0];
  }

  async function ensureOnce({tenantId,displayName}){
    if(!TENANT_ID.test(String(tenantId||'')))throw new TenantProjectError('invalid_tenant','معرّف العميل غير صالح.',400);
    const name=cleanName(displayName), externalId=`siyadah:${tenantId}`;
    const existing=await read(tenantId);
    if(existing?.provision_status==='ready'&&PROJECT_ID.test(String(existing.activepieces_project_id||'')))return {...existing,created:false};

    const listed=await provider(`/api/v1/projects?externalId=${encodeURIComponent(externalId)}&limit=2`);
    let project=projectFrom(listed,externalId),created=false;
    if(!project){
      project=await provider('/api/v1/projects',{method:'POST',body:JSON.stringify({displayName:name,externalId,maxConcurrentJobs:projectConcurrency,metadata:{owner:'siyadah',tenantId}})});
      if(project.externalId!==externalId||!PROJECT_ID.test(String(project.id||'')))throw new TenantProjectError('invalid_provider_project','تعذّر تأكيد مساحة عمل الشركة.',502);
      created=true;
    }
    const row=await save({tenantId,externalId,projectId:project.id,displayName:name});
    return {...row,created};
  }

  function ensure(input){
    const key=String(input?.tenantId||'');
    if(inFlight.has(key))return inFlight.get(key);
    const pending=ensureOnce(input).finally(()=>inFlight.delete(key));
    inFlight.set(key,pending);return pending;
  }

  async function requireProject(tenantId){
    const row=await read(tenantId);
    if(!row||row.provision_status!=='ready'||!PROJECT_ID.test(String(row.activepieces_project_id||'')))throw new TenantProjectError('project_not_ready','مشروع العميل غير مجهز.',409);
    return row.activepieces_project_id;
  }

  async function createFlow({tenantId,displayName,metadata={}}){
    const projectId=await requireProject(tenantId),name=cleanName(displayName);
    const flow=await provider('/api/v1/flows',{method:'POST',body:JSON.stringify({displayName:name,projectId,metadata:{...metadata,owner:'siyadah',tenantId}})});
    if(!PROJECT_ID.test(String(flow?.id||''))||flow.projectId!==projectId)throw new TenantProjectError('flow_project_mismatch','رفضت سيادة نتيجة فلو لا تطابق مشروع العميل.',502);
    return flow;
  }

  async function listFlows(tenantId){
    const row=await read(tenantId);
    if(!row)return [];
    const projectId=await requireProject(tenantId);
    const result=await provider(`/api/v1/flows?projectId=${encodeURIComponent(projectId)}&limit=100`);
    const flows=Array.isArray(result?.data)?result.data:[];
    if(flows.some(flow=>flow?.projectId!==projectId))throw new TenantProjectError('flow_project_mismatch','رفضت سيادة فلو لا يطابق مشروع العميل.',502);
    return flows;
  }

  async function ownedFlow(tenantId,flowId){
    if(!PROJECT_ID.test(String(flowId||'')))throw new TenantProjectError('invalid_flow','طريقة العمل غير صالحة.',400);
    const projectId=await requireProject(tenantId),flow=await provider(`/api/v1/flows/${flowId}`);
    if(flow?.projectId!==projectId)throw new TenantProjectError('flow_project_mismatch','طريقة العمل لا تخص هذه الشركة.',403);
    return {projectId,flow};
  }

  async function employeeFlowContext({tenantId,flowId}){
    const {projectId,flow}=await ownedFlow(tenantId,flowId);
    const steps=[];
    let action=flow.version?.trigger;
    const seen=new Set();
    while(action&&steps.length<30&&!seen.has(action.name)){
      seen.add(action.name);
      steps.push({name:String(action.settings?.displayName||action.name||'').slice(0,100),type:String(action.type||''),tool:String(action.settings?.pieceName||'').replace(/^@activepieces\/piece-/,'').slice(0,80)});
      action=action.nextAction;
    }
    const listed=await provider(`/api/v1/flow-runs?projectId=${encodeURIComponent(projectId)}&flowId=${encodeURIComponent(flowId)}&limit=5`);
    if(!Array.isArray(listed?.data))throw new TenantProjectError('flow_runs_unverified','تعذّر التحقق من سجل عمل الموظف.',502);
    const runs=listed.data.map(run=>{
      if(run.projectId!==projectId||run.flowId!==flowId)throw new TenantProjectError('flow_run_project_mismatch','سجل العمل لا يخص هذه الشركة.',502);
      return {id:String(run.id||'').slice(0,80),status:String(run.status||'UNKNOWN').slice(0,40),created:run.created||null};
    });
    return {flowId,status:flow.status,versionState:flow.version?.state||'UNKNOWN',versionId:flow.version?.id||null,steps,structureComplete:!!flow.version?.trigger&&!action&&steps.every(step=>['PIECE_TRIGGER','PIECE','CODE'].includes(step.type)),runs};
  }

  async function changeFlowStatus({tenantId,flowId,status}){
    if(!['ENABLED','DISABLED'].includes(status))throw new TenantProjectError('invalid_flow_status','حالة طريقة العمل غير صالحة.',400);
    const {projectId}=await ownedFlow(tenantId,flowId);
    const flow=await provider(`/api/v1/flows/${flowId}`,{method:'POST',body:JSON.stringify({type:'CHANGE_STATUS',request:{status}})});
    if(flow?.projectId!==projectId||flow?.status!==status)throw new TenantProjectError('flow_state_unverified','لم نتأكد من حالة الموظف.',502);
    return flow;
  }

  async function runFlow({tenantId,flowId,requestId,message,onDispatch,verifyProviderResult}){
    const {projectId,flow}=await ownedFlow(tenantId,flowId);
    if(flow.status!=='ENABLED')throw new TenantProjectError('employee_disabled','الموظف متوقف. فعّله أولًا.',409);
    const actions=httpActions(flow.version?.trigger);
    const started=Date.now(),marker=String(requestId||'').slice(0,80);
    if(onDispatch!==undefined){
      if(typeof onDispatch!=='function')throw new TypeError('onDispatch must be a function');
      await onDispatch();
    }
    const response=await fetchImpl(`${base}/api/v1/webhooks/${flowId}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:marker,task:String(message||'').slice(0,4000)})});
    if(!response.ok)throw new TenantProjectError('flow_start_failed','تعذّر بدء المهمة.',502);
    const terminal=new Set(['SUCCEEDED','FAILED','TIMEOUT','CANCELED','CANCELLED','QUOTA_EXCEEDED','INTERNAL_ERROR','MEMORY_LIMIT_EXCEEDED','LOG_SIZE_EXCEEDED','STOPPED']);
    for(let attempt=0;attempt<16;attempt++){
      if(attempt)await new Promise(resolve=>setTimeout(resolve,500));
      const listed=await provider(`/api/v1/flow-runs?projectId=${encodeURIComponent(projectId)}&flowId=${encodeURIComponent(flowId)}&limit=10`);
      for(const candidate of listed?.data||[]){
        if(candidate.flowId!==flowId||candidate.projectId!==projectId||new Date(candidate.created).getTime()<started-2000)continue;
        const run=await provider(`/api/v1/flow-runs/${candidate.id}`);
        if(run?.id!==candidate.id||run.flowId!==flowId||run.projectId!==projectId)throw new TenantProjectError('flow_run_project_mismatch','نتيجة التشغيل لا تخص مشروع هذه الشركة.',502);
        const trigger=run?.steps?.trigger?.output?.body;
        if(trigger?.requestId!==marker)continue;
        const unverified=(message,httpStatus=null)=>{
          const error=new TenantProjectError('provider_result_unverified',message,502);
          error.transportReceipt={runId:run.id,flowId,projectId,httpStatus,receivedAt:run.finishTime||null,outcome:'unverified'};
          return error;
        };
        if(run.status==='PAUSED')throw new TenantProjectError('flow_run_paused','المهمة متوقفة بانتظار خطوة أخرى.',409);
        if(!terminal.has(run.status))break;
        if(run.status!=='SUCCEEDED')throw new TenantProjectError('flow_run_failed','تعذّر إكمال المهمة.',502);
        for(const action of actions){
          const step=run.steps?.[action.name],status=step?.output?.status;
          if(step?.error||!step?.output||!Number.isInteger(status))throw unverified('اكتمل تشغيل المهمة، لكن رد الأداة غير مثبت.');
          if(status<200||status>=300)throw new TenantProjectError('provider_action_failed','الأداة أعادت ردًا غير ناجح.',502);
        }
        // An HTTP response proves transport only. A provider-specific adapter must
        // validate the business outcome and return a receipt before success is reported.
        const last=actions.at(-1),output=run.steps[last.name].output;
        let verification;
        if(typeof verifyProviderResult==='function'){
          try{verification=await verifyProviderResult({tenantId,flowId,projectId,runId:run.id,actions:actions.map(action=>({name:action.name,output:run.steps[action.name].output}))});}
          catch{throw unverified('وصل رد الأداة، لكن نتيجتها النهائية غير مثبتة.',output.status);}
        }
        if(verification?.verified!==true||typeof verification.receiptId!=='string'||!verification.receiptId.trim()){
          throw unverified('وصل رد الأداة، لكن نتيجتها النهائية غير مثبتة.',output.status);
        }
        return {runId:run.id,status:run.status,flowId,projectId,startedAt:run.startTime,finishedAt:run.finishTime,result:{status:output.status,body:output.body??null,receiptId:verification.receiptId},tool:{pieceName:last.settings.pieceName,actionName:last.settings.actionName||''}};
      }
    }
    throw new TenantProjectError('flow_run_timeout','بدأت المهمة لكن لم تصل نتيجتها بعد.',504);
  }

  return {init,read,ensure,requireProject,createFlow,listFlows,ownedFlow,employeeFlowContext,changeFlowStatus,runFlow};
}
