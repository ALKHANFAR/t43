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
  const calls=[],metadataCalls=[];
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
    if(options.method==='DELETE'){overrides.beforeDelete?.();return response(204,{});}
    if(url.includes(`/app-connections/${CONNECTION}`))return response(200,{id:CONNECTION,externalId:'company-a-stripe',pieceName:'@activepieces/piece-stripe',scope:'PROJECT',projectIds:projects('get'),flowIds:Object.hasOwn(overrides,'getFlowIds')?overrides.getFlowIds:[]});
    if(url.includes('/api/v1/flows?')){const query=new URL(url).searchParams,cursor=query.get('cursor'),state=query.get('versionState');return response(200,overrides.flowPages?.[state]?.[cursor||'first']??(state==='LOCKED'?overrides.publishedPages?.[cursor||'first']:undefined)??{data:[],next:null});}
    if(url.includes('/app-connections?')){
      const cursor=new URL(url).searchParams.get('cursor');
      return response(200,overrides.connectionPages?.[cursor||'first']??{data:[{id:CONNECTION,pieceName:'@activepieces/piece-stripe',pieceVersion:'0.7.0',displayName:'Stripe',status:'ACTIVE',scope:'PROJECT',projectIds:projects('list'),projectId:overrides.projectIdOnly?PROJECT:undefined,flowIds:[FLOW,'invalid']}],next:null});
    }
    if(url.endsWith('/api/v1/app-connections')){const b=JSON.parse(options.body);return response(201,{id:CONNECTION,pieceName:b.pieceName,pieceVersion:b.pieceVersion,displayName:b.displayName,status:'ACTIVE',scope:'PROJECT',projectIds:projects('create')});}
    throw new Error(`unexpected ${url}`);
  };
  const mcpCall=async(tenantId,method,params)=>{
    if(params.name!=='ap_setup_guide')return overrides.mcpCall?.(tenantId,method,params);
    metadataCalls.push({tenantId,method,params});
    if(Object.hasOwn(overrides,'schemaResult'))return overrides.schemaResult;
    const name=params.arguments.pieceName,meta=name===stripe.name?stripe:name===whatsapp.name?whatsapp:name===slack.name?slack:overrides.gmail||gmail;
    return {structuredContent:{schemaVersion:1,piece:meta}};
  };
  return {calls,pending,metadataCalls,service:createToolConnectionService({requireProject:async tenant=>tenant==='company-a'?PROJECT:OTHER,fetchImpl,activepiecesUrl:'https://ap.example',apiKey:'platform-key',attemptSecret:'s'.repeat(48),attemptStore,googleOAuth:overrides.googleOAuth,customerOrigin:overrides.customerOrigin,gmailOAuthProvider:overrides.gmailOAuthProvider,mcpCall,readFlow:overrides.readFlow,onFlowPaused:overrides.onFlowPaused})};
}

test('connection auth metadata comes only from company MCP for both grant modes',async()=>{
  for(const tenantId of ['company-a','company-b']){
    const h=harness();await h.service.methods({tenantId,piece:'stripe'});
    assert.deepEqual(h.metadataCalls,[{tenantId,method:'tools/call',params:{name:'ap_setup_guide',arguments:{topic:'connection',pieceName:stripe.name}}}]);
    assert.equal(h.calls.some(call=>call.url.includes('/api/v1/pieces')),false);
  }
});
test('missing malformed foreign or failed MCP schema never falls back to REST or noAuth',async()=>{
  for(const schemaResult of [{},{isError:true,structuredContent:{schemaVersion:1,piece:stripe}},{structuredContent:{schemaVersion:2,piece:stripe}},{structuredContent:{schemaVersion:1,piece:{...stripe,name:gmail.name}}},{structuredContent:{schemaVersion:1,piece:{...stripe,auth:[null]}}}]){
    const h=harness({schemaResult});
    await assert.rejects(()=>h.service.methods({tenantId:'company-a',piece:'stripe'}),{code:'native_mcp_discovery_required'});
    assert.equal(h.calls.length,0);
  }
});

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

