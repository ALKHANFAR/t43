// Shared employee record used by design, dashboard and execution readiness.
// Pending designs never authorize execution. Connections are tenant-bound elsewhere.
const employeeContractStates455=new Set(['awaiting_connections','needs_configuration']);
const employeeContractId455=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
export function isDesignedEmployee455(employee){return employee?.data?.contractVersion===2||employee?.contractVersion===2;}
export function pendingEmployeeReply455(employee){
 const d=employee.data||employee;
 return d.status==='awaiting_connections'?'خطة الموظف محفوظة. يلزم ربط الحسابات واستكمال التحقق من التشغيل قبل تنفيذ العمل.':'خطة الموظف تحتاج استكمال الإعداد. راجع المتطلبات والأدوات في ملف الموظف قبل التشغيل.';
}
export function projectDesignedEmployee455({design,ownerId}){
 const fail=r=>{throw Error('employee_contract:'+r);};
 if(!employeeContractId455(ownerId)||design?.owner!==ownerId||design.kind!=='employee_design_preview'||!employeeContractId455(design.id))fail('design_owner_mismatch');
 const p=design.data?.plan;
 if(!employeeContractStates455.has(design.state)||!p||p.status!==design.state)fail('design_not_final');
 if(typeof design.data.goal!=='string'||!design.data.goal.trim()||!Array.isArray(p.selected))fail('plan_invalid');
 const built=design.data.built;
 if(design.state==='awaiting_connections'&&(!built?.structureVerified||built.status!=='DISABLED'||!employeeContractId455(built.flowId)||!employeeContractId455(built.versionId)))fail('draft_proof_required');
 const steps=p.selected.map(s=>{
  if(!s||typeof s.pieceName!=='string'||!/^@activepieces\/[a-z0-9-]+$/.test(s.pieceName)||typeof s.pieceVersion!=='string'||!s.pieceVersion||typeof(s.actionName||s.triggerName)!=='string'||!s.reason)fail('operation_identity_required');
  return {id:s.id||null,pieceName:s.pieceName,pieceVersion:s.pieceVersion,kind:s.triggerName?'trigger':'action',operationName:s.actionName||s.triggerName,reason:s.reason,input:s.input||{}};
 });
 const tools=[...new Set(steps.map(s=>s.pieceName.replace(/^@activepieces\/(?:piece-)?/,'')))];
 // Preserve the plan's own source context, not the company's later mutable profile.
 const contract={version:2,ownerId,sourceDesignId:design.id,goal:design.data.goal,
  strategy:p.strategy||null,companyContext:p.knowledge||null,steps,
  bindings:p.bindings||[],evidence:p.evidence||[],missing:p.missing||[],issues:p.issues||[],
  flow:built?.structureVerified?{id:built.flowId,versionId:built.versionId,structureVerified:true,status:'DISABLED'}:null,
  readiness:{configuration:design.state,connectionsVerified:false,runtimeVerified:false,businessOutcomeVerified:false}};
 return {contractVersion:2,sourceDesignId:design.id,status:design.state,
  name:p.name||design.data.goal.slice(0,100),role:design.data.goal,instructions:design.data.goal,
  tools,how:steps.map(s=>s.reason),rules:[],autonomy:'يستأذن',tone:'رسمي',
  flowId:contract.flow?.id||null,publishedVersionId:null,contract};
}
export async function registerDesignedEmployee455({state,design,ownerId}){
 const data=projectDesignedEmployee455({design,ownerId});
 const key='design_'+design.id;const found=await state.list('employee',key);
 if(found.length>1)throw Error('employee_contract:duplicate_employee');
 if(found.length){const e=found[0];
  if(e.owner!==ownerId||e.kind!=='employee'||e.data.sourceDesignId!==design.id||!isDesignedEmployee455(e))throw Error('employee_contract:existing_identity_mismatch');
  // A read/retry must not overwrite subsequent bindings or runtime state.
  if(JSON.stringify(e.data.contract)!==JSON.stringify(data.contract))throw Error('employee_contract:existing_contract_changed');
  return e;
 }
 const saved=await state.create('employee',key,design.state,data);
 if(saved.owner!==ownerId||saved.kind!=='employee'||saved.key!==key||saved.state!==design.state||JSON.stringify(saved.data)!==JSON.stringify(data))throw Error('employee_contract:registration_unproven');
 return saved;
}
export async function employeeTeamView455({employee,api}){
 if(isDesignedEmployee455(employee)){
  if(employee.contract?.ownerId===undefined||employee.sourceDesignId!==employee.contract.sourceDesignId||!employeeContractStates455.has(employee.status))throw Error('employee_contract:invalid_team_record');
  return {...employee,flow_status_verified:false,execution_ready:false,readiness_reply:pendingEmployeeReply455(employee)};
 }
 const f=await api.getFlow({flowId:employee.flowId});
 return {...employee,status:f.status==='ENABLED'?'active':'disabled',flow_status_verified:f.status==='ENABLED'&&!!f.publishedVersionId};
}
export async function guardDesignedEmployeeRun455({state,employee,work}){
 if(!isDesignedEmployee455(employee))return null;
 if(employee.kind!=='employee'||work.kind!=='work'||employee.owner!==work.owner||employee.data.contract?.ownerId!==employee.owner||work.data.employee_id!==employee.id)throw Error('employee_contract:run_owner_mismatch');
 const reply=pendingEmployeeReply455(employee);
 const result={ok:true,work_id:work.id,work_status:'awaiting_input',reply,employee_id:employee.id,execution_started:false};
 await state.update(work.id,'awaiting_input',{...work.data,phase:'employee_setup',reply,result455:result});
 if(work.data.conversation_id&&!(await state.list('message','assistant_'+work.id)).length)await state.create('message','assistant_'+work.id,'saved',{conversation_id:work.data.conversation_id,role:'assistant',content:reply,at:new Date().toISOString()});
 return result;
}
