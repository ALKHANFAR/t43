import test from 'node:test';
import assert from 'node:assert/strict';
import {employeeMcpToolReady,scopeMcpTool,visibleMcpTool} from '../lib/mcp-flow-scope.mjs';

const flowTool={name:'ap_update_step',inputSchema:{properties:{flowId:{type:'string'},stepName:{type:'string'}}}};
const employee={activepieces_flow_id:'AAAAAAAAAAAAAAAAAAAAA'};

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

test('draft employee can discover tools and edit its Flow, but cannot test or run it',()=>{
  const draft={...employee,status:'draft'};
  const discovery={name:'ap_search_actions',inputSchema:{properties:{query:{type:'string'}}}};
  const execution={name:'ap_test_flow',inputSchema:{properties:{flowId:{type:'string'}}}};
  assert.equal(visibleMcpTool(discovery,draft),true);
  assert.equal(visibleMcpTool(flowTool,{...draft,activepieces_flow_id:null}),false);
  assert.equal(employeeMcpToolReady(discovery,draft),true);
  assert.equal(employeeMcpToolReady(flowTool,draft),true);
  assert.equal(employeeMcpToolReady(execution,draft),false);
  assert.deepEqual(scopeMcpTool(flowTool,{stepName:'step_1'},draft),{stepName:'step_1',flowId:employee.activepieces_flow_id});
  assert.equal(visibleMcpTool({name:'ap_list_tables',inputSchema:{properties:{}}},draft),false);
});