test('Activepieces Gmail OAuth requests declared scopes, binds the attempt and preserves project isolation',async()=>{
  const {service,calls,pending}=harness({customerOrigin:ORIGIN,gmailOAuthProvider:'activepieces'});
  const method=(await service.methods({tenantId:'company-a',requestOrigin:ORIGIN,piece:'gmail'})).methods[0];
  assert.equal(method.available,true);assert.deepEqual(method.scopes,gmail.auth[0].scope);assert.match(method.description,/Activepieces/);
  const started=await service.oauthStart({tenantId:'company-a',sessionBinding:'session-a',requestOrigin:ORIGIN,piece:'gmail'});
  assert.equal(started.provider,'cloud');assert.equal(started.allowedOrigin,'https://secrets.activepieces.com');assert.equal(pending.size,1);
  const url=new URL(started.authorizationUrl);
  assert.equal(url.hostname,'accounts.google.com');assert.equal(url.searchParams.get('scope'),gmail.auth[0].scope.join(' '));assert.equal(url.searchParams.get('redirect_uri'),'https://secrets.activepieces.com/redirect');assert.equal(url.searchParams.get('access_type'),'offline');
  assert.equal(calls.some(call=>call.url.includes('/oauth2/authorization-url')),false);
  await assert.rejects(()=>service.cloudOauthFinish({tenantId:'company-b',sessionBinding:'session-a',attempt:started.attempt,code:'code'}),error=>error.code==='invalid_oauth_state');
  await assert.rejects(()=>service.cloudOauthFinish({tenantId:'company-a',sessionBinding:'session-b',attempt:started.attempt,code:'code'}),error=>error.code==='invalid_oauth_state');
  const saved=await service.cloudOauthFinish({tenantId:'company-a',sessionBinding:'session-a',attempt:started.attempt,code:'code'});
  assert.equal(saved.scope,'PROJECT');
  const upsert=calls.find(call=>call.url.endsWith('/api/v1/app-connections')).body;
  assert.equal(upsert.projectId,PROJECT);assert.equal(upsert.type,'CLOUD_OAUTH2');assert.equal(upsert.value.scope,gmail.auth[0].scope.join(' '));assert.equal(upsert.value.client_id,'google-client');
  await assert.rejects(()=>service.cloudOauthFinish({tenantId:'company-a',sessionBinding:'session-a',attempt:started.attempt,code:'code'}),error=>error.code==='invalid_oauth_state');
});

test('the same connection path supports another OAuth app and keeps its declared scope',async()=>{
  const {service,calls}=harness({customerOrigin:ORIGIN,gmailOAuthProvider:'activepieces'});
  const method=(await service.methods({tenantId:'company-a',requestOrigin:ORIGIN,piece:'slack'})).methods[0];
  assert.equal(method.available,true);assert.deepEqual(method.scopes,['chat:write']);
  const started=await service.oauthStart({tenantId:'company-a',sessionBinding:'session-a',requestOrigin:ORIGIN,piece:'slack'});
  assert.equal(new URL(started.authorizationUrl).hostname,'slack.com');assert.equal(new URL(started.authorizationUrl).searchParams.get('scope'),'chat:write');
  await service.cloudOauthFinish({tenantId:'company-a',sessionBinding:'session-a',attempt:started.attempt,code:'slack-code'});
  assert.equal(calls.find(call=>call.url.endsWith('/api/v1/app-connections')).body.pieceName,'@activepieces/piece-slack');
});

test('reads live auth schema and keeps secrets out of the response',async()=>{
  const {service}=harness(),methods=await service.methods({tenantId:'company-a',piece:'stripe'});
  assert.equal(Object.hasOwn(methods,'pieceName'),false);
  assert.equal(Object.hasOwn(methods,'pieceVersion'),false);
  assert.equal(methods.methods[0].fields[0].type,'password');
  const connected=await service.connect({tenantId:'company-a',piece:'stripe',type:'SECRET_TEXT',values:{secret_text:'sk_live_secret'}});
  assert.equal(connected.scope,'PROJECT');assert.equal(JSON.stringify(connected).includes('sk_live_secret'),false);
  assertCustomerConnection(connected,'stripe');
  assert.doesNotMatch(JSON.stringify({methods,connected}),/activepieces/i);
});

test('builds custom auth only from authoritative fields',async()=>{
  const {service,calls}=harness();
  await service.connect({tenantId:'company-a',piece:'whatsapp',type:'CUSTOM_AUTH',values:{access_token:'token',businessAccountId:'123',injected:'no'}});
  const request=calls.find(call=>call.url.endsWith('/api/v1/app-connections')).body;
  assert.deepEqual(request.value,{type:'CUSTOM_AUTH',props:{access_token:'token',businessAccountId:'123'}});
  assert.equal(request.projectId,PROJECT);assert.equal(request.scope,undefined);
});

