import test from 'node:test';
import assert from 'node:assert/strict';
import {employeeFlowMcpToolName,employeeMcpToolReady,scopeMcpTool,visibleMcpTool} from '../lib/mcp-flow-scope.mjs';

const flowTool={name:'ap_update_step',inputSchema:{properties:{flowId:{type:'string'},stepName:{type:'string'}}}};
const employee={activepieces_flow_id:'AAAAAAAAAAAAAAAAAAAAA'};
const publishedFlow=(id,status='ENABLED')=>({id,status,publishedVersionId:'v1',version:{id:'v1',displayName:'نور',trigger:{settings:{pieceName:'@activepieces/piece-mcp',triggerName:'mcp_tool',input:{toolName:'nour',returnsResponse:true}}}}});

test('native Flow tool name comes from the owned published version and requires a reply',()=>{
  const flow=publishedFlow('F'.repeat(21));
  assert.equal(employeeFlowMcpToolName(flow),'nour_ffff_e8x87w_mcp');
  assert.equal(employeeFlowMcpToolName({...flow,publishedVersionId:'other'}),null);
  assert.equal(employeeFlowMcpToolName({...flow,status:'DISABLED'}),null);
  assert.equal(employeeFlowMcpToolName({...flow,version:{...flow.version,trigger:{settings:{...flow.version.trigger.settings,input:{toolName:'nour',returnsResponse:false}}}}}),null);
});

test('employee sees only its own native Flow tool',()=>{
  const ownName=employeeFlowMcpToolName(publishedFlow('F'.repeat(21)));
  const otherName=employeeFlowMcpToolName(publishedFlow('G'.repeat(21)));
  const own={name:ownName,inputSchema:{type:'object',properties:{task:{type:'string'}}}};
  const other={name:otherName,inputSchema:own.inputSchema};
  const selected={...employee,status:'active',activepieces_flow_id:'F'.repeat(21)};
  assert.equal(visibleMcpTool(own,selected,ownName),true);
  assert.deepEqual(scopeMcpTool(own,{task:'نفذ'},selected,ownName),{task:'نفذ'});
  assert.equal(visibleMcpTool(other,selected,ownName),false);
  assert.throws(()=>scopeMcpTool(other,{task:'تسريب'},selected,ownName),{code:'employee_flow_scope'});
  assert.equal(visibleMcpTool(own,{...selected,status:'draft'},null),false);
});

test('employee Flow ID comes from its saved record, never from the model',()=>{
  assert.deepEqual(scopeMcpTool(flowTool,{stepName:'step_1'},employee),{stepName:'step_1',flowId:employee.activepieces_flow_id});
  assert.throws(()=>scopeMcpTool(flowTool,{flowId:'BBBBBBBBBBBBBBBBBBBBB',stepName:'step_1'},employee),{code:'employee_flow_scope'});
  assert.deepEqual(scopeMcpTool(flowTool,{flowId:'BBBBBBBBBBBBBBBBBBBBB'},null),{flowId:'BBBBBBBBBBBBBBBBBBBBB'});
});

test('employee cannot select another Flow through broad MCP tools',()=>{
  for(const name of ['ap_list_flows','ap_get_run','ap_retry_run','ap_build_flow','ap_create_flow','ap_duplicate_flow','ap_delete_flow','ap_change_flow_status']){
    const tool={name,inputSchema:{properties:{}}};
    assert.equal(visibleMcpTool(tool,employee),false);
    assert.throws(()=>scopeMcpTool(tool,{},employee),{code:'employee_flow_scope'});
    assert.equal(visibleMcpTool(tool,null),true);
  }
  assert.deepEqual(scopeMcpTool({name:'ap_list_runs',inputSchema:{properties:{flowId:{type:'string'}}}},{limit:5},employee),{limit:5,flowId:employee.activepieces_flow_id});
});

test('MCP cannot switch away from the server-owned company project',()=>{
  const tool={name:'ap_set_project_context',inputSchema:{properties:{projectId:{type:'string'}}}};
  assert.equal(visibleMcpTool(tool,null),false);
  assert.throws(()=>scopeMcpTool(tool,{projectId:'BBBBBBBBBBBBBBBBBBBBB'},null),{code:'mcp_project_switch_forbidden'});
});

test('draft employee can discover, edit and test its Flow, but cannot run unrelated flows',()=>{
  const draft={...employee,status:'draft'};
  const discovery={name:'ap_search_actions',inputSchema:{properties:{query:{type:'string'}}}};
  const execution={name:'ap_test_flow',inputSchema:{properties:{flowId:{type:'string'}}}};
  assert.equal(visibleMcpTool(discovery,draft),true);
  assert.equal(visibleMcpTool(flowTool,{...draft,activepieces_flow_id:null}),false);
  assert.equal(employeeMcpToolReady(discovery,draft),true);
  assert.equal(employeeMcpToolReady(flowTool,draft),true);
  assert.equal(employeeMcpToolReady(execution,draft),true);
  assert.deepEqual(scopeMcpTool(flowTool,{stepName:'step_1'},draft),{stepName:'step_1',flowId:employee.activepieces_flow_id});
  assert.equal(visibleMcpTool({name:'ap_list_tables',inputSchema:{properties:{}}},draft),false);
});
