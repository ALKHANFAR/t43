import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {TenantProjectError} from './tenant-projects.mjs';

const PIECE=/^@activepieces\/piece-[a-z0-9-]+$/;
const AP_ID=/^[0-9A-Za-z]{21}$/;
const TYPES=new Set(['SECRET_TEXT','BASIC_AUTH','CUSTOM_AUTH','OAUTH2','OIDC']);
const GOOGLE_PIECES=new Set(['@activepieces/piece-gmail']);
const GMAIL_SEND_SCOPE='https://www.googleapis.com/auth/gmail.send';

function fail(code,message,status=400){throw new TenantProjectError(code,message,status);}
function safeText(value,max=240){return String(value??'').trim().slice(0,max);}
function publicPiece(value){const name=String(value||'');return PIECE.test(name)?name.slice('@activepieces/piece-'.length):'';}
function pieceName(slug){const value=String(slug||'').startsWith('@activepieces/piece-')?String(slug):`@activepieces/piece-${slug}`;if(!PIECE.test(value)||value==='@activepieces/piece-activepieces')fail('invalid_piece','الأداة غير صالحة.');return value;}
function propsOf(auth){return auth?.props&&typeof auth.props==='object'&&!Array.isArray(auth.props)?auth.props:{};}
function fieldsOf(auth){
  if(auth.type==='SECRET_TEXT')return [{name:'secret_text',label:auth.displayName||'المفتاح السري',description:auth.description||'',required:auth.required!==false,type:'password'}];
  if(auth.type==='BASIC_AUTH')return [{name:'username',label:'اسم المستخدم',required:true,type:'text'},{name:'password',label:'كلمة المرور',required:true,type:'password'}];
  return Object.entries(propsOf(auth)).map(([name,field])=>({name,label:field.displayName||name,description:field.description||'',required:field.required===true,type:field.type==='SECRET_TEXT'?'password':field.type==='LONG_TEXT'?'textarea':field.type==='CHECKBOX'?'checkbox':field.type==='NUMBER'?'number':field.type==='STATIC_DROPDOWN'?'dropdown':'text',defaultValue:field.defaultValue,options:Array.isArray(field.options?.options)?field.options.options.map(option=>({label:String(option.label),value:option.value})):[]}));
}
function publicConnection(connection,projectId){
  const projects=connection?.projectIds;
  if(connection?.scope!=='PROJECT'||!Array.isArray(projects)||projects.length!==1||projects[0]!==projectId)fail('connection_project_mismatch','رفضت سيادة اتصالًا لا يخص هذه الشركة وحدها.',403);
  const slug=publicPiece(connection.pieceName);
  if(!slug)fail('invalid_provider_connection','تعذّر تأكيد بيانات اتصال الأداة.',502);
  return {id:connection.id,slug,displayName:connection.displayName,status:connection.status,scope:'PROJECT',flowIds:(Array.isArray(connection.flowIds)?connection.flowIds:[]).filter(id=>AP_ID.test(id)),created:connection.created,updated:connection.updated};
}

