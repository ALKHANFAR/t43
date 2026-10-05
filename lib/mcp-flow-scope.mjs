import {TenantProjectError} from './tenant-projects.mjs';

const OTHER_FLOW_TOOLS=new Set(['ap_list_flows','ap_get_run','ap_retry_run','ap_create_flow','ap_build_flow','ap_duplicate_flow','ap_delete_flow','ap_change_flow_status']);
const DISCOVERY=new Set(['ap_research_pieces','ap_search_actions','ap_search_triggers','ap_get_piece_props','ap_resolve_property_options','ap_resolve_property_chain','ap_validate_step_config','ap_list_connections','ap_setup_guide']);
const DRAFT_EDITS=new Set(['ap_update_trigger','ap_add_step','ap_update_step','ap_delete_step','ap_add_branch','ap_update_branch','ap_delete_branch','ap_manage_notes','ap_rename_flow','ap_lock_and_publish']);

export function employeeMcpToolReady(tool,employee){
  return employee?.status==='active'||DISCOVERY.has(tool.name)||DRAFT_EDITS.has(tool.name)||/^(ap_flow_structure|ap_read_step_code|ap_read_step_settings|ap_validate_flow|ap_list_runs)$/.test(tool.name);
}

// Activepieces 0.92.1 names a published MCP flow tool from its configured name and flow ID.
export function employeeFlowMcpToolName(flow){
  const trigger=flow?.version?.trigger,settings=trigger?.settings,input=settings?.input;
  if(flow?.status!=='ENABLED'||!flow.publishedVersionId||flow.version?.id!==flow.publishedVersionId||settings?.pieceName!=='@activepieces/piece-mcp'||settings?.triggerName!=='mcp_tool'||input?.returnsResponse!==true)return null;
  const base=`${input.toolName??flow.version.displayName}_${flow.id.slice(0,4)}`;
  const sanitized=base.toLowerCase().replace(/[^a-z0-9_-]/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  let hash=5381;for(let index=0;index<(sanitized||base).length;index++)hash=(Math.imul(hash,33)^(sanitized||base).charCodeAt(index))>>>0;
  return `${sanitized.slice(0,53)}_${hash.toString(36).padStart(6,'0').slice(-6)}_mcp`;
}

export function scopeMcpTool(tool,args,employee,flowToolName=null){
  if(tool.name==='ap_set_project_context')throw new TenantProjectError('mcp_project_switch_forbidden','يحدد خادم سيادة مشروع الشركة.',403);
  if(!employee)return args;
  if(OTHER_FLOW_TOOLS.has(tool.name))throw new TenantProjectError('employee_flow_scope','محادثة الموظف مرتبطة بطريقة عمله الحالية.',403);
  const flowId=employee.activepieces_flow_id;
  if(tool.name===flowToolName&&flowId)return args;
  if(tool.name.endsWith('_mcp'))throw new TenantProjectError('employee_flow_scope','محادثة الموظف مرتبطة بطريقة عمله الحالية.',403);
  if(!flowId){
    if(DISCOVERY.has(tool.name))return args;
    throw new TenantProjectError('employee_flow_not_ready','طريقة عمل الموظف لم تُجهّز بعد.',409);
  }
  if(!Object.hasOwn(tool.inputSchema?.properties||{},'flowId'))return args;
  if(args.flowId&&args.flowId!==flowId)throw new TenantProjectError('employee_flow_scope','طريقة العمل لا تخص هذا الموظف.',403);
  return {...args,flowId};
}

export function visibleMcpTool(tool,employee,flowToolName=null){
  return tool.name!=='ap_set_project_context'&&(!employee||tool.name===flowToolName&&!!flowToolName||(!OTHER_FLOW_TOOLS.has(tool.name)&&!tool.name.endsWith('_mcp')&&(DISCOVERY.has(tool.name)||!!employee.activepieces_flow_id&&Object.hasOwn(tool.inputSchema?.properties||{},'flowId'))));
}
