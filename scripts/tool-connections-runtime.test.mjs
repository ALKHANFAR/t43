import test from 'node:test';
import assert from 'node:assert/strict';
import {createToolConnectionService} from '../lib/tool-connections.mjs';

const PROJECT='P'.repeat(21),OTHER='Q'.repeat(21),CONNECTION='C'.repeat(21),FLOW='F'.repeat(21);
const stripe={name:'@activepieces/piece-stripe',displayName:'Stripe',version:'0.7.0',auth:{type:'SECRET_TEXT',displayName:'Secret API Key',required:true}};
const whatsapp={name:'@activepieces/piece-whatsapp',displayName:'WhatsApp',version:'1.0.0',auth:{type:'CUSTOM_AUTH',required:true,props:{access_token:{displayName:'Access token',required:true,type:'SECRET_TEXT'},businessAccountId:{displayName:'Business ID',required:true,type:'SHORT_TEXT'}}}};
const gmail={name:'@activepieces/piece-gmail',displayName:'Gmail',version:'0.17.0',auth:[{type:'OAUTH2',displayName:'Google',authUrl:'https://accounts.google.com/o/oauth2/auth',scope:['gmail.send','email'],props:{}},{type:'CUSTOM_AUTH',displayName:'Service account',props:{json:{displayName:'JSON',required:true,type:'LONG_TEXT'}}}]};
const slack={name:'@activepieces/piece-slack',displayName:'Slack',version:'0.1.0',auth:{type:'OAUTH2',displayName:'Slack',authUrl:'https://slack.com/oauth/v2/authorize',scope:['chat:write'],props:{}}};

function response(status,body){return {ok:status>=200&&status<300,status,json:async()=>body};}
function harness(overrides={}){
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options,body:options.body?JSON.parse(options.body):null});
    if(url.startsWith('https://cloud.example/apps'))return response(200,overrides.noCloudApps?{}:{'@activepieces/piece-gmail':{clientId:'google-client'},'@activepieces/piece-slack':{clientId:'slack-client'}});
    if(url.includes('/api/v1/pieces')){
      const name=new URL(url).searchParams.get('searchQuery');return response(200,[name==='stripe'?stripe:name==='whatsapp'?whatsapp:name==='slack'?slack:gmail]);
    }
    if(url.includes('/oauth2/authorization-url'))return response(200,{authorizationUrl:'https://accounts.google.com/o/oauth2/auth?client_id=google-client'});
    if(url.includes('/revalidate'))return response(200,{id:CONNECTION,pieceName:'@activepieces/piece-stripe',pieceVersion:'0.7.0',displayName:'Stripe',status:'ACTIVE',scope:'PROJECT',projectIds:[PROJECT]});
    if(options.method==='DELETE')return response(204,{});
    if(url.includes(`/app-connections/${CONNECTION}`))return response(200,{id:CONNECTION,pieceName:'@activepieces/piece-stripe',scope:'PROJECT',projectIds:[PROJECT]});
    if(url.includes('/app-connections?'))return response(200,{data:overrides.foreign?[{id:CONNECTION,pieceName:'@activepieces/piece-stripe',scope:'PROJECT',projectIds:[OTHER]}]:[{id:CONNECTION,pieceName:'@activepieces/piece-stripe',pieceVersion:'0.7.0',displayName:'Stripe',status:'ACTIVE',scope:'PROJECT',projectIds:[PROJECT],flowIds:[FLOW,'invalid']}]});
    if(url.endsWith('/api/v1/app-connections')){const b=JSON.parse(options.body);return response(201,{id:CONNECTION,pieceName:b.pieceName,pieceVersion:b.pieceVersion,displayName:b.displayName,status:'ACTIVE',scope:'PROJECT',projectIds:[PROJECT]});}
    throw new Error(`unexpected ${url}`);
  };
  return {calls,service:createToolConnectionService({requireProject:async tenant=>tenant==='company-a'?PROJECT:OTHER,fetchImpl,activepiecesUrl:'https://ap.example',apiKey:'platform-key',attemptSecret:'s'.repeat(48),cloudAppsUrl:'https://cloud.example/apps',googleOAuth:overrides.googleOAuth})};
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
  assert.equal(started.pkceStateOptional,true);assert.equal(started.attempt.split('.')[0],'v2');assert.doesNotMatch(started.attempt,/company-a|google-client/);
  const finished=await service.oauthFinish({tenantId:'company-a',attempt:started.attempt,state:'',code:'oauth-code'});
  assert.equal(finished.status,'ACTIVE');
  const request=calls.filter(call=>call.url.endsWith('/api/v1/app-connections')).at(-1).body;
  assert.equal(request.projectId,PROJECT);assert.equal(request.type,'CLOUD_OAUTH2');assert.equal(request.value.client_id,'google-client');assert.equal(request.value.scope,'gmail.send email');assert.equal(request.value.authorization_method,'BODY');
});

