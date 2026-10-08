import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,createHash,randomBytes} from 'node:crypto';
import {createToolConnectionService} from '../lib/tool-connections.mjs';

const PROJECT='P'.repeat(21),OTHER='Q'.repeat(21),CONNECTION='C'.repeat(21),FLOW='F'.repeat(21);
const stripe={name:'@activepieces/piece-stripe',displayName:'Stripe',version:'0.7.0',auth:{type:'SECRET_TEXT',displayName:'Secret API Key',required:true}};
const whatsapp={name:'@activepieces/piece-whatsapp',displayName:'WhatsApp',version:'1.0.0',auth:{type:'CUSTOM_AUTH',required:true,props:{access_token:{displayName:'Access token',required:true,type:'SECRET_TEXT'},businessAccountId:{displayName:'Business ID',required:true,type:'SHORT_TEXT'}}}};
const SEND_SCOPE='https://www.googleapis.com/auth/gmail.send',ORIGIN='https://accounts.siyadah-ai.com';
const gmail={name:'@activepieces/piece-gmail',displayName:'Gmail',version:'0.17.0',auth:[{type:'OAUTH2',displayName:'Google',authUrl:'https://accounts.google.com/o/oauth2/auth',scope:[SEND_SCOPE,'https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.compose','https://www.googleapis.com/auth/gmail.modify','email'],props:{private_hint:{displayName:'Private hint',required:false,type:'SECRET_TEXT'}}},{type:'CUSTOM_AUTH',displayName:'Service account',props:{json:{displayName:'JSON',required:true,type:'LONG_TEXT'}}}]};
const slack={name:'@activepieces/piece-slack',displayName:'Slack',version:'0.1.0',auth:{type:'OAUTH2',authUrl:'https://slack.com/oauth/v2/authorize',scope:['chat:write'],props:{}}};

