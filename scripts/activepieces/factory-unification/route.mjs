// Route verified customer work to the same catalog-driven designer as preview chat.
const unifiedFactoryFlow455='vtIB0yqpB3lMK3ykTSTgN';
export async function dispatchUnifiedFactory455({state,work,ownerId,goal,signingSecret,fetchImpl=fetch,sign}){
 if(work?.kind!=='work'||work.owner!==ownerId||!['queued','running'].includes(work.state)||typeof goal!=='string'||!goal.trim()||goal.length>12000||!signingSecret)throw Error('unified_factory:invalid_work');
 const current=await state.get(work.id);if(current.owner!==ownerId||current.kind!=='work'||current.data.conversation_id!==work.data.conversation_id)throw Error('unified_factory:ownership_changed');
 if(!['queued','running'].includes(current.state))return {ok:true,work_id:work.id,work_status:current.state};
 const key='work_'+work.id;const found=await state.list('employee_design_preview',key);if(found.length>1)throw Error('unified_factory:ambiguous_design');
 let design=found[0];
 if(design&&(design.owner!==ownerId||design.data.sourceWorkId!==work.id||design.data.goal!==goal||design.data.conversation_id!==work.data.conversation_id))throw Error('unified_factory:design_mismatch');
 if(!design)design=await state.create('employee_design_preview',key,'queued',{goal,sourceWorkId:work.id,from_chat:false,intent:'build_employee',conversation_id:work.data.conversation_id,createdAt:new Date().toISOString()});
 await state.update(work.id,'running',{...current.data,goal,phase:'design_factory',design_id:design.id,phaseFlowId:unifiedFactoryFlow455,phaseStartedAt:current.data.phaseStartedAt||new Date().toISOString()});
 if(design.state!=='queued')return {ok:true,work_id:work.id,work_status:'running',design_id:design.id};
 const payload={owner:ownerId,id:design.id,at:Date.now()};const signature=sign('design-worker:'+JSON.stringify(payload),signingSecret);
 try{const r=await fetchImpl('https://activepieces-p8l1-455.up.railway.app/api/v1/webhooks/'+unifiedFactoryFlow455,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'design_worker',payload,signature}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('dispatch_failed');}
 catch{return {ok:true,work_id:work.id,work_status:'running',design_id:design.id,dispatch:'unconfirmed'};}
 return {ok:true,work_id:work.id,work_status:'running',design_id:design.id};
}
export async function completeUnifiedFactoryWork455({state,design,view}){
 if(!design.data.sourceWorkId)return null;
 const work=await state.get(design.data.sourceWorkId);
 if(work.kind!=='work'||work.owner!==design.owner||work.data.design_id!==design.id||work.data.conversation_id!==design.data.conversation_id||work.data.goal!==design.data.goal)throw Error('unified_factory:parent_mismatch');
 if(!['queued','running'].includes(work.state))return work;
 if(!['awaiting_connections','needs_configuration','failed'].includes(design.state))return work;
 let employee;
 if(design.state!=='failed'){
  employee=await state.get(design.data.employeeId);
  if(employee.kind!=='employee'||employee.owner!==design.owner||employee.data.sourceDesignId!==design.id||employee.data.contract?.goal!==design.data.goal)throw Error('unified_factory:employee_mismatch');
 }
 const reply=view.reply;
 const result={reply,recent_work:[],...(employee?{employee:{...employee.data,recordId:employee.id,flow_status_verified:false,execution_ready:false}}:{})};
 // Save recoverable conversation output before terminal work status.
 if(!(await state.list('message','assistant_'+work.id)).length)await state.create('message','assistant_'+work.id,'saved',{conversation_id:work.data.conversation_id,role:'assistant',content:reply,at:new Date().toISOString()});
 return state.update(work.id,view.status,{...work.data,phase:'design_complete',reply,result455:result,...(employee?{employee_id:employee.id}:{})});
}
export function unifiedDesignWorkView455(design){
 if(design.state==='failed')return {status:'failed',reply:'تعذر إكمال بناء الموظف. حُفظت حالة التعثر للمراجعة.'};
 if(design.state==='awaiting_connections'){
  if(!design.data.built?.structureVerified||design.data.built.status!=='DISABLED')throw Error('unified_factory:build_unproven');
  return {status:'succeeded',reply:'بُنيت مسودة «'+design.data.plan.name+'» وتم التحقق من خطواتها. راجع الموظف ومتطلبات ربط الحسابات.'};
 }
 if(design.state==='needs_configuration')return {status:'awaiting_input',reply:'حُفظت خطة الموظف وتحتاج استكمال الإعداد. راجع الأدوات والمتطلبات في ملف الموظف.'};
 return {status:'running',reply:'أتابع بناء الموظف.'};
}
