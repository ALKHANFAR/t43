import {TenantProjectError} from './tenant-projects.mjs';

const FLOW_CREATION=new Set(['ap_create_flow','ap_build_flow']);

export function employeeMcpToolReady(tool,employee){
  // Generic native tools keep their own schemas, RBAC and approval boundaries.
  // Only invoking an employee's published production Flow requires activation.
  return !employee||!tool.name.endsWith('_mcp')||employee.status==='active';
}

// Activepieces 0.92.1 names a published MCP flow tool from its configured name and flow ID.
export function employeeFlowMcpToolName(flow){
  const trigger=flow?.version?.trigger,settings=trigger?.settings,input=settings?.input;
  if(flow?.status!=='ENABLED'||!flow.publishedVersionId||flow.version?.id!==flow.publishedVersionId||settings?.pieceName!=='@activepieces/piece-mcp'||settings?.triggerName!=='mcp_tool'||![true,'true'].includes(input?.returnsResponse))return null;
  const base=`${input.toolName??flow.version.displayName}_${flow.id.slice(0,4)}`;
  const sanitized=base.toLowerCase().replace(/[^a-z0-9_-]/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  let hash=5381;for(let index=0;index<(sanitized||base).length;index++)hash=(Math.imul(hash,33)^(sanitized||base).charCodeAt(index))>>>0;
  return `${sanitized.slice(0,53)}_${hash.toString(36).padStart(6,'0').slice(-6)}_mcp`;
}

export function scopeMcpTool(tool,args,employee,flowToolName=null){
  if(tool.name==='ap_set_project_context')throw new TenantProjectError('mcp_project_switch_forbidden','يحدد خادم سيادة مشروع الشركة.',403);
  if(!employee)return args;
  const flowId=employee.activepieces_flow_id;
  if(tool.name===flowToolName&&flowId){
    if(employee.status!=='active')throw new TenantProjectError('employee_flow_not_ready','الموظف غير مفعّل لتنفيذ طريقة عمله.',409);
    return args;
  }
  if(tool.name.endsWith('_mcp'))throw new TenantProjectError('employee_flow_scope','محادثة الموظف مرتبطة بطريقة عمله الحالية.',403);
  if(FLOW_CREATION.has(tool.name)){
    if(flowId)throw new TenantProjectError('employee_flow_scope','للموظف طريقة عمل محفوظة؛ استخدم أدوات تعديلها.',403);
    return args;
  }
  // ap_get_run/ap_retry_run carry flowRunId, not flowId. The server must read
  // that native run and verify its flowId before dispatching the selected tool.
  if(!Object.hasOwn(tool.inputSchema?.properties||{},'flowId'))return args;
  if(!flowId){
    if(tool.name==='ap_get_piece_props'&&!args.flowId)return args;
    throw new TenantProjectError('employee_flow_not_ready','طريقة عمل الموظف لم تُجهّز بعد.',409);
  }
  if(args.flowId&&args.flowId!==flowId)throw new TenantProjectError('employee_flow_scope','طريقة العمل لا تخص هذا الموظف.',403);
  return {...args,flowId};
}

export function visibleMcpTool(tool,employee,flowToolName=null){
  if(tool.name==='ap_set_project_context')return false;
  if(!employee)return true;
  if(tool.name.endsWith('_mcp'))return employee.status==='active'&&tool.name===flowToolName&&!!flowToolName;
  if(FLOW_CREATION.has(tool.name))return !employee.activepieces_flow_id;
  if(Object.hasOwn(tool.inputSchema?.properties||{},'flowId')&&!employee.activepieces_flow_id)return tool.name==='ap_get_piece_props';
  return true;
}
