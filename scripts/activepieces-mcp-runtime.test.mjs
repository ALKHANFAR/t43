import test from 'node:test';
import assert from 'node:assert/strict';
import {createActivepiecesMcp} from '../lib/activepieces-mcp.mjs';

const projectA='AAAAAAAAAAAAAAAAAAAAA',projectB='BBBBBBBBBBBBBBBBBBBBB';
const token=project=>'header.'+Buffer.from(JSON.stringify({projectId:project})).toString('base64url')+'.signature';
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});

function harness(tokenProject=projectA,sse=false){
  let grant=null,approval=null,mcpCalls=0;
  const query=async(sql,values=[])=>{
    if(sql.includes('INSERT INTO siyadah_mcp_grants')){grant={project_id:values[1],client_id:values[2],refresh_token_cipher:values[3]};return {rows:[]};}
    if(sql.includes('SELECT project_id,client_id,refresh_token_cipher'))return {rows:grant?[grant]:[]};
    if(sql.includes('INSERT INTO siyadah_mcp_approvals')){approval={id:values[0],tenant_id:values[1],conversation_id:values[2],employee_id:values[3],tool_name:values[4],args_cipher:values[5],summary:values[6]};return {rows:[]};}
    if(sql.includes('DELETE FROM siyadah_mcp_approvals')){
      if(!approval||approval.id!==values[0]||approval.tenant_id!==values[1]||approval.conversation_id!==values[2])return {rows:[]};
      const row=approval;approval=null;return {rows:[row]};
    }
    return {rows:[]};
  };
  const fetchImpl=async(url,options)=>{
    if(url.endsWith('/register'))return json({client_id:'siyadah-client'});
    if(url.endsWith('/token'))return json({access_token:token(tokenProject),refresh_token:'refresh-secret'});
    if(url.endsWith('/mcp')){
      mcpCalls++;
      const payload={jsonrpc:'2.0',id:1,result:options.body.includes('tools/list')?{tools:[{name:'ap_search_actions'}]}:{content:[{type:'text',text:'ok'}]}};
      return sse?new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`,{status:200,headers:{'content-type':'text/event-stream'}}):json(payload);
    }
    throw new Error('unexpected provider URL');
  };
  const service=createActivepiecesMcp({query,requireProject:async()=>projectA,activepiecesUrl:'https://ap.example.test',origin:'https://siyadah.example.test',secret:'s'.repeat(40),fetchImpl});
  return {service,get grant(){return grant;},get mcpCalls(){return mcpCalls;}};
}

test('MCP OAuth grant is bound to the server-owned company project and stored encrypted',async()=>{
  const h=harness(),url=await h.service.begin('company-a');
  const auth=new URL(url);assert.equal(auth.searchParams.get('resource'),'https://ap.example.test/mcp');
  const state=auth.searchParams.get('state');
  await h.service.complete(`/siyadah-api/v1/mcp/callback?state=${encodeURIComponent(state)}&code=once`);
  assert.equal(h.grant.project_id,projectA);
  assert.ok(!h.grant.refresh_token_cipher.includes('refresh-secret'));
  assert.equal(h.mcpCalls,1);
  const tools=await h.service.call('company-a','tools/list',{});
  assert.equal(tools.tools[0].name,'ap_search_actions');
});

test('foreign project token is rejected before a grant is saved or MCP is called',async()=>{
  const h=harness(projectB),url=await h.service.begin('company-a');
  const state=new URL(url).searchParams.get('state');
  await assert.rejects(()=>h.service.complete(`/siyadah-api/v1/mcp/callback?state=${encodeURIComponent(state)}&code=once`),{code:'mcp_project_mismatch'});
  assert.equal(h.grant,null);assert.equal(h.mcpCalls,0);
});

test('MCP discovery accepts a streamed server response',async()=>{
  const h=harness(projectA,true),url=await h.service.begin('company-a');
  const state=new URL(url).searchParams.get('state');
  await h.service.complete(`/siyadah-api/v1/mcp/callback?state=${encodeURIComponent(state)}&code=once`);
  assert.equal((await h.service.call('company-a','tools/list',{})).tools[0].name,'ap_search_actions');
});

test('tool approval can be consumed only once in its company and conversation',async()=>{
  const h=harness(),id=await h.service.prepare({tenantId:'company-a',conversationId:'chat-a',toolName:'ap_run_action',args:{pieceName:'google-calendar'},summary:'اقرأ تقويمي'});
  assert.equal(await h.service.consume({tenantId:'company-b',conversationId:'chat-a',id}),null);
  assert.equal(await h.service.consume({tenantId:'company-a',conversationId:'chat-b',id}),null);
  const approved=await h.service.consume({tenantId:'company-a',conversationId:'chat-a',id});
  assert.deepEqual(approved.args,{pieceName:'google-calendar'});
  assert.equal(await h.service.consume({tenantId:'company-a',conversationId:'chat-a',id}),null);
});