export function createToolConnectionService({requireProject,fetchImpl=fetch,activepiecesUrl,apiKey,attemptSecret,attemptStore,googleOAuth}){
  if(typeof requireProject!=='function')throw new TypeError('requireProject is required');
  const base=String(activepiecesUrl||'').replace(/\/$/,'');
  const ownGoogle=Boolean(googleOAuth?.clientId&&googleOAuth?.clientSecret&&googleOAuth?.redirectUrl&&String(attemptSecret||'').length>=32&&attemptStore?.save&&attemptStore?.consume&&(()=>{try{const url=new URL(googleOAuth.redirectUrl);return url.protocol==='https:'&&url.hostname.endsWith('.siyadah-ai.com')&&url.pathname==='/siyadah-api/v1/integrations/oauth/callback';}catch{return false;}})());
  const callbackOrigin=ownGoogle?new URL(googleOAuth.redirectUrl).origin:'';
  const provider=async(path,options={})=>{
    if(!base||!apiKey)fail('provider_not_configured','ربط الأدوات غير مهيأ.',503);
    const response=await fetchImpl(base+path,{...options,headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json',...(options.headers||{})}});
    if(response.status===204)return null;
    const result=await response.json().catch(()=>({}));
    if(!response.ok)fail('connection_provider_error','تعذّر تنفيذ الربط. حاول مجددًا أو تواصل مع الدعم.',response.status===401?502:Math.min(response.status||502,599));
    return result;
  };
  async function metadata(piece){
    const name=pieceName(piece),result=await provider(`/api/v1/pieces?searchQuery=${encodeURIComponent(name.replace('@activepieces/piece-',''))}&includeHidden=true&limit=20`);
    const rows=Array.isArray(result)?result:Array.isArray(result?.data)?result.data:[],match=rows.find(row=>row?.name===name);
    if(!match)fail('piece_not_found','الأداة غير موجودة في الكتالوج.',404);
    return match;
  }
  async function methods({tenantId,piece,requestOrigin}){
    await requireProject(tenantId);const meta=await metadata(piece),auths=meta.auth==null?[]:(Array.isArray(meta.auth)?meta.auth:[meta.auth]);
    if(!auths.length)return {noAuth:true,methods:[]};
    return {noAuth:false,methods:auths.map((auth,index)=>{
      const type=safeText(auth?.type,40),oauth=type==='OAUTH2',google=ownGoogle&&GOOGLE_PIECES.has(meta.name)&&isGoogleAuth(auth)&&Array.isArray(auth.scope)&&auth.scope.includes(GMAIL_SEND_SCOPE),correctOrigin=requestOrigin===callbackOrigin;
      return {id:`${type}:${index}`,type,displayName:auth.displayName||'طريقة الربط',description:auth.description||'',fields:fieldsOf(auth),available:TYPES.has(type)&&(!oauth||google&&correctOrigin),message:oauth&&google&&!correctOrigin?'افتح سيادة من نطاق الحساب المعتمد لإتمام ربط Google.':oauth&&!google?'تسجيل الدخول لهذه الأداة غير متاح حتى يكتمل ربطه باسم سيادة.':!TYPES.has(type)?'طريقة الربط هذه غير مدعومة بعد.':'',scopes:google?[GMAIL_SEND_SCOPE]:oauth?[]:Array.isArray(auth.scope)?auth.scope:[]};
    })};
  }
  async function list(tenantId){
    const projectId=await requireProject(tenantId),result=await provider(`/api/v1/app-connections?projectId=${encodeURIComponent(projectId)}&scope=PROJECT&limit=1000`),rows=Array.isArray(result?.data)?result.data:[];
    return rows.map(row=>publicConnection(row,projectId));
  }
  async function selected({tenantId,piece,type}){
    const projectId=await requireProject(tenantId),meta=await metadata(piece),auths=meta.auth==null?[]:(Array.isArray(meta.auth)?meta.auth:[meta.auth]),auth=auths.find(item=>item?.type===type);
    if(!auth||!TYPES.has(type))fail('invalid_auth_method','طريقة الربط غير صالحة.');
    return {projectId,meta,auth};
  }
  function authValues(auth,values={}){
    const fields=fieldsOf(auth),allowed={};
    for(const field of fields){let value=values[field.name];if(field.required&&(value===undefined||value===null||value===''))fail('missing_connection_field',`أكمل حقل ${field.label}.`);if(value!==undefined&&value!==null&&value!=='')allowed[field.name]=typeof value==='string'?value.slice(0,20_000):value;}
    if(auth.type==='SECRET_TEXT')return {type:'SECRET_TEXT',secret_text:allowed.secret_text};
    if(auth.type==='BASIC_AUTH')return {type:'BASIC_AUTH',username:allowed.username,password:allowed.password};
    return {type:auth.type,props:allowed};
  }
  async function connect({tenantId,piece,type,values}){
    if(type==='OAUTH2')fail('oauth_start_required','ابدأ تسجيل الدخول أولًا.');
    const {projectId,meta,auth}=await selected({tenantId,piece,type}),slug=meta.name.replace('@activepieces/piece-',''),body={projectId,externalId:`siyadah-${tenantId}-${slug}`.slice(0,128),displayName:meta.displayName||slug,pieceName:meta.name,pieceVersion:meta.version,type,value:authValues(auth,values)};
    return publicConnection(await provider('/api/v1/app-connections',{method:'POST',body:JSON.stringify(body)}),projectId);
  }
  function isGoogleAuth(auth){try{const url=new URL(auth?.authUrl);return auth?.type==='OAUTH2'&&url.protocol==='https:'&&url.hostname==='accounts.google.com';}catch{return false;}}
  function seal(payload){
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',createHash('sha256').update(attemptSecret).digest(),iv);
    const data=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
    return `v1.${iv.toString('base64url')}.${data.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
  }
  function open(state){
    const [version,ivText,dataText,tagText,...rest]=String(state||'').split('.');
    if(version!=='v1'||!ivText||!dataText||!tagText||rest.length||state.length>20000)fail('invalid_oauth_state','محاولة الربط غير صالحة.',403);
    try{
      const iv=Buffer.from(ivText,'base64url'),tag=Buffer.from(tagText,'base64url');
      if(iv.length!==12||tag.length!==16)throw new Error('invalid state');
      const decipher=createDecipheriv('aes-256-gcm',createHash('sha256').update(attemptSecret).digest(),iv);decipher.setAuthTag(tag);
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(dataText,'base64url')),decipher.final()]).toString('utf8'));
    }catch{fail('invalid_oauth_state','محاولة الربط غير صالحة.',403);}
  }
  async function oauthStart({tenantId,sessionBinding,requestOrigin,piece,values={}}){
    if(!ownGoogle||!sessionBinding)fail('siyadah_oauth_not_ready','تسجيل الدخول لهذه الأداة غير متاح حتى يكتمل ربطه باسم سيادة.',409);
    if(requestOrigin!==callbackOrigin)fail('oauth_origin_mismatch','افتح سيادة من نطاق الحساب المعتمد لإتمام ربط Google.',409);
    const {meta,auth}=await selected({tenantId,piece,type:'OAUTH2'});
    if(!GOOGLE_PIECES.has(meta.name)||!isGoogleAuth(auth)||!Array.isArray(auth.scope)||!auth.scope.includes(GMAIL_SEND_SCOPE))fail('siyadah_oauth_not_ready','تسجيل الدخول لهذه الأداة غير متاح حتى يكتمل ربطه باسم سيادة.',409);
    const props=authValues({...auth,type:'CUSTOM_AUTH'},values).props,verifier=randomBytes(32).toString('base64url');
    const scopes=GMAIL_SEND_SCOPE;
    const expiresAt=Date.now()+10*60_000,state=seal({tenantId,pieceName:meta.name,pieceVersion:meta.version,displayName:meta.displayName,clientId:googleOAuth.clientId,props,verifier,scopes,authorizationMethod:auth.authorizationMethod||'BODY',expiresAt});
    await attemptStore.save({state,companyId:tenantId,sessionBinding,expiresAt});
    const url=new URL(auth.authUrl);url.searchParams.set('client_id',googleOAuth.clientId);url.searchParams.set('redirect_uri',googleOAuth.redirectUrl);url.searchParams.set('response_type','code');url.searchParams.set('state',state);url.searchParams.set('scope',scopes);url.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));url.searchParams.set('code_challenge_method','S256');url.searchParams.set('access_type','offline');
    if(auth.prompt!=='omit')url.searchParams.set('prompt',auth.prompt||'consent');
    return {authorizationUrl:url.toString(),allowedOrigin:new URL(googleOAuth.redirectUrl).origin};
  }
  async function oauthFinish({tenantId,sessionBinding,state,code}){
    if(!ownGoogle||!sessionBinding)fail('siyadah_oauth_not_ready','تسجيل الدخول لهذه الأداة غير متاح حتى يكتمل ربطه باسم سيادة.',409);
    const payload=open(state);
    if(payload.tenantId!==tenantId||payload.clientId!==googleOAuth.clientId||Date.now()>payload.expiresAt||!safeText(code,4000))fail('invalid_oauth_state','محاولة الربط غير صالحة.',403);
    if(!await attemptStore.consume({state,companyId:tenantId,sessionBinding}))fail('invalid_oauth_state','محاولة الربط مستعملة أو انتهت.',403);
    const projectId=await requireProject(tenantId),slug=payload.pieceName.replace('@activepieces/piece-',''),body={projectId,externalId:`siyadah-${tenantId}-${slug}`.slice(0,128),displayName:payload.displayName||slug,pieceName:payload.pieceName,pieceVersion:payload.pieceVersion,type:'OAUTH2',value:{type:'OAUTH2',code:safeText(code,4000),client_id:googleOAuth.clientId,client_secret:googleOAuth.clientSecret,code_challenge:payload.verifier,redirect_url:googleOAuth.redirectUrl,grant_type:'authorization_code',scope:payload.scopes,props:payload.props,authorization_method:payload.authorizationMethod}};
    return publicConnection(await provider('/api/v1/app-connections',{method:'POST',body:JSON.stringify(body)}),projectId);
  }
  async function owned(tenantId,id){
    if(!AP_ID.test(String(id||'')))fail('invalid_connection','الاتصال غير صالح.');const projectId=await requireProject(tenantId),connection=await provider(`/api/v1/app-connections/${id}?projectId=${encodeURIComponent(projectId)}`);return {projectId,connection:publicConnection(connection,projectId),rawFlowIds:connection.flowIds};
  }
  async function revalidate({tenantId,id}){const {projectId}=await owned(tenantId,id);return publicConnection(await provider(`/api/v1/app-connections/${id}/revalidate?projectId=${encodeURIComponent(projectId)}`,{method:'POST',body:'{}'}),projectId);}
  async function disconnect({tenantId,id}){
    const {projectId,connection,rawFlowIds}=await owned(tenantId,id);
    if(!Array.isArray(rawFlowIds)||rawFlowIds.some(flowId=>typeof flowId!=='string'||!AP_ID.test(flowId)))fail('connection_usage_unknown','تعذّر التأكد من المهام المرتبطة بهذا الاتصال. بقي الاتصال نشطًا؛ حاول مجددًا أو تواصل مع الدعم.',409);
    if(connection.flowIds.length)fail('connection_in_use','تعذّر فصل الاتصال لأنه مستخدم في مهمة. أوقف المهمة المرتبطة أو تواصل مع الدعم.',409);
    await provider(`/api/v1/app-connections/${id}?projectId=${encodeURIComponent(projectId)}`,{method:'DELETE'});
    return {id,disconnected:true};
  }
  return {methods,list,connect,oauthStart,oauthFinish,revalidate,disconnect};
}
