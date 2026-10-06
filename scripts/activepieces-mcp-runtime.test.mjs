import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createActivepiecesMcp} from '../lib/activepieces-mcp.mjs';

const projectA='AAAAAAAAAAAAAAAAAAAAA',projectB='BBBBBBBBBBBBBBBBBBBBB';
const token=project=>'header.'+Buffer.from(JSON.stringify({projectId:project,exp:Math.floor(Date.now()/1000)+900})).toString('base64url')+'.signature';
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});

function harness(tokenProject=projectA,sse=false){
  let grant=null,approval=null,mcpCalls=0,refreshCalls=0,tokenCalls=0,grantWrites=0,registrations=0,rejectMcp=false,rejectRefresh=false,lifetime=900,currentProject=projectA,rotate=false;
  const query=async(sql,values=[])=>{
    if(sql.includes('INSERT INTO siyadah_mcp_grants')){grantWrites++;grant={project_id:values[1],client_id:values[2],refresh_token_cipher:values[3],updated_at:new Date(Date.UTC(2026,9,6,0,0,grantWrites))};return {rows:[]};}
    if(sql.includes('SELECT project_id,client_id,refresh_token_cipher'))return {rows:grant&&values[0]==='company-a'?[grant]:[]};
    if(sql.includes('SELECT project_id,client_id FROM'))return {rows:grant&&values[0]==='company-a'?[grant]:[]};
    if(sql.includes('UPDATE siyadah_mcp_grants')){grant.refresh_token_cipher=values[0];return {rows:[]};}
    if(sql.includes('INSERT INTO siyadah_mcp_approvals')){approval={id:values[0],tenant_id:values[1],conversation_id:values[2],employee_id:values[3],tool_name:values[4],args_cipher:values[5],summary:values[6]};return {rows:[]};}
    if(sql.includes('DELETE FROM siyadah_mcp_approvals')){
      if(!approval||approval.id!==values[0]||approval.tenant_id!==values[1]||approval.conversation_id!==values[2])return {rows:[]};
      const row=approval;approval=null;return {rows:[row]};
    }
    return {rows:[]};
  };
  const fetchImpl=async(url,options)=>{
    if(url.endsWith('/register')){registrations++;return json({client_id:`siyadah-client-${registrations}`});}
    if(url.endsWith('/token')){
      tokenCalls++;
      if(options.body.get('grant_type')==='refresh_token'){refreshCalls++;if(rejectRefresh)return new Response(JSON.stringify(typeof rejectRefresh==='string'?{error:rejectRefresh,error_description:'private provider details'}:{}),{status:400});}
      return json({access_token:token(tokenProject),refresh_token:rotate?'refresh-secret-'+refreshCalls:'refresh-secret',expires_in:lifetime});
    }
    if(url.endsWith('/mcp')){
      mcpCalls++;
      if(rejectMcp)return new Response('{}',{status:401});
      const payload={jsonrpc:'2.0',id:1,result:options.body.includes('tools/list')?{tools:[{name:'ap_search_actions'}]}:{content:[{type:'text',text:'ok'}]}};
      return sse?new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`,{status:200,headers:{'content-type':'text/event-stream'}}):json(payload);
    }
    throw new Error('unexpected provider URL');
  };
  const service=createActivepiecesMcp({query,requireProject:async()=>currentProject,activepiecesUrl:'https://ap.example.test',origin:'https://siyadah.example.test',secret:'s'.repeat(40),fetchImpl});
  return {service,get grant(){return grant;},get mcpCalls(){return mcpCalls;},get refreshCalls(){return refreshCalls;},get tokenCalls(){return tokenCalls;},dropGrant(){grant=null;},changeGrant(){grant.client_id+='-new';},foreignToken(){tokenProject=projectB;},rejectMcp(value){rejectMcp=value;},rejectRefresh(value){rejectRefresh=value;},setLifetime(value){lifetime=value;},changeProject(){currentProject=projectB;},rotate(){rotate=true;},corruptGrant(){grant.refresh_token_cipher+='x';}};
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

async function connect(h){
  const state=new URL(await h.service.begin('company-a')).searchParams.get('state');
  await h.service.complete(`/siyadah-api/v1/mcp/callback?state=${encodeURIComponent(state)}&code=once`);
}

test('one chat request shares a token across discovery and parallel tool calls; another request refreshes',async()=>{
  const h=harness();await connect(h);
  const request=h.service.forRequest();
  await Promise.all([request.call('company-a','tools/list',{}),request.call('company-a','initialize',{})]);
  await request.call('company-a','tools/call',{name:'ap_list_flows',arguments:{}});
  assert.equal(h.refreshCalls,1);
  await h.service.forRequest().call('company-a','tools/list',{});
  assert.equal(h.refreshCalls,2);
});

test('expiry renews the token before the next tool call',async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.now()});
  const h=harness();await connect(h);const request=h.service.forRequest();
  await request.call('company-a','tools/list',{});
  t.mock.timers.tick(901_000);
  await request.call('company-a','tools/list',{});
  assert.equal(h.refreshCalls,2);
});

test('deleted and changed grants cannot reuse a cached authorization',async()=>{
  const h=harness();await connect(h);const request=h.service.forRequest();
  await request.call('company-a','tools/list',{});
  h.changeGrant();await request.call('company-a','tools/list',{});
  assert.equal(h.refreshCalls,2);
  h.dropGrant();const calls=h.mcpCalls;
  await assert.rejects(()=>request.call('company-a','tools/list',{}),{code:'mcp_not_connected'});
  assert.equal(h.mcpCalls,calls);
});

test('another tenant and a foreign refreshed project never reach MCP through the cache',async()=>{
  const h=harness();await connect(h);const request=h.service.forRequest();
  await request.call('company-a','tools/list',{});const calls=h.mcpCalls;
  await assert.rejects(()=>request.call('company-b','tools/list',{}),{code:'mcp_not_connected'});
  h.changeGrant();h.foreignToken();
  await assert.rejects(()=>request.call('company-a','tools/list',{}),{code:'mcp_project_mismatch'});
  assert.equal(h.mcpCalls,calls);
});

test('a rejected cached token is discarded without replaying a write',async()=>{
  const h=harness();await connect(h);const request=h.service.forRequest();
  await request.call('company-a','tools/list',{});const calls=h.mcpCalls;
  h.rejectMcp(true);
  await assert.rejects(()=>request.call('company-a','tools/call',{name:'ap_build_flow',arguments:{}}),{code:'mcp_grant_expired'});
  assert.equal(h.mcpCalls,calls+1);assert.equal(h.refreshCalls,1);
  h.rejectMcp(false);await request.call('company-a','tools/list',{});
  assert.equal(h.refreshCalls,2);
});

test('failed refresh is not retained, and missing lifetime is never reused',async()=>{
  const h=harness();await connect(h);const request=h.service.forRequest();
  h.rejectRefresh(true);
  await assert.rejects(()=>request.call('company-a','tools/list',{}),{code:'mcp_provider_error'});
  h.rejectRefresh(false);h.setLifetime(0);
  await request.call('company-a','tools/list',{});await request.call('company-a','tools/list',{});
  assert.equal(h.refreshCalls,3);
});

test('an expired native OAuth refresh grant requests consent without replaying tools or changing stored grants',async()=>{
  const h=harness();await connect(h);const request=h.service.forRequest(),cipher=h.grant.refresh_token_cipher,calls=h.mcpCalls;
  h.rejectRefresh('invalid_grant');
  await assert.rejects(()=>request.call('company-a','tools/call',{name:'ap_build_flow',arguments:{}}),error=>{
    assert.equal(error.code,'mcp_grant_expired');assert.equal(error.status,409);
    assert.ok(!error.message.includes('private provider details'));return true;
  });
  assert.equal(h.mcpCalls,calls);assert.equal(h.refreshCalls,1);assert.equal(h.grant.refresh_token_cipher,cipher);
  // The owner re-completes the existing native OAuth flow; no fabricated token or account is needed.
  h.rejectRefresh(false);await connect(h);await request.call('company-a','tools/list',{});
  assert.equal(h.refreshCalls,2);
});

test('other native OAuth refresh failures remain provider errors rather than a false consent requirement',async()=>{
  const h=harness();await connect(h);h.rejectRefresh('temporarily_unavailable');
  await assert.rejects(()=>h.service.call('company-a','tools/list',{}),{code:'mcp_provider_error',status:502});
});


test('refresh token rotation updates storage without causing another refresh in the same request',async()=>{
  const h=harness();await connect(h);h.rotate();const request=h.service.forRequest();
  await request.call('company-a','tools/list',{});await request.call('company-a','tools/list',{});
  assert.equal(h.refreshCalls,1);
  await h.service.forRequest().call('company-a','tools/list',{});assert.equal(h.refreshCalls,2);
});

test('project remapping and encrypted grant tampering fail before another RPC',async()=>{
  for(const change of ['changeProject','corruptGrant']){
    const h=harness();await connect(h);const request=h.service.forRequest();
    await request.call('company-a','tools/list',{});const calls=h.mcpCalls;h[change]();
    await assert.rejects(()=>request.call('company-a','tools/list',{}),{code:change==='changeProject'?'mcp_not_connected':'mcp_state_invalid'});
    assert.equal(h.mcpCalls,calls);
  }
});

test('malformed expiry cannot retain a token for the request',async()=>{
  const h=harness();await connect(h);h.setLifetime('invalid');const request=h.service.forRequest();
  await request.call('company-a','tools/list',{});await request.call('company-a','tools/list',{});
  assert.equal(h.refreshCalls,2);
});

test('customer-bound OAuth requires the initiating company session before any token exchange or grant write',async()=>{
  const h=harness(),url=await h.service.begin('company-a',{sessionBinding:'session-binding-a'}),state=new URL(url).searchParams.get('state');
  const callback=`/siyadah-api/v1/mcp/callback?state=${encodeURIComponent(state)}&code=once`;
  assert.ok(!url.includes('session-binding-a'),'session binding must remain encrypted');
  for(const context of [undefined,{tenantId:'company-a'},{tenantId:'company-b',sessionBinding:'session-binding-a'},{tenantId:'company-a',sessionBinding:'other-session'}]){
    await assert.rejects(()=>h.service.complete(callback,context),{code:'mcp_session_mismatch',status:403});
    assert.equal(h.tokenCalls,0);assert.equal(h.mcpCalls,0);assert.equal(h.grant,null);
  }
  await h.service.complete(callback,{tenantId:'company-a',sessionBinding:'session-binding-a'});
  assert.equal(h.tokenCalls,1);assert.equal(h.grant.project_id,projectA);
});

test('legacy internal OAuth remains completable without a customer session context',async()=>{
  const h=harness();await connect(h);assert.equal(h.grant.project_id,projectA);
});

test('grant status is local presence only, exposes no secrets and never probes the provider',async()=>{
  const h=harness();assert.deepEqual(await h.service.status('company-a'),{grantPresent:false});
  assert.equal(h.tokenCalls,0);assert.equal(h.mcpCalls,0);
  await connect(h);const tokenCalls=h.tokenCalls,mcpCalls=h.mcpCalls;
  h.rejectRefresh(true);h.rejectMcp(true);
  assert.deepEqual(await h.service.status('company-a'),{grantPresent:true,grantRevision:createHash('sha256').update('siyadah-client-1').digest('hex')});
  assert.deepEqual(await h.service.status('company-b'),{grantPresent:false});
  h.changeProject();assert.deepEqual(await h.service.status('company-a'),{grantPresent:false});
  assert.equal(h.tokenCalls,tokenCalls);assert.equal(h.mcpCalls,mcpCalls);
});

test('grant status revision identifies public OAuth registration and ignores timestamps or token rotation',async()=>{
  const h=harness();await connect(h);const first=await h.service.status('company-a');
  h.grant.updated_at=new Date();assert.deepEqual(await h.service.status('company-a'),first);
  h.rotate();await h.service.call('company-a','tools/list',{});assert.deepEqual(await h.service.status('company-a'),first);
  await connect(h);const second=await h.service.status('company-a');
  assert.notEqual(first.grantRevision,second.grantRevision);
  assert.equal(second.grantRevision,createHash('sha256').update('siyadah-client-2').digest('hex'));
  h.grant.client_id=' ';assert.deepEqual(await h.service.status('company-a'),{grantPresent:true,grantRevision:null});
  delete h.grant.client_id;assert.deepEqual(await h.service.status('company-a'),{grantPresent:true,grantRevision:null});
  assert.deepEqual(await h.service.status('company-b'),{grantPresent:false});
});