test('customer OAuth is blocked until a Siyadah-owned flow is ready',async()=>{
  const {service,calls}=harness();
  const methods=await service.methods({tenantId:'company-a',piece:'gmail'});
  const oauth=methods.methods.find(method=>method.type==='OAUTH2');
  assert.equal(oauth.available,false);
  assert.match(oauth.message,/سيادة/);
  await assert.rejects(()=>service.oauthStart({tenantId:'company-a',piece:'gmail'}),error=>error.code==='siyadah_oauth_not_ready'&&error.status===409);
  await assert.rejects(()=>service.oauthFinish({tenantId:'company-a',attempt:'old',state:'old',code:'oauth-code'}),error=>error.code==='siyadah_oauth_not_ready'&&error.status===409);
  assert.equal(calls.some(call=>call.url.startsWith('https://cloud.example/apps')),false);
  assert.equal(calls.some(call=>call.url.endsWith('/api/v1/app-connections')&&call.options.method==='POST'),false);
});

test('owned Google Gmail OAuth is session-bound, single-use and project-exclusive',async()=>{
  const googleOAuth={clientId:'siyadah-client',clientSecret:'server-only-secret',redirectUrl:'https://accounts.siyadah-ai.com/siyadah-api/v1/integrations/oauth/callback'};
  const {service,calls,pending}=harness({googleOAuth});
  const method=(await service.methods({tenantId:'company-a',requestOrigin:ORIGIN,piece:'gmail'})).methods[0];assert.equal(method.available,true);assert.deepEqual(method.scopes,[SEND_SCOPE]);
  const started=await service.oauthStart({tenantId:'company-a',sessionBinding:'session-a',requestOrigin:ORIGIN,piece:'gmail'}),url=new URL(started.authorizationUrl),state=url.searchParams.get('state');
  assert.equal(url.searchParams.get('redirect_uri'),googleOAuth.redirectUrl);assert.equal(url.searchParams.get('client_id'),'siyadah-client');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('scope'),SEND_SCOPE);assert.equal(url.searchParams.get('prompt'),'consent');assert.doesNotMatch(started.authorizationUrl,/readonly|modify|compose|email/);
  assert.equal(started.allowedOrigin,'https://accounts.siyadah-ai.com');assert.equal(pending.size,1);assert.doesNotMatch(JSON.stringify(started),/server-only-secret|activepieces/i);
  await assert.rejects(()=>service.oauthFinish({tenantId:'company-b',sessionBinding:'session-a',state,code:'code'}),error=>error.code==='invalid_oauth_state');
  await assert.rejects(()=>service.oauthFinish({tenantId:'company-a',sessionBinding:'session-b',state,code:'code'}),error=>error.code==='invalid_oauth_state');
  assert.equal(pending.size,1);
  const saved=await service.oauthFinish({tenantId:'company-a',sessionBinding:'session-a',state,code:'code'});assert.equal(saved.scope,'PROJECT');
  const request=calls.find(call=>call.url.endsWith('/api/v1/app-connections')).body;assert.equal(request.projectId,PROJECT);assert.equal(request.type,'OAUTH2');assert.equal(request.value.client_secret,'server-only-secret');assert.equal(request.value.scope,SEND_SCOPE);
  await assert.rejects(()=>service.oauthFinish({tenantId:'company-a',sessionBinding:'session-a',state,code:'code2'}),error=>error.code==='invalid_oauth_state');
  assert.equal(calls.filter(call=>call.url.endsWith('/api/v1/app-connections')).length,1);
  assert.equal(calls.some(call=>call.url.startsWith('https://cloud.example/apps')),false);
});

test('owned OAuth rejects altered state, unsupported providers and shared connection results',async()=>{
  const googleOAuth={clientId:'siyadah-client',clientSecret:'server-only-secret',redirectUrl:'https://accounts.siyadah-ai.com/siyadah-api/v1/integrations/oauth/callback'};
  const {service,pending}=harness({googleOAuth,create:[PROJECT,OTHER]});
  assert.equal((await service.methods({tenantId:'company-a',piece:'slack'})).methods[0].available,false);
  await assert.rejects(()=>service.oauthStart({tenantId:'company-a',sessionBinding:'session-a',requestOrigin:ORIGIN,piece:'slack'}),error=>error.code==='siyadah_oauth_not_ready');
  const started=await service.oauthStart({tenantId:'company-a',sessionBinding:'session-a',requestOrigin:ORIGIN,piece:'gmail'}),state=new URL(started.authorizationUrl).searchParams.get('state');
  await assert.rejects(()=>service.oauthFinish({tenantId:'company-a',sessionBinding:'session-a',state:state+'x',code:'code'}),error=>error.code==='invalid_oauth_state');
  assert.equal(pending.size,1);
  await assert.rejects(()=>service.oauthFinish({tenantId:'company-a',sessionBinding:'session-a',state,code:'code'}),error=>error.code==='connection_project_mismatch');
  assert.equal(pending.size,0);
});