test('Siyadah-owned Google OAuth stays server-side and saves only to its company project',async()=>{
  const googleOAuth={clientId:'siyadah-google-client',clientSecret:'server-only-secret',redirectUrl:'https://accounts.siyadah-ai.com/siyadah-api/v1/integrations/oauth/callback'};
  const {service,calls}=harness({googleOAuth,noCloudApps:true});
  assert.equal((await service.methods({tenantId:'company-a',piece:'gmail'})).methods[0].available,true);
  const started=await service.oauthStart({tenantId:'company-a',piece:'gmail'});
  const url=new URL(started.authorizationUrl);
  assert.equal(url.searchParams.get('client_id'),googleOAuth.clientId);
  assert.equal(url.searchParams.get('redirect_uri'),googleOAuth.redirectUrl);
  assert.equal(url.searchParams.get('state'),started.attempt);
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('access_type'),'offline');
  assert.equal(started.allowedOrigin,'https://accounts.siyadah-ai.com');
  assert.equal(started.pkceStateOptional,false);
  assert.doesNotMatch(JSON.stringify(started),/server-only-secret/);
  await assert.rejects(()=>service.oauthFinish({tenantId:'company-b',attempt:started.attempt,state:started.attempt,code:'oauth-code'}),error=>error.code==='expired_oauth_attempt');
  await assert.rejects(()=>service.oauthFinish({tenantId:'company-a',attempt:started.attempt,state:'wrong',code:'oauth-code'}),error=>error.code==='invalid_oauth_state');
  const saved=await service.oauthFinish({tenantId:'company-a',attempt:started.attempt,state:started.attempt,code:'oauth-code'});
  assert.equal(saved.scope,'PROJECT');
  const request=calls.find(call=>call.url.endsWith('/api/v1/app-connections')).body;
  assert.equal(request.projectId,PROJECT);
  assert.equal(request.type,'OAUTH2');
  assert.equal(request.value.client_secret,googleOAuth.clientSecret);
  assert.equal(request.value.redirect_url,googleOAuth.redirectUrl);
  assert.equal(request.value.grant_type,'authorization_code');
});

test('rejects tampered attempts and non-Google OAuth without returned state',async()=>{
  const {service}=harness(),google=await service.oauthStart({tenantId:'company-a',piece:'gmail'});
  await assert.rejects(()=>service.oauthFinish({tenantId:'company-a',attempt:google.attempt,state:'wrong',code:'oauth-code'}),error=>error.code==='invalid_oauth_state');
  await assert.rejects(()=>service.oauthFinish({tenantId:'company-b',attempt:google.attempt,state:'',code:'oauth-code'}),error=>error.code==='expired_oauth_attempt');
  const parts=google.attempt.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
  await assert.rejects(()=>service.oauthFinish({tenantId:'company-a',attempt:parts.join('.'),state:'',code:'oauth-code'}),error=>error.code==='invalid_oauth_attempt');
  const other=await service.oauthStart({tenantId:'company-a',piece:'slack'});
  assert.equal(other.pkceStateOptional,false);
  await assert.rejects(()=>service.oauthFinish({tenantId:'company-a',attempt:other.attempt,state:'',code:'oauth-code'}),error=>error.code==='invalid_oauth_state');
});

test('rejects cross-company connection readback',async()=>{
  const {service}=harness({foreign:true});
  await assert.rejects(()=>service.list('company-a'),error=>error.code==='connection_project_mismatch'&&error.status===403);
});

test('revalidates and disconnects only after ownership readback',async()=>{
  const {service,calls}=harness();
  assert.equal((await service.revalidate({tenantId:'company-a',id:CONNECTION})).status,'ACTIVE');
  assert.equal((await service.disconnect({tenantId:'company-a',id:CONNECTION})).disconnected,true);
  assert.equal(calls.filter(call=>call.options.method==='DELETE').length,1);
});
