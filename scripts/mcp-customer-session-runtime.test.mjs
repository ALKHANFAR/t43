import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';

const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const accessSource=source.slice(source.indexOf('async function customerMcpAccess('),source.indexOf('async function scrapeWeb('));
const callbackSource=source.slice(source.indexOf('async function finishMcpGrant('),source.indexOf('async function customerMcpAccess('));
class TenantProjectError extends Error{constructor(code,message,status){super(message);this.code=code;this.status=status;}}
const origin='https://accounts.example';
function harness({invalidSession=false,input={},grantPresent=false,grantRevision=null,projectMissing=false,verificationError=false,boundCallback=false,authorizationUrl='https://ap.example/authorize?client_id=registered-client&state=sealed'}={}){
  const calls=[];
  const context={TenantProjectError,createHash,URL,console:{warn(){}},publicOrigin:()=>origin,
    tenantSession:async()=>{calls.push('session');if(invalidSession)throw new TenantProjectError('unauthorized','login',401);return {session:{companyId:'company-a'}};},
    body:async()=>{calls.push('body');return input;},oauthSessionBinding:()=> 'session-bound',
    database:async()=>{calls.push('database');return {query:async()=>({rows:[]})};},
    tenantProjects:async()=>({ensure:async()=>{throw Error('must use verified provisioning');}}),
    provisionVerifiedTenant:async value=>{calls.push(['provision',value.tenantId]);if(verificationError)throw new TenantProjectError('email_not_verified','verify',403);},
    activepiecesMcp:async()=>{calls.push('adapter');return {
      begin:async(company,options)=>{calls.push(['begin',company,options.sessionBinding]);return authorizationUrl;},
      status:async company=>{calls.push(['status',company]);if(projectMissing)throw new TenantProjectError('project_not_ready','project',409);return {grantPresent,grantRevision};},
      complete:async(url,options)=>{calls.push(['complete',options]);if(boundCallback&&options.sessionBinding!=='session-bound')throw new TenantProjectError('mcp_session_mismatch','session',403);},
    };},
    json:(_res,status,body)=>({status,body}),
  };
  return {calls,run:runInNewContext(`${accessSource}; customerMcpAccess`,context),callback:runInNewContext(`${callbackSource}; finishMcpGrant`,context)};
}
test('customer MCP access rejects invalid sessions before provisioning or provider access',async()=>{
  for(const op of ['start','status']){const h=harness({invalidSession:true});const r=await h.run({headers:{origin}}, {},op);assert.equal(r.status,401);assert.deepEqual(h.calls,['session']);}
});
test('customer MCP start rejects all client-supplied scope and unsupported bodies before provider access',async()=>{
  for(const input of [{companyId:'foreign'},{tenantId:'foreign'},{projectId:'foreign'},{scope:'foreign'},{op:'start'},[],null]){
    const h=harness({input});const r=await h.run({headers:{origin}}, {},'start');assert.equal(r.status,400);assert.deepEqual(h.calls,['session','body']);
  }
});
test('customer MCP start requires the exact customer origin before body or provider access',async()=>{
  for(const supplied of [undefined,'https://foreign.example',`${origin}/`]){const h=harness();const r=await h.run({headers:{origin:supplied}}, {},'start');assert.equal(r.status,403);assert.deepEqual(h.calls,['session']);}
});
test('customer MCP start uses verified session company and binds the original authorization',async()=>{
  const h=harness();const r=await h.run({headers:{origin}}, {},'start');assert.equal(r.status,200);assert.equal(r.body.state,'authorization_required');assert.ok(r.body.authorizationUrl);
  assert.equal(r.body.authorizationRevision,createHash('sha256').update('registered-client').digest('hex'));
  assert.deepEqual(h.calls,['session','body','database',['provision','company-a'],'adapter',['begin','company-a','session-bound']]);
});
test('missing native registration client cannot produce a successful customer authorization receipt',async()=>{
  const h=harness({authorizationUrl:'https://ap.example/authorize?state=sealed'});const r=await h.run({headers:{origin}},{},'start');
  assert.equal(r.status,502);assert.equal(r.body.error,'mcp_registration_invalid');assert.equal(r.body.authorizationRevision,undefined);assert.equal(r.body.authorizationUrl,undefined);
});
test('unverified customer cannot begin authorization',async()=>{
  const h=harness({verificationError:true});const r=await h.run({headers:{origin}}, {},'start');assert.equal(r.status,403);assert.equal(h.calls.includes('adapter'),false);
});
test('customer MCP status is a read-only local grant observation and never provisions or claims live readiness',async()=>{
  for(const grantPresent of [true,false]){const h=harness({grantPresent});const r=await h.run({headers:{}}, {},'status');assert.equal(r.status,200);assert.equal(r.body.state,grantPresent?'authorization_stored':'authorization_required');assert.equal(r.body.grantRevision,null);assert.equal(r.body.liveVerified,false);assert.deepEqual(h.calls,['session','adapter',['status','company-a']]);}
  const h=harness({projectMissing:true});const r=await h.run({headers:{}}, {},'status');assert.equal(r.body.state,'project_required');assert.equal(r.body.liveVerified,false);assert.deepEqual(h.calls,['session','adapter',['status','company-a']]);
});
test('stored authorization revision is forwarded without claiming a live provider check',async()=>{
  const grantRevision=createHash('sha256').update('registered-client').digest('hex');const h=harness({grantPresent:true,grantRevision});
  const r=await h.run({headers:{}},{},'status');assert.equal(r.body.grantRevision,grantRevision);assert.equal(r.body.liveVerified,false);
});
test('MCP callback supplies company binding only from a valid session; missing session leaves bound-state rejection to adapter',async()=>{
  for(const invalidSession of [false,true]){const h=harness({invalidSession});let status;const res={writeHead:value=>{status=value;},end(){}};await h.callback({url:'/callback?state=sealed&code=native',headers:{}},res);assert.equal(status,200);const options=h.calls.find(value=>Array.isArray(value)&&value[0]==='complete')[1];assert.equal(options.tenantId,invalidSession?undefined:'company-a');assert.equal(options.sessionBinding,invalidSession?undefined:'session-bound');}
});
test('a rejected bound callback returns a failed page and never substitutes a different authorization attempt',async()=>{
  const h=harness({invalidSession:true,boundCallback:true});let status;let page;
  await h.callback({url:'/callback?state=bound&code=native',headers:{}},{writeHead:value=>{status=value;},end:value=>{page=value;}});
  assert.equal(status,400);assert.equal(h.calls.filter(value=>Array.isArray(value)&&value[0]==='complete').length,1);assert.match(page,/لم يكتمل/);
});