test('Google linking stays unavailable when the page origin differs from the callback origin',async()=>{
  const googleOAuth={clientId:'siyadah-client',clientSecret:'server-only-secret',redirectUrl:`${ORIGIN}/siyadah-api/v1/integrations/oauth/callback`};
  const {service,pending}=harness({googleOAuth});
  const methods=await service.methods({tenantId:'company-a',piece:'gmail',requestOrigin:'https://preview.siyadah-ai.com'});
  assert.equal(methods.methods[0].available,false);
  assert.match(methods.methods[0].message,/نطاق/);
  await assert.rejects(()=>service.oauthStart({tenantId:'company-a',sessionBinding:'session-a',requestOrigin:'https://preview.siyadah-ai.com',piece:'gmail'}),error=>error.code==='oauth_origin_mismatch');
  assert.equal(pending.size,0);
});

test('a shared provider result after create or revalidation is rejected',async()=>{
  const created=harness({create:[PROJECT,OTHER]});
  await assert.rejects(()=>created.service.connect({tenantId:'company-a',piece:'stripe',type:'SECRET_TEXT',values:{secret_text:'test'}}),error=>error.code==='connection_project_mismatch');
  const revalidated=harness({revalidate:[PROJECT,OTHER]});
  await assert.rejects(()=>revalidated.service.revalidate({tenantId:'company-a',id:CONNECTION}),error=>error.code==='connection_project_mismatch');
});

test('client-credentials-only OAuth is unavailable and rejected before an attempt',async()=>{
  const configured=harness({customerOrigin:ORIGIN,gmailOAuthProvider:'activepieces',gmail:{...gmail,auth:{...gmail.auth[0],grantType:'client_credentials'}}});
  const result=await configured.service.methods({tenantId:'company-a',piece:'gmail',requestOrigin:ORIGIN});
  assert.equal(result.methods[0].grantType,'client_credentials');assert.equal(result.methods[0].available,false);
  await assert.rejects(()=>configured.service.oauthStart({tenantId:'company-a',sessionBinding:'session-a',requestOrigin:ORIGIN,piece:'gmail'}),error=>error.code==='unsupported_oauth_grant');
});

test('dual-grant OAuth keeps the supported authorization-code route explicit',async()=>{
  const configured=harness({customerOrigin:ORIGIN,gmailOAuthProvider:'activepieces',gmail:{...gmail,auth:{...gmail.auth[0],grantType:'both_client_credentials_and_authorization_code'}}});
  const result=await configured.service.methods({tenantId:'company-a',piece:'gmail',requestOrigin:ORIGIN});
  assert.equal(result.methods[0].grantType,'both_client_credentials_and_authorization_code');assert.equal(result.methods[0].available,true);
  const started=await configured.service.oauthStart({tenantId:'company-a',sessionBinding:'session-a',requestOrigin:ORIGIN,piece:'gmail'});
  assert.equal(new URL(started.authorizationUrl).searchParams.get('response_type'),'code');
});

test('exact auth method and structured multi-select come from metadata; markdown is never submitted',async()=>{
  const configured=harness({gmail:{...gmail,auth:[{type:'CUSTOM_AUTH',props:{first:{required:true,type:'SHORT_TEXT'}}},{type:'CUSTOM_AUTH',props:{algorithms:{required:true,type:'STATIC_MULTI_SELECT_DROPDOWN',options:{options:[{label:'A',value:'a'},{label:'B',value:'b'}]}},info:{required:true,type:'MARKDOWN',description:'Instructions'}}}]}});
  const result=await configured.service.methods({tenantId:'company-a',piece:'gmail'});
  assert.equal(result.methods[1].fields[0].type,'multiselect');assert.equal(result.methods[1].fields[1].type,'markdown');
  await assert.rejects(()=>configured.service.connect({tenantId:'company-a',piece:'gmail',type:'CUSTOM_AUTH',values:{algorithms:['a']}}),error=>error.code==='auth_method_required');
  await assert.rejects(()=>configured.service.connect({tenantId:'company-a',piece:'gmail',type:'CUSTOM_AUTH',methodId:'CUSTOM_AUTH:1',values:{algorithms:['unknown']}}),error=>error.code==='invalid_connection_field');
  await configured.service.connect({tenantId:'company-a',piece:'gmail',type:'CUSTOM_AUTH',methodId:'CUSTOM_AUTH:1',values:{algorithms:['a','b'],info:'injected'}});
  const request=configured.calls.find(call=>call.url.endsWith('/api/v1/app-connections')).body;
  assert.deepEqual(request.value.props,{algorithms:['a','b']});
});