function response(status,body){return {ok:status>=200&&status<300,status,json:async()=>body};}
function seedExistingAttempt(h,{cloud=false,overrides={},sessionBinding='session-a'}={}){
  const expiresAt=Date.now()+60_000,payload={...(cloud?{provider:'activepieces',codeVerifier:'existing-verifier'}:{verifier:'existing-verifier'}),tenantId:'company-a',pieceName:gmail.name,pieceVersion:gmail.version,displayName:'Gmail',clientId:'google-client',props:{},scopes:SEND_SCOPE,authorizationMethod:'BODY',expiresAt,...overrides};
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',createHash('sha256').update('s'.repeat(48)).digest(),iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
  const state=`v1.${iv.toString('base64url')}.${encrypted.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
  h.pending.set(state,{state,companyId:'company-a',sessionBinding,expiresAt:payload.expiresAt});
  return state;
}
function assertCustomerConnection(connection,slug){
  assert.equal(connection.slug,slug);
  assert.equal(Object.hasOwn(connection,'pieceName'),false);
  assert.equal(Object.hasOwn(connection,'pieceVersion'),false);
  assert.doesNotMatch(JSON.stringify(connection),/@activepieces\//);
}
function harness(overrides={}){
  const calls=[];
  const pending=new Map(),attemptStore={save:async value=>{pending.set(value.state,value);},consume:async value=>{const prior=pending.get(value.state);if(!prior||prior.companyId!==value.companyId||prior.sessionBinding!==value.sessionBinding||prior.expiresAt<Date.now())return false;pending.delete(value.state);return true;}};
  const projects=stage=>Object.hasOwn(overrides,stage)?overrides[stage]:(overrides.foreign&&stage==='list'?[OTHER]:[PROJECT]);
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options,body:options.body?JSON.parse(options.body):null});
    if(url.startsWith('https://secrets.activepieces.com/apps'))return response(200,{'@activepieces/piece-gmail':{clientId:'google-client'},'@activepieces/piece-slack':{clientId:'slack-client'}});
    if(url.includes('/api/v1/pieces')){
      const name=new URL(url).searchParams.get('searchQuery');return response(200,[name==='stripe'?stripe:name==='whatsapp'?whatsapp:name==='slack'?slack:overrides.gmail||gmail]);
    }
    if(url.includes('/oauth2/authorization-url'))return response(200,{authorizationUrl:'https://accounts.google.com/o/oauth2/auth?client_id=google-client'});
    if(url.includes('/revalidate'))return response(200,{id:CONNECTION,pieceName:'@activepieces/piece-stripe',pieceVersion:'0.7.0',displayName:'Stripe',status:'ACTIVE',scope:'PROJECT',projectIds:projects('revalidate')});
    if(options.method==='DELETE')return response(204,{});
    if(url.includes(`/app-connections/${CONNECTION}`))return response(200,{id:CONNECTION,externalId:'company-a-stripe',pieceName:'@activepieces/piece-stripe',scope:'PROJECT',projectIds:projects('get'),flowIds:Object.hasOwn(overrides,'getFlowIds')?overrides.getFlowIds:[]});
    if(url.includes('/api/v1/flows?')){const query=new URL(url).searchParams,cursor=query.get('cursor'),state=query.get('versionState');return response(200,overrides.flowPages?.[state]?.[cursor||'first']??(state==='LOCKED'?overrides.publishedPages?.[cursor||'first']:undefined)??{data:[],next:null});}
    if(url.includes('/app-connections?')){
      const cursor=new URL(url).searchParams.get('cursor');
      return response(200,overrides.connectionPages?.[cursor||'first']??{data:[{id:CONNECTION,pieceName:'@activepieces/piece-stripe',pieceVersion:'0.7.0',displayName:'Stripe',status:'ACTIVE',scope:'PROJECT',projectIds:projects('list'),projectId:overrides.projectIdOnly?PROJECT:undefined,flowIds:[FLOW,'invalid']}],next:null});
    }
    if(url.endsWith('/api/v1/app-connections')){const b=JSON.parse(options.body);return response(201,{id:CONNECTION,pieceName:b.pieceName,pieceVersion:b.pieceVersion,displayName:b.displayName,status:'ACTIVE',scope:'PROJECT',projectIds:projects('create')});}
    throw new Error(`unexpected ${url}`);
  };
  return {calls,pending,service:createToolConnectionService({requireProject:async tenant=>tenant==='company-a'?PROJECT:OTHER,mcp:overrides.mcp,fetchImpl,activepiecesUrl:'https://ap.example',apiKey:'platform-key',attemptSecret:'s'.repeat(48),attemptStore,googleOAuth:overrides.googleOAuth,customerOrigin:overrides.customerOrigin,gmailOAuthProvider:overrides.gmailOAuthProvider})};
}

test('shows only valid flow references from a project-owned connection',async()=>{
  const {service}=harness();
  const connection=(await service.list('company-a'))[0];
  assert.equal(connection.scope,'PROJECT');
  assert.deepEqual(connection.flowIds,[FLOW]);
  assertCustomerConnection(connection,'stripe');
});

test('one-shot action can use only an active external connection exclusive to its company project',async()=>{
  const row={id:CONNECTION,externalId:'company-a-calendar',pieceName:'@activepieces/piece-google-calendar',status:'ACTIVE',scope:'PROJECT',projectIds:[PROJECT],flowIds:[]};
  const {service}=harness({connectionPages:{first:{data:[row],next:null}}});
  await service.assertOwnedExternal({tenantId:'company-a',externalId:row.externalId,pieceName:row.pieceName});
  await assert.rejects(()=>service.assertOwnedExternal({tenantId:'company-b',externalId:row.externalId,pieceName:row.pieceName}),{code:'connection_project_mismatch'});
  await assert.rejects(()=>service.assertOwnedExternal({tenantId:'company-a',externalId:row.externalId,pieceName:'@activepieces/piece-gmail'}),{code:'connection_not_owned'});
  await assert.rejects(()=>service.assertOwnedExternal({tenantId:'company-a',externalId:'other',pieceName:row.pieceName}),{code:'connection_not_owned'});
});

test('lists every page of the company project connections',async()=>{
  const first={id:CONNECTION,pieceName:'@activepieces/piece-stripe',scope:'PROJECT',projectIds:[PROJECT]};
  const second={id:'D'.repeat(21),pieceName:'@activepieces/piece-slack',scope:'PROJECT',projectIds:[PROJECT]};
  const {service,calls}=harness({connectionPages:{first:{data:[first],next:'page-2'},'page-2':{data:[second],next:null}}});
  assert.deepEqual((await service.list('company-a')).map(row=>row.slug),['stripe','slack']);
  const pages=calls.filter(call=>call.url.includes('/app-connections?'));
  assert.equal(pages.length,2);
  assert.equal(new URL(pages[1].url).searchParams.get('cursor'),'page-2');
  assert.equal(new URL(pages[1].url).searchParams.get('projectId'),PROJECT);
});

test('connection inventory rejects incomplete or repeated pages',async()=>{
  for(const connectionPages of [{first:{data:[]}},{first:{data:[],next:'again'},again:{data:[],next:'again'}}]){
    const {service}=harness({connectionPages});
    await assert.rejects(()=>service.list('company-a'),error=>error.code==='connection_inventory_unknown');
  }
});

test('rejects cross-company connection readback',async()=>{
  const {service}=harness({foreign:true});
  await assert.rejects(()=>service.list('company-a'),error=>error.code==='connection_project_mismatch'&&error.status===403);
});

test('shared or legacy projectId-only connection cannot be listed as company-owned',async()=>{
  for(const config of [{list:[PROJECT,OTHER]},{list:[]},{list:undefined,projectIdOnly:true}]){
    const {service}=harness(config);
    await assert.rejects(()=>service.list('company-a'),error=>error.code==='connection_project_mismatch'&&error.status===403);
  }
});

test('shared connection ownership is rejected before revalidate or disconnect writes',async()=>{
  const {service,calls}=harness({get:[PROJECT,OTHER]});
  await assert.rejects(()=>service.revalidate({tenantId:'company-a',id:CONNECTION}),error=>error.code==='connection_project_mismatch');
  await assert.rejects(()=>service.disconnect({tenantId:'company-a',id:CONNECTION}),error=>error.code==='connection_project_mismatch');
  assert.equal(calls.some(call=>call.url.includes('/revalidate')||call.options.method==='DELETE'),false);
});

test('revalidates and disconnects only after ownership readback',async()=>{
  const {service,calls}=harness();
  const revalidated=await service.revalidate({tenantId:'company-a',id:CONNECTION});
  assert.equal(revalidated.status,'ACTIVE');
  assertCustomerConnection(revalidated,'stripe');
  assert.equal((await service.disconnect({tenantId:'company-a',id:CONNECTION})).disconnected,true);
  assert.equal(calls.filter(call=>call.options.method==='DELETE').length,1);
});

test('in-use connection stays attached and is not reported as disconnected',async()=>{
  const {service,calls}=harness({getFlowIds:[FLOW]});
  await assert.rejects(
    ()=>service.disconnect({tenantId:'company-a',id:CONNECTION}),
    error=>error.code==='connection_in_use'&&error.status===409
  );
  assert.equal(calls.some(call=>call.options.method==='DELETE'),false);
});

test('published flow reference blocks disconnect even when connection flowIds omits it',async()=>{
  const published={id:FLOW,projectId:PROJECT,publishedVersionId:'V'.repeat(21),version:{id:'V'.repeat(21),state:'LOCKED',connectionIds:['company-a-stripe']}};
  const {service,calls}=harness({getFlowIds:[],publishedPages:{first:{data:[published],next:null}}});
  await assert.rejects(()=>service.disconnect({tenantId:'company-a',id:CONNECTION}),error=>error.code==='connection_in_use'&&error.status===409);
  assert.equal(calls.some(call=>call.options.method==='DELETE'),false);
});

test('checks later pages of published flows before disconnect',async()=>{
  const published={id:FLOW,projectId:PROJECT,publishedVersionId:'V'.repeat(21),version:{id:'V'.repeat(21),state:'LOCKED',connectionIds:['company-a-stripe']}};
  const {service,calls}=harness({getFlowIds:[],publishedPages:{first:{data:[],next:'page-2'},'page-2':{data:[published],next:null}}});
  await assert.rejects(()=>service.disconnect({tenantId:'company-a',id:CONNECTION}),error=>error.code==='connection_in_use');
  assert.equal(calls.filter(call=>call.url.includes('/api/v1/flows?')).length,3);
  assert.equal(calls.some(call=>call.options.method==='DELETE'),false);
});

test('checks later pages of draft flows before disconnect',async()=>{
  const draft={id:FLOW,projectId:PROJECT,version:{id:'V'.repeat(21),state:'DRAFT',connectionIds:['company-a-stripe']}};
  const {service,calls}=harness({getFlowIds:[],flowPages:{DRAFT:{first:{data:[],next:'page-2'},'page-2':{data:[draft],next:null}}}});
  await assert.rejects(()=>service.disconnect({tenantId:'company-a',id:CONNECTION}),error=>error.code==='connection_in_use');
  assert.equal(calls.filter(call=>call.url.includes('/api/v1/flows?')).length,2);
  assert.equal(calls.some(call=>call.options.method==='DELETE'),false);
});

test('incomplete published flow inventory fails closed before disconnect',async()=>{
  for(const pages of [{first:{data:[]}},{first:{data:[],next:'again'},again:{data:[],next:'again'}},{first:{data:[{id:FLOW,projectId:PROJECT,version:{state:'DRAFT',connectionIds:[]}}],next:null}}]){
    const {service,calls}=harness({getFlowIds:[],publishedPages:pages});
    await assert.rejects(()=>service.disconnect({tenantId:'company-a',id:CONNECTION}),error=>error.code==='connection_usage_unknown'&&error.status===409);
    assert.equal(calls.some(call=>call.options.method==='DELETE'),false);
  }
});

test('unknown or malformed flow references fail closed before disconnect',async()=>{
  for(const flowIds of [null,undefined,[FLOW,'invalid']]){
    const {service,calls}=harness({getFlowIds:flowIds});
    await assert.rejects(
      ()=>service.disconnect({tenantId:'company-a',id:CONNECTION}),
      error=>error.code==='connection_usage_unknown'&&error.status===409
    );
    assert.equal(calls.some(call=>call.options.method==='DELETE'),false);
  }
});

test('connection methods, fields and new connection preparation never fall back to REST metadata',async()=>{
  const {service,calls,pending}=harness({customerOrigin:ORIGIN,gmailOAuthProvider:'activepieces'});
  for(const op of [()=>service.methods({tenantId:'company-a',piece:'gmail',requestOrigin:ORIGIN}),()=>service.connect({tenantId:'company-a',piece:'stripe',type:'SECRET_TEXT',values:{secret_text:'test'}}),()=>service.oauthStart({tenantId:'company-a',sessionBinding:'session-a',requestOrigin:ORIGIN,piece:'gmail'})]){
    await assert.rejects(op,error=>error.code==='native_mcp_discovery_required'&&error.status===409);
  }
  assert.equal(calls.length,0);assert.equal(pending.size,0);
});

test('company MCP auth schema prepares a project-owned connection without REST piece discovery',async()=>{
  const mcpCalls=[],mcp={call:async(tenant,method,params)=>{mcpCalls.push({tenant,method,params});return {structuredContent:{schemaVersion:1,piece:stripe}};}};
  const {service,calls}=harness({mcp});
  const methods=await service.methods({tenantId:'company-a',piece:'stripe'});
  assert.equal(methods.methods[0].fields[0].type,'password');
  const connection=await service.connect({tenantId:'company-a',piece:'stripe',type:'SECRET_TEXT',methodId:methods.methods[0].id,methodFingerprint:methods.methods[0].fingerprint,values:{secret_text:'test-secret'}});
  assert.equal(connection.scope,'PROJECT');
  assert.equal(calls.find(item=>item.url.endsWith('/api/v1/app-connections')).body.projectId,PROJECT);
  assert.equal(calls.some(item=>item.url.includes('/api/v1/pieces')),false);
  assert.deepEqual(mcpCalls.map(item=>item.tenant),['company-a','company-a']);
  assert.ok(mcpCalls.every(item=>item.method==='tools/call'&&item.params.name==='ap_setup_guide'&&item.params.arguments.pieceName===stripe.name));
});

test('native MCP OAuth schema starts a company-bound provider consent attempt',async()=>{
  const {service,calls,pending}=harness({customerOrigin:ORIGIN,gmailOAuthProvider:'activepieces',mcp:{call:async()=>({structuredContent:{schemaVersion:1,piece:slack}})}});
  const method=(await service.methods({tenantId:'company-a',piece:'slack',requestOrigin:ORIGIN})).methods[0];
  assert.equal(method.available,true);
  assert.deepEqual(method.scopes,['chat:write']);
  const started=await service.oauthStart({tenantId:'company-a',sessionBinding:'session-a',requestOrigin:ORIGIN,piece:'slack',methodId:method.id,methodFingerprint:method.fingerprint});
  assert.equal(new URL(started.authorizationUrl).hostname,'slack.com');
  assert.equal(new URL(started.authorizationUrl).searchParams.get('scope'),'chat:write');
  assert.equal(pending.size,1);
  assert.equal(calls.some(item=>item.url.includes('/api/v1/pieces')||item.url.endsWith('/api/v1/app-connections')),false);
});

test('missing or foreign MCP auth schema fails closed before connection writes',async()=>{
  for(const structuredContent of [undefined,{schemaVersion:1,piece:{...stripe,name:'@activepieces/piece-gmail'}},{schemaVersion:1,piece:{...stripe,auth:undefined}}]){
    const {service,calls}=harness({mcp:{call:async()=>({structuredContent})}});
    await assert.rejects(()=>service.connect({tenantId:'company-a',piece:'stripe',type:'SECRET_TEXT',values:{secret_text:'test'}}),error=>error.code==='native_mcp_discovery_required');
    assert.equal(calls.length,0);
  }
});

const originalGoogle={clientId:'google-client',clientSecret:'test-client-secret',redirectUrl:`${ORIGIN}/siyadah-api/v1/integrations/oauth/callback`};
test('a previously issued own Google attempt still completes in its company without metadata discovery',async()=>{
  const h=harness({googleOAuth:originalGoogle,customerOrigin:ORIGIN}),state=seedExistingAttempt(h);
  const connected=await h.service.oauthFinish({tenantId:'company-a',sessionBinding:'session-a',state,code:'existing-code'});
  assertCustomerConnection(connected,'gmail');assert.equal(h.pending.size,0);
  assert.equal(h.calls.length,1);assert.ok(h.calls[0].url.endsWith('/api/v1/app-connections'));
  assert.equal(h.calls[0].body.projectId,PROJECT);assert.equal(h.calls[0].body.value.code,'existing-code');
  assert.equal(h.calls[0].body.value.code_challenge,'existing-verifier');
  assert.equal(h.calls[0].body.value.client_id,originalGoogle.clientId);
  assert.equal(h.calls[0].body.value.scope,SEND_SCOPE);
});
test('a previously issued Activepieces cloud attempt completes without restarting or reading metadata',async()=>{
  const h=harness({customerOrigin:ORIGIN,gmailOAuthProvider:'activepieces'}),attempt=seedExistingAttempt(h,{cloud:true});
  const connected=await h.service.cloudOauthFinish({tenantId:'company-a',sessionBinding:'session-a',attempt,code:'existing-code'});
  assertCustomerConnection(connected,'gmail');assert.equal(h.calls.length,1);assert.equal(h.pending.size,0);
  assert.equal(h.calls[0].body.projectId,PROJECT);assert.equal(h.calls[0].body.value.client_id,'google-client');
  assert.equal(h.calls[0].body.type,'CLOUD_OAUTH2');
  assert.equal(h.calls[0].body.value.code_challenge,'existing-verifier');
});
test('existing OAuth completion rejects company session expiry and altered state before writes',async()=>{
  for(const cloud of [false,true])for(const mismatch of ['company','session','expired','client','altered','unregistered']){
    const h=harness({googleOAuth:originalGoogle,customerOrigin:ORIGIN,gmailOAuthProvider:cloud?'activepieces':'siyadah'});
    const state=seedExistingAttempt(h,{cloud,overrides:mismatch==='expired'?{expiresAt:Date.now()-1}:mismatch==='client'&&!cloud?{clientId:'different-client'}:{}});
    // Cloud payload clientId is bound by its original seal, not an external argument.
    if(mismatch==='client'&&cloud)continue;
    if(mismatch==='unregistered')h.pending.clear();
    const input={tenantId:mismatch==='company'?'company-b':'company-a',sessionBinding:mismatch==='session'?'wrong-session':'session-a',code:'existing-code'};
    const invalidState=mismatch==='altered'?`${state.slice(0,-2)}zz`:state;
    const finish=cloud?()=>h.service.cloudOauthFinish({...input,attempt:invalidState}):()=>h.service.oauthFinish({...input,state:invalidState});
    await assert.rejects(finish,error=>error.code==='invalid_oauth_state'&&error.status===403);
    assert.equal(h.calls.length,0,'failed binding must not save a connection');
  }
});
test('existing OAuth attempts remain single-use under concurrent completion',async()=>{
  for(const cloud of [false,true]){
    const h=harness({googleOAuth:originalGoogle,customerOrigin:ORIGIN,gmailOAuthProvider:cloud?'activepieces':'siyadah'}),state=seedExistingAttempt(h,{cloud});
    const input={tenantId:'company-a',sessionBinding:'session-a',code:'existing-code'};
    const finish=()=>cloud?h.service.cloudOauthFinish({...input,attempt:state}):h.service.oauthFinish({...input,state});
    const results=await Promise.allSettled([finish(),finish()]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.code==='invalid_oauth_state').length,1);
    assert.equal(h.calls.length,1);assert.equal(h.pending.size,0);
  }
});

test('unsupported native auth controls cannot be presented or bypassed as plain text',async()=>{
  const piece={...whatsapp,auth:{type:'CUSTOM_AUTH',props:{account:{type:'DROPDOWN',required:true}}}};
  const {service,calls}=harness({mcp:{call:async()=>({structuredContent:{schemaVersion:1,piece}})}});
  const method=(await service.methods({tenantId:'company-a',piece:'whatsapp'})).methods[0];
  assert.equal(method.available,false);
  await assert.rejects(()=>service.connect({tenantId:'company-a',piece:'whatsapp',type:'CUSTOM_AUTH',values:{account:'invented'}}),{code:'unsupported_auth_fields'});
  assert.equal(calls.length,0);
});

test('supported native auth controls validate values before writing a project connection',async()=>{
  const piece={...whatsapp,auth:{type:'CUSTOM_AUTH',props:{enabled:{type:'CHECKBOX'},count:{type:'NUMBER'},region:{type:'STATIC_DROPDOWN',options:{options:[{label:'Saudi Arabia',value:'SA'}]}},token:{type:'SECRET_TEXT',required:true}}}};
  const {service,calls}=harness({mcp:{call:async()=>({structuredContent:{schemaVersion:1,piece}})}});
  assert.equal((await service.methods({tenantId:'company-a',piece:'whatsapp'})).methods[0].available,true);
  for(const values of [{enabled:'false',token:'t'},{count:'Infinity',token:'t'},{region:'XX',token:'t'},{token:{secret:'t'}}])await assert.rejects(()=>service.connect({tenantId:'company-a',piece:'whatsapp',type:'CUSTOM_AUTH',values}),{code:'invalid_connection_field'});
  assert.equal(calls.length,0);
  await service.connect({tenantId:'company-a',piece:'whatsapp',type:'CUSTOM_AUTH',values:{enabled:false,count:'5',region:'SA',token:'t'}});
  assert.deepEqual(calls[0].body.value.props,{enabled:false,count:5,region:'SA',token:'t'});
});
