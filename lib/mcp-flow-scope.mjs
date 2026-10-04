import {TenantProjectError} from './tenant-projects.mjs';

const OTHER_FLOW_TOOLS=new Set(['ap_list_flows','ap_get_run','ap_retry_run','ap_create_flow','ap_build_flow','ap_duplicate_flow','ap_delete_flow','ap_change_flow_status']);
const DISCOVERY=new Set(['ap_research_pieces','ap_search_actions','ap_search_triggers','ap_get_piece_props','ap_resolve_property_options','ap_resolve_property_chain','ap_validate_step_config','ap_list_connections','ap_setup_guide']);
const DRAFT_EDITS=new Set(['ap_update_trigger','ap_add_step','ap_update_step','ap_delete_step','ap_add_branch','ap_update_branch','ap_delete_branch','ap_manage_notes','ap_rename_flow','ap_lock_and_publish']);

export function employeeMcpToolReady(tool,employee){
  return employee?.status==='active'||DISCOVERY.has(tool.name)||DRAFT_EDITS.has(tool.name)||/^(ap_flow_structure|ap_read_step_code|ap_read_step_settings|ap_validate_flow|ap_list_runs)$/.test(tool.name);
}

export function scopeMcpTool(tool,args,employee){
  if(tool.name==='ap_set_project_context')throw new TenantProjectError('mcp_project_switch_forbidden','يحدد خادم سيادة مشروع الشركة.',403);
  if(!employee)return args;
  if(OTHER_FLOW_TOOLS.has(tool.name))throw new TenantProjectError('employee_flow_scope','محادثة الموظف مرتبطة بطريقة عمله الحالية.',403);
  const flowId=employee.activepieces_flow_id;
  if(!flowId){
    if(DISCOVERY.has(tool.name))return args;
    throw new TenantProjectError('employee_flow_not_ready','طريقة عمل الموظف لم تُجهّز بعد.',409);
  }
  if(!Object.hasOwn(tool.inputSchema?.properties||{},'flowId'))return args;
  if(args.flowId&&args.flowId!==flowId)throw new TenantProjectError('employee_flow_scope','طريقة العمل لا تخص هذا الموظف.',403);
  return {...args,flowId};
}

export function visibleMcpTool(tool,employee){
  return tool.name!=='ap_set_project_context'&&(!employee||(!OTHER_FLOW_TOOLS.has(tool.name)&&(DISCOVERY.has(tool.name)||!!employee.activepieces_flow_id&&Object.hasOwn(tool.inputSchema?.properties||{},'flowId'))));
}
