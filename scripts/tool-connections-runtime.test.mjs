import test from 'node:test';
import assert from 'node:assert/strict';
import {createToolConnectionService} from '../lib/tool-connections.mjs';

const PROJECT='P'.repeat(21),OTHER='Q'.repeat(21),CONNECTION='C'.repeat(21),FLOW='F'.repeat(21);
const stripe={name:'@activepieces/piece-stripe',displayName:'Stripe',version:'0.7.0',auth:{type:'SECRET_TEXT',displayName:'Secret API Key',required:true}};
const whatsapp={name:'@activepieces/piece-whatsapp',displayName:'WhatsApp',version:'1.0.0',auth:{type:'CUSTOM_AUTH',required:true,props:{access_token:{displayName:'Access token',required:true,type:'SECRET_TEXT'},businessAccountId:{displayName:'Business ID',required:true,type:'SHORT_TEXT'}}}};
const gmail={name:'@activepieces/piece-gmail',displayName:'Gmail',version:'0.17.0',auth:[{type:'OAUTH2',displayName:'Google',authUrl:'https://accounts.google.com/o/oauth2/auth',scope:['gmail.send','email'],props:{private_hint:{displayName:'Private hint',required:false,type:'SECRET_TEXT'}}},{type:'CUSTOM_AUTH',displayName:'Service account',props:{json:{displayName:'JSON',required:true,type:'LONG_TEXT'}}}]};

function response(status,body){return {ok:status>=200&&status<300,status,json:async()=>body};}
function harness(overrides={}){
  const calls=[];
  const projects=stage=>Object.hasOwn(overrides,stage)?overrides[stage]:(overrides.foreign&&stage==='list'?[OTHER]:[PROJECT]);
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options,body:options.body?JSON.parse(options.body):null});
    if(url.startsWith('https://cloud.example/apps'))return response(200,{'@activepieces/piece-gmail':{clientId:'google-client'}});
    if(url.includes('/api/v1/pieces')){
      const name=new URL(url).searchParams.get('searchQuery');return response(200,[name==='stripe'?stripe:name==='whatsapp'?whatsapp:overrides.gmail||gmail]);
    }
    if(url.includes('/oauth2/authorization-url'))return response(200,{authorizationUrl:'https://accounts.google.com/o/oauth2/auth?client_id=google-client'});
    if(url.includes('/revalidate'))return response(200,{id:CONNECTION,pieceName:'@activepieces/piece-stripe',pieceVersion:'0.7.0',displayName:'Stripe',status:'ACTIVE',scope:'PROJECT',projectIds:projects('revalidate')});
    if(options.method==='DELETE')return response(204,{});
    if(url.includes(`/app-connections/${CONNECTION}`))return response(200,{id:CONNECTION,pieceName:'@activepieces/piece-stripe',scope:'PROJECT',projectIds:projects('get')});
    if(url.includes('/app-connections?'))return response(200,{data:[{id:CONNECTION,pieceName:'@activepieces/piece-stripe',pieceVersion:'0.7.0',displayName:'Stripe',status:'ACTIVE',scope:'PROJECT',projectIds:projects('list'),projectId:overrides.projectIdOnly?PROJECT:undefined,flowIds:[FLOW,'invalid']}]});
    if(url.endsWith('/api/v1/app-connections')){const b=JSON.parse(options.body);return response(201,{id:CONNECTION,pieceName:b.pieceName,pieceVersion:b.pieceVersion,displayName:b.displayName,status:'ACTIVE',scope:'PROJECT',projectIds:projects('create')});}
    throw new Error(`unexpected ${url}`);
  };
  return {calls,service:createToolConnectionService({requireProject:async tenant=>tenant==='company-a'?PROJECT:OTHER,fetchImpl,activepiecesUrl:'https://ap.example',apiKey:'platform-key',attemptSecret:'s'.repeat(48),cloudAppsUrl:'https://cloud.example/apps'})};
}

test('reads live auth schema and keeps secrets out of the response',async()=>{
  const {service}=harness(),methods=await service.methods({tenantId:'company-a',piece:'stripe'});
  assert.equal(methods.methods[0].fields[0].type,'password');
  const connected=await service.connect({tenantId:'company-a',piece:'stripe',type:'SECRET_TEXT',values:{secret_text:'sk_live_secret'}});
  assert.equal(connected.scope,'PROJECT');assert.equal(JSON.stringify(connected).includes('sk_live_secret'),false);
});

test('shows only valid flow references from a project-owned connection',async()=>{
  const {service}=harness();
  const connection=(await service.list('company-a'))[0];
  assert.equal(connection.scope,'PROJECT');
  assert.deepEqual(connection.flowIds,[FLOW]);
});

test('builds custom auth only from authoritative fields',async()=>{
  const {service,calls}=harness();
  await service.connect({tenantId:'company-a',piece:'whatsapp',type:'CUSTOM_AUTH',values:{access_token:'token',businessAccountId:'123',injected:'no'}});
  const request=calls.find(call=>call.url.endsWith('/api/v1/app-connections')).body;
  assert.deepEqual(request.value,{type:'CUSTOM_AUTH',props:{access_token:'token',businessAccountId:'123'}});
  assert.equal(request.projectId,PROJECT);assert.equal(request.scope,undefined);
});