test('changed auth metadata is rejected before connection write instead of silently changing methods',async()=>{
  const meta={...gmail,auth:[{type:'CUSTOM_AUTH',props:{first:{type:'SHORT_TEXT'}}},{type:'CUSTOM_AUTH',props:{second:{type:'SHORT_TEXT'}}}]},configured=harness({gmail:meta});
  const chosen=(await configured.service.methods({tenantId:'company-a',piece:'gmail'})).methods[1];
  meta.auth.reverse();
  await assert.rejects(()=>configured.service.connect({tenantId:'company-a',piece:'gmail',type:chosen.type,methodId:chosen.id,methodFingerprint:chosen.fingerprint,values:{second:'value'}}),error=>error.code==='stale_auth_method');
  assert.equal(configured.calls.some(call=>call.url.endsWith('/api/v1/app-connections')),false);
});

function disconnectHarness({failAt,foreign=false,readback='DISABLED',syncFailure=false,lateDependency=false,secondEnabled=false}={}){
  const events=[],states=new Map([[FLOW,'ENABLED'],['G'.repeat(21),secondEnabled?'ENABLED':'DISABLED']]);
  const published={id:FLOW,projectId:PROJECT,publishedVersionId:'V'.repeat(21),version:{id:'V'.repeat(21),state:'LOCKED',connectionIds:['company-a-stripe']}};
  let reads=0;const h=harness({beforeDelete:()=>events.push(['delete']),getFlowIds:['G'.repeat(21)],publishedPages:{first:{data:[published],next:null}},
    readFlow:async(tenant,id)=>{events.push(['read',tenant,id]);reads++;if(lateDependency&&reads>5)states.set(FLOW,'ENABLED');return {id,projectId:foreign?OTHER:PROJECT,status:states.get(id)};},
    mcpCall:async(tenant,method,params)=>{events.push(['mcp',tenant,method,params]);if(failAt===params.arguments.flowId)return {isError:true};states.set(params.arguments.flowId,readback);return {content:[{type:'text',text:'changed'}]};},
    onFlowPaused:async(tenant,id)=>{events.push(['sync',tenant,id]);if(syncFailure)throw new Error('storage failed');}
  });return {...h,events};
}
test('confirmed disconnect pauses dependencies through company MCP and verifies them before deletion',async()=>{
  const h=disconnectHarness();
  const result=await h.service.disconnect({tenantId:'company-a',id:CONNECTION,confirmInUse:true});
  assert.equal(result.disconnected,true);
  assert.deepEqual(result.pausedFlowIds,[FLOW]);
  assert.deepEqual(h.events.filter(e=>e[0]==='mcp'),[['mcp','company-a','tools/call',{name:'ap_change_flow_status',arguments:{flowId:FLOW,status:'DISABLED'}}]]);
  assert.equal(h.events.filter(e=>e[0]==='sync').length,2);
  assert.equal(h.calls.filter(c=>c.options.method==='DELETE').length,1);
  assert.equal(h.events.at(-1)[0],'delete');
  assert.equal(h.calls.some(c=>c.options.method==='POST'&&c.url.includes('/flows')),false);
});
test('confirmed disconnect preserves connection on foreign flow, MCP failure, unverified pause or failed state sync',async()=>{
  for(const options of [{foreign:true},{failAt:FLOW},{readback:'ENABLED'},{syncFailure:true},{lateDependency:true},{secondEnabled:true,failAt:FLOW}]){
    const h=disconnectHarness(options);
    await assert.rejects(()=>h.service.disconnect({tenantId:'company-a',id:CONNECTION,confirmInUse:true}));
    assert.equal(h.calls.some(c=>c.options.method==='DELETE'),false);
    if(options.foreign)assert.equal(h.events.some(e=>e[0]==='mcp'),false);
  }
});

test('confirmed disconnect still rejects incomplete inventory and missing MCP dependencies before effects',async()=>{
  for(const config of [{publishedPages:{first:{data:[]}}},{getFlowIds:[FLOW]}]){
    const h=harness(config);
    await assert.rejects(()=>h.service.disconnect({tenantId:'company-a',id:CONNECTION,confirmInUse:true}),{code:'connection_usage_unknown'});
    assert.equal(h.calls.some(c=>c.options.method==='DELETE'),false);
  }
});
