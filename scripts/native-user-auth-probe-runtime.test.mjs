import test from 'node:test';
import assert from 'node:assert/strict';
import {runNativeAuthProbe} from './native-user-auth-probe.mjs';

const origin='https://activepieces-production-82ad.up.railway.app',project='rPMd07kp7x3epzOdvdiQJ';
// Mock metadata only; no private signing key or production token is used.
const token=payload=>`mock.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.mock`;
const now=()=>Math.floor(Date.now()/1000);
const env={ACTIVEPIECES_OPERATOR_EMAIL:'operator@example.invalid',ACTIVEPIECES_OPERATOR_PASSWORD:'MOCK_SECRET_ONLY'};
function fixture({user={},mcp={},endpoint=`${origin}/mcp`,failureAt=0,status=403,sse=false}={}){
  const calls=[],receipts=[];
  const fetchImpl=async(url,options)=>{
    calls.push([url,options]);assert.equal(options.redirect,'error');
    if(calls.length===failureAt)return {ok:false,status,text:async()=>JSON.stringify({password:env.ACTIVEPIECES_OPERATOR_PASSWORD})};
    const data=calls.length===1?{token:token({type:'USER',iat:now(),exp:now()+604800,...user})}:calls.length===2?{mcpServerUrl:endpoint,mcpToken:token({type:'mcp_oauth',projectId:project,iat:now(),exp:now()+900,...mcp})}:{jsonrpc:'2.0',id:1,result:{tools:[{name:'ap_get_run'}]}};
    return {ok:true,status:200,text:async()=>sse&&calls.length===3?`event: message\ndata: ${JSON.stringify(data)}\n\n`:JSON.stringify(data)};
  };
  return {calls,receipts,run:extra=>runNativeAuthProbe({env,fetchImpl,onReceipt:value=>receipts.push(value),...extra})};
}
test('missing configuration and non-QA project stop before any sign-in',async()=>{
  const f=fixture();assert.equal((await f.run({env:{}})).code,'missing_config');
  assert.equal((await f.run({env:{...env,SIYADAH_NATIVE_AUTH_QA_PROJECT_ID:'foreign'}})).code,'qa_project_not_allowlisted');
  assert.equal(f.calls.length,0);
});
test('native probe uses only pinned native auth routes and fixed project tools/list',async()=>{
  const f=fixture();assert.equal((await f.run()).ok,true);
  assert.deepEqual(f.calls.map(x=>x[0]),[`${origin}/api/v1/authentication/sign-in`,`${origin}/api/v1/projects/${project}/mcp-server/token`,`${origin}/mcp`]);
  assert.deepEqual(JSON.parse(f.calls[0][1].body),{email:env.ACTIVEPIECES_OPERATOR_EMAIL,password:env.ACTIVEPIECES_OPERATOR_PASSWORD});
  assert.deepEqual(JSON.parse(f.calls[2][1].body),{jsonrpc:'2.0',id:1,method:'tools/list',params:{}});
  assert.equal(f.calls[2][1].headers.accept,'application/json, text/event-stream');
  const logged=JSON.stringify(f.receipts);assert.ok(!logged.includes(env.ACTIVEPIECES_OPERATOR_PASSWORD)&&!logged.includes('Bearer')&&!logged.includes('mock.'));
});
test('SERVICE or expired USER cannot reach project token issuance',async()=>{
  for(const user of [{type:'SERVICE'},{exp:now()-1}]){const f=fixture({user});assert.equal((await f.run()).code,'invalid_user_principal');assert.equal(f.calls.length,1);}
});
test('wrong project type expired future-dated and oversized TTL MCP tokens never reach RPC',async()=>{
  for(const mcp of [{projectId:'foreign'},{type:'USER'},{exp:now()-1},{iat:now()+120,exp:now()+900},{exp:now()+2000},{iat:now()-2000,exp:now()+100}]){
    const f=fixture({mcp});assert.equal((await f.run()).code,'mcp_project_or_token_mismatch');assert.equal(f.calls.length,2);
  }
});
test('a provider-supplied foreign MCP URL is rejected before token transport',async()=>{
  const f=fixture({endpoint:'https://example.invalid/mcp'});assert.equal((await f.run()).code,'invalid_mcp_endpoint');assert.equal(f.calls.length,2);
});
test('native 403 is a sanitized stage rejection and does not expose the raw body',async()=>{
  const f=fixture({failureAt:2});assert.equal((await f.run()).code,'http_rejected');
  assert.deepEqual(f.receipts.at(-1),{stage:'project_mcp_issuance',ok:false,code:'http_rejected',httpStatus:403});
  assert.ok(!JSON.stringify(f.receipts).includes(env.ACTIVEPIECES_OPERATOR_PASSWORD));
});
test('transport exceptions including secret text are sanitized without retry',async()=>{
  const f=fixture();const result=await f.run({fetchImpl:async()=>{throw new Error(env.ACTIVEPIECES_OPERATOR_PASSWORD);}});
  assert.equal(result.code,'transport_failed');assert.ok(!JSON.stringify(f.receipts).includes(env.ACTIVEPIECES_OPERATOR_PASSWORD));
});
test('tools/list accepts native event-stream framing without logging returned metadata',async()=>{
  const f=fixture({sse:true});assert.equal((await f.run()).ok,true);assert.equal(f.receipts.at(-1).toolCount,1);assert.ok(!JSON.stringify(f.receipts).includes('ap_get_run'));
});
test('each explicit probe invocation obtains fresh native USER and project tokens',async()=>{
  const a=fixture(),b=fixture();await a.run();await b.run();assert.equal(a.calls.length,3);assert.equal(b.calls.length,3);
});
