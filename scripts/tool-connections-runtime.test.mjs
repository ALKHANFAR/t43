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
  const revalidated=harness({revalidate:[PROJECT,OTHER]});
  await assert.rejects(()=>revalidated.service.revalidate({tenantId:'company-a',id:CONNECTION}),error=>error.code==='connection_project_mismatch');
});

test('revalidates and disconnects only after ownership readback',async()=>{
  const {service,calls}=harness();
  assert.equal((await service.revalidate({tenantId:'company-a',id:CONNECTION})).status,'ACTIVE');
  assert.equal((await service.disconnect({tenantId:'company-a',id:CONNECTION})).disconnected,true);
  assert.equal(calls.filter(call=>call.options.method==='DELETE').length,1);
});