test('starts and finishes cloud OAuth inside the tenant project',async()=>{
  const {service,calls}=harness(),started=await service.oauthStart({tenantId:'company-a',piece:'gmail'});
  assert.equal(started.allowedOrigin,'https://secrets.activepieces.com');assert.match(started.authorizationUrl,/accounts\.google\.com/);
  assert.equal(new URL(started.authorizationUrl).searchParams.get('state'),started.attempt);assert.equal(new URL(started.authorizationUrl).searchParams.get('code_challenge_method'),'S256');
  const finished=await service.oauthFinish({tenantId:'company-a',attempt:started.attempt,state:started.attempt,code:'oauth-code'});
  assert.equal(finished.status,'ACTIVE');
  const request=calls.filter(call=>call.url.endsWith('/api/v1/app-connections')).at(-1).body;
  assert.equal(request.projectId,PROJECT);assert.equal(request.type,'CLOUD_OAUTH2');assert.equal(request.value.client_id,'google-client');
});

test('OAuth state hides customer auth props and PKCE verifier while retaining project scope',async()=>{
  const {service,calls}=harness(),value='customer-private-hint-unique';
  const started=await service.oauthStart({tenantId:'company-a',piece:'gmail',values:{private_hint:value}});
  const url=new URL(started.authorizationUrl),state=url.searchParams.get('state');
  assert.equal(state,started.attempt);assert.match(state,/^v1\./);
  assert.equal(started.authorizationUrl.includes(value),false);
  assert.equal(started.authorizationUrl.includes(Buffer.from(value).toString('base64url')),false);
  const publicChallenge=url.searchParams.get('code_challenge');
  assert.equal(state.includes(publicChallenge),false);
  await service.oauthFinish({tenantId:'company-a',attempt:state,state,code:'oauth-code'});
  const request=calls.filter(call=>call.url.endsWith('/api/v1/app-connections')).at(-1).body;
  assert.equal(request.projectId,PROJECT);
  assert.equal(request.value.props.private_hint,value);
  assert.notEqual(request.value.code_challenge,publicChallenge);
});

test('OAuth state rejects another company, tampering, old format and expiry before provider write',async()=>{
  const {service,calls}=harness(),started=await service.oauthStart({tenantId:'company-a',piece:'gmail'});
  const finish=attempt=>service.oauthFinish({tenantId:'company-a',attempt,state:attempt,code:'oauth-code'});
  await assert.rejects(()=>service.oauthFinish({tenantId:'company-b',attempt:started.attempt,state:started.attempt,code:'oauth-code'}),error=>error.code==='invalid_oauth_attempt'&&!JSON.stringify(error).includes('company-a'));
  const altered=`${started.attempt.slice(0,-1)}${started.attempt.at(-1)==='A'?'B':'A'}`;
  await assert.rejects(()=>finish(altered),error=>error.code==='invalid_oauth_attempt'&&!JSON.stringify(error).includes('oauth-code'));
  await assert.rejects(()=>finish(Buffer.from(JSON.stringify({tenantId:'company-a'})).toString('base64url')+'.mac'),error=>error.code==='invalid_oauth_attempt');
  const originalNow=Date.now;Date.now=()=>originalNow()+11*60_000;
  try{await assert.rejects(()=>finish(started.attempt),error=>error.code==='expired_oauth_attempt');}
  finally{Date.now=originalNow;}
  assert.equal(calls.filter(call=>call.url.endsWith('/api/v1/app-connections')).length,0);
});

test('OAuth refuses an auth definition that places a secret field in a public URL',async()=>{
  const unsafe=structuredClone(gmail);unsafe.auth[0].authUrl+='?hint={private_hint}';
  const {service,calls}=harness({gmail:unsafe});
  await assert.rejects(()=>service.oauthStart({tenantId:'company-a',piece:'gmail',values:{private_hint:'not-for-url'}}),error=>error.code==='oauth_secret_in_url'&&!error.message.includes('not-for-url'));
  assert.equal(calls.filter(call=>call.url.endsWith('/api/v1/app-connections')).length,0);
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

test('a shared provider result after create or revalidation is rejected',async()=>{
  const created=harness({create:[PROJECT,OTHER]});
  await assert.rejects(()=>created.service.connect({tenantId:'company-a',piece:'stripe',type:'SECRET_TEXT',values:{secret_text:'test'}}),error=>error.code==='connection_project_mismatch');
  const oauth=harness({create:[PROJECT,OTHER]});
  const started=await oauth.service.oauthStart({tenantId:'company-a',piece:'gmail'});
  await assert.rejects(()=>oauth.service.oauthFinish({tenantId:'company-a',attempt:started.attempt,state:started.attempt,code:'oauth-code'}),error=>error.code==='connection_project_mismatch');
  const revalidated=harness({revalidate:[PROJECT,OTHER]});
  await assert.rejects(()=>revalidated.service.revalidate({tenantId:'company-a',id:CONNECTION}),error=>error.code==='connection_project_mismatch');
});

test('revalidates and disconnects only after ownership readback',async()=>{
  const {service,calls}=harness();
  assert.equal((await service.revalidate({tenantId:'company-a',id:CONNECTION})).status,'ACTIVE');
  assert.equal((await service.disconnect({tenantId:'company-a',id:CONNECTION})).disconnected,true);
  assert.equal(calls.filter(call=>call.options.method==='DELETE').length,1);
});
