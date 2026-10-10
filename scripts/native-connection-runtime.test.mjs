import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeMcpAuth} from '../lib/activepieces-native-auth.mjs';
import {createActivepiecesMcp} from '../lib/activepieces-mcp.mjs';

const A='A'.repeat(21),B='B'.repeat(21),base='https://ap.example';
const jwt=payload=>`header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
function provider(overrides={}){
  let now=1_800_000_000_000,signins=0,mints=0;
  const auth=createNativeMcpAuth({url:base,email:'qa@example.invalid',password:'private-test-password',now:()=>now,fetchImpl:async(url,options)=>{
    if(url.endsWith('/sign-in')){signins++;return Response.json({token:jwt({type:overrides.userType||'USER',exp:now/1000+3600})});}
    mints++;const project=url.split('/projects/')[1].split('/')[0];
    return Response.json({mcpServerUrl:overrides.endpoint||base+'/mcp',mcpToken:jwt({type:'mcp_oauth',projectId:overrides.project||project,exp:now/1000+(overrides.lifetime||900)})});
  }});
  return {auth,advance(ms){now+=ms;},counts:()=>({signins,mints})};
}
test('native auth coalesces concurrent minting and signs in once for distinct projects',async()=>{
  const p=provider();await Promise.all(Array.from({length:12},()=>p.auth.tokenFor(A)));await p.auth.tokenFor(B);
  assert.deepEqual(p.counts(),{signins:1,mints:2});p.advance(841_000);await p.auth.tokenFor(A);
  assert.deepEqual(p.counts(),{signins:1,mints:3});
});
test('native auth rejects foreign project excessive lifetime non-user and foreign endpoint',async()=>{
  for(const [options,code] of [[{project:B},'native_project_mismatch'],[{lifetime:1000},'native_lifetime_invalid'],[{userType:'SERVICE'},'native_user_token_invalid'],[{endpoint:'https://foreign.example/mcp'},'native_endpoint_mismatch']])await assert.rejects(()=>provider(options).auth.tokenFor(A),{code});
});
test('native credentials never leave an insecure origin or follow redirects',async()=>{
  let sent=0;
  const insecure=createNativeMcpAuth({url:'http://ap.example',email:'qa',password:'private',fetchImpl:async()=>{sent++;}});
  await assert.rejects(()=>insecure.tokenFor(A),{code:'native_not_configured'});assert.equal(sent,0);
  const redirected=createNativeMcpAuth({url:base,email:'qa',password:'private',fetchImpl:async(url,options)=>{assert.equal(options.redirect,'error');throw new Error('private');}});
  await assert.rejects(()=>redirected.tokenFor(A),{code:'native_transport_failed'});
});
function engine({enabled=true,configured=true,catalog={tools:[{name:'ap_setup_guide'}]},failures=0}={}){
  let reads=0,mints=0,drops=0;const calls=[];
  const service=createActivepiecesMcp({query:async()=>{reads++;return {rows:[]};},requireProject:async company=>company==='company-a'?A:B,activepiecesUrl:base,
    nativeEnabled:async company=>enabled&&company==='company-a',native:{configured,tokenFor:async project=>{mints++;return 'private-'+project;},drop:()=>{drops++;}},
    fetchImpl:async(url,options)=>{calls.push({url,token:options.headers.authorization,request:JSON.parse(options.body)});if(failures-->0)return new Response('{}',{status:401});return Response.json({jsonrpc:'2.0',id:1,result:catalog});}});
  return {service,calls,counts:()=>({reads,mints,drops})};
}
test('native status requires actual catalog and does not depend on legacy OAuth or grant storage',async()=>{
  const h=engine();assert.equal((await h.service.status('company-a')).liveVerified,true);assert.equal(h.counts().reads,0);
  for(const catalog of [{},{tools:[]},{tools:[{}]},{isError:true,tools:[{name:'x'}]}])assert.deepEqual(await engine({catalog}).service.status('company-a'),{authMode:'native',grantPresent:false,liveVerified:false});
});
test('enabled native missing credentials never falls back to stored grants',async()=>{
  const h=engine({configured:false});await assert.rejects(()=>h.service.call('company-a','tools/list',{}),{code:'native_not_configured'});
  assert.equal(h.counts().reads,0);assert.equal((await h.service.status('company-a')).authMode,'native');
  await assert.rejects(()=>h.service.call('company-b','tools/list',{}),{code:'mcp_not_configured'});
});
test('native 401 retries once preserving trace and the exact request, other errors do not replay',async t=>{
  const trace=[];t.mock.method(console,'info',(label,data)=>{if(label==='native_mcp_dispatch')trace.push(JSON.parse(data));});
  const h=engine({failures:1});const args={name:'ap_get_flow',arguments:{flowId:'flow'}};
  await h.service.forRequest({conversationId:'conversation'}).forToolCall('call').call('company-a','tools/call',args);
  assert.deepEqual(h.counts(),{reads:0,mints:2,drops:1});assert.deepEqual(h.calls[0].request,h.calls[1].request);
  assert.equal(trace.length,2);assert.ok(trace.every(row=>row.conversation_id==='conversation'&&row.tool_call_id==='call'));
  assert.doesNotMatch(JSON.stringify(trace),/private-/);
  const twice=engine({failures:2});await assert.rejects(()=>twice.service.call('company-a','tools/list',{}),{code:'mcp_grant_expired'});assert.equal(twice.calls.length,2);
});
