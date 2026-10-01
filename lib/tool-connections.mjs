import {createCipheriv,createDecipheriv,createHash,hkdfSync,randomBytes} from 'node:crypto';
import {TenantProjectError} from './tenant-projects.mjs';

const PIECE=/^@activepieces\/piece-[a-z0-9-]+$/;
const AP_ID=/^[0-9A-Za-z]{21}$/;
const TYPES=new Set(['SECRET_TEXT','BASIC_AUTH','CUSTOM_AUTH','OAUTH2','OIDC']);
const REDIRECT='https://secrets.activepieces.com/redirect';
const OAUTH_ATTEMPT_TTL_MS=10*60_000;
const OAUTH_ATTEMPT_PURPOSE='siyadah:tool-oauth-attempt:v1';

function fail(code,message,status=400){throw new TenantProjectError(code,message,status);}
function safeText(value,max=240){return String(value??'').trim().slice(0,max);}
function pieceName(slug){const value=String(slug||'').startsWith('@activepieces/piece-')?String(slug):`@activepieces/piece-${slug}`;if(!PIECE.test(value))fail('invalid_piece','الأداة غير صالحة.');return value;}
function propsOf(auth){return auth?.props&&typeof auth.props==='object'&&!Array.isArray(auth.props)?auth.props:{};}
function fieldsOf(auth){
  if(auth.type==='SECRET_TEXT')return [{name:'secret_text',label:auth.displayName||'المفتاح السري',description:auth.description||'',required:auth.required!==false,type:'password'}];
  if(auth.type==='BASIC_AUTH')return [{name:'username',label:'اسم المستخدم',required:true,type:'text'},{name:'password',label:'كلمة المرور',required:true,type:'password'}];
  return Object.entries(propsOf(auth)).map(([name,field])=>({name,label:field.displayName||name,description:field.description||'',required:field.required===true,type:field.type==='SECRET_TEXT'?'password':field.type==='LONG_TEXT'?'textarea':field.type==='CHECKBOX'?'checkbox':field.type==='NUMBER'?'number':field.type==='STATIC_DROPDOWN'?'dropdown':'text',defaultValue:field.defaultValue,options:Array.isArray(field.options?.options)?field.options.options.map(option=>({label:String(option.label),value:option.value})):[]}));
}
function publicConnection(connection,projectId){
  const projects=connection?.projectIds;
  if(connection?.scope!=='PROJECT'||!Array.isArray(projects)||projects.length!==1||projects[0]!==projectId)fail('connection_project_mismatch','رفضت سيادة اتصالًا لا يخص هذه الشركة وحدها.',403);
  return {id:connection.id,pieceName:connection.pieceName,pieceVersion:connection.pieceVersion,displayName:connection.displayName,status:connection.status,scope:'PROJECT',flowIds:(Array.isArray(connection.flowIds)?connection.flowIds:[]).filter(id=>AP_ID.test(id)),created:connection.created,updated:connection.updated};
}

export function createToolConnectionService({requireProject,fetchImpl=fetch,activepiecesUrl,apiKey,attemptSecret,cloudAppsUrl='https://secrets.activepieces.com/apps?edition=ENTERPRISE'}){
  if(typeof requireProject!=='function')throw new TypeError('requireProject is required');
  const base=String(activepiecesUrl||'').replace(/\/$/,'');
  const secret=String(attemptSecret||'');
  const provider=async(path,options={})=>{
    if(!base||!apiKey)fail('provider_not_configured','ربط الأدوات غير مهيأ.',503);
    const response=await fetchImpl(base+path,{...options,headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json',...(options.headers||{})}});
    if(response.status===204)return null;
    const result=await response.json().catch(()=>({}));
    if(!response.ok)fail('connection_provider_error',safeText(result?.message||result?.params?.message||'تعذّر تنفيذ الربط.'),response.status===401?502:Math.min(response.status||502,599));
    return result;
  };
  async function metadata(piece){
    const name=pieceName(piece),result=await provider(`/api/v1/pieces?searchQuery=${encodeURIComponent(name.replace('@activepieces/piece-',''))}&includeHidden=true&limit=20`);
    const rows=Array.isArray(result)?result:Array.isArray(result?.data)?result.data:[],match=rows.find(row=>row?.name===name);
    if(!match)fail('piece_not_found','الأداة غير موجودة في الكتالوج.',404);
    return match;
  }
  async function cloudApps(){const response=await fetchImpl(cloudAppsUrl);if(!response.ok)return {};return response.json().catch(()=>({}));}
  async function methods({tenantId,piece}){
    await requireProject(tenantId);const meta=await metadata(piece),apps=await cloudApps(),auths=meta.auth==null?[]:(Array.isArray(meta.auth)?meta.auth:[meta.auth]);
    if(!auths.length)return {pieceName:meta.name,pieceVersion:meta.version,noAuth:true,methods:[]};
    return {pieceName:meta.name,pieceVersion:meta.version,noAuth:false,methods:auths.map((auth,index)=>{
      const type=safeText(auth?.type,40),oauth=type==='OAUTH2',app=apps[meta.name]||apps[meta.name.replace('@activepieces/piece-','')];
      return {id:`${type}:${index}`,type,displayName:auth.displayName||'طريقة الربط',description:auth.description||'',fields:fieldsOf(auth),available:TYPES.has(type)&&(!oauth||Boolean(app?.clientId)),message:oauth&&!app?.clientId?'هذه الأداة تحتاج بيانات OAuth خاصة بها.':!TYPES.has(type)?'طريقة الربط هذه غير مدعومة بعد.':'',scopes:Array.isArray(auth.scope)?auth.scope:[]};
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
  function attemptKey(){
    if(secret.length<32)fail('session_not_configured','جلسات الربط غير مهيأة.',503);
    return hkdfSync('sha256',Buffer.from(secret),Buffer.alloc(0),Buffer.from(OAUTH_ATTEMPT_PURPOSE),32);
  }
  function seal(payload){
    const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',attemptKey(),nonce);
    cipher.setAAD(Buffer.from(OAUTH_ATTEMPT_PURPOSE));
    const encrypted=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
    return `v1.${Buffer.concat([nonce,cipher.getAuthTag(),encrypted]).toString('base64url')}`;
  }
  function verify(token,tenantId){
    if(typeof token!=='string'||!token.startsWith('v1.'))fail('invalid_oauth_attempt','محاولة الربط غير صالحة.');
    let payload;
    try{
      const bytes=Buffer.from(token.slice(3),'base64url');
      if(bytes.length<29)throw new Error('invalid attempt length');
      const decipher=createDecipheriv('aes-256-gcm',attemptKey(),bytes.subarray(0,12));
      decipher.setAAD(Buffer.from(OAUTH_ATTEMPT_PURPOSE));decipher.setAuthTag(bytes.subarray(12,28));
      payload=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
    }catch{fail('invalid_oauth_attempt','محاولة الربط غير صالحة.');}
    if(payload?.tenantId!==tenantId)fail('invalid_oauth_attempt','محاولة الربط غير صالحة.');
    if(!Number.isFinite(payload.exp)||Date.now()>=payload.exp||payload.exp-Date.now()>OAUTH_ATTEMPT_TTL_MS)fail('expired_oauth_attempt','انتهت محاولة الربط. أعد المحاولة.');
    return payload;
  }
  async function oauthStart({tenantId,piece,values={}}){
    const {projectId,meta,auth}=await selected({tenantId,piece,type:'OAUTH2'}),apps=await cloudApps(),app=apps[meta.name]||apps[meta.name.replace('@activepieces/piece-','')];if(!app?.clientId)fail('oauth_app_unavailable','تسجيل الدخول غير متاح لهذه الأداة حاليًا.',409);
    const publicUrlTemplate=[auth.authUrl,...(Array.isArray(auth.scope)?auth.scope:[])].join(' ');
    for(const field of fieldsOf(auth)){
      if(field.type==='password'&&publicUrlTemplate.includes(`{${field.name}}`))fail('oauth_secret_in_url','تعريف تسجيل الدخول لهذه الأداة غير آمن.',409);
    }
    const props=authValues({...auth,type:'CUSTOM_AUTH'},values).props,verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
    const attempt=seal({tenantId,pieceName:meta.name,pieceVersion:meta.version,displayName:meta.displayName,clientId:app.clientId,props,verifier,authorizationMethod:auth.authorizationMethod||'HEADER',exp:Date.now()+OAUTH_ATTEMPT_TTL_MS});
    const replace=value=>String(value||'').replace(/\{([^}]+)\}/g,(_,key)=>safeText(props[key],500)),authUrl=replace(auth.authUrl);
    let authorizationUrl;try{authorizationUrl=new URL(authUrl);}catch{fail('oauth_url_missing','تعريف تسجيل الدخول غير مكتمل.',409);}
    if(authorizationUrl.protocol!=='https:')fail('oauth_url_missing','تعريف تسجيل الدخول غير آمن.',409);
    const scopes=(Array.isArray(auth.scope)?auth.scope:[]).map(replace).filter(Boolean).join(' ');
    authorizationUrl.searchParams.set('client_id',app.clientId);authorizationUrl.searchParams.set('redirect_uri',REDIRECT);authorizationUrl.searchParams.set('response_type','code');authorizationUrl.searchParams.set('state',attempt);
    if(scopes)authorizationUrl.searchParams.set('scope',scopes);authorizationUrl.searchParams.set('code_challenge',challenge);authorizationUrl.searchParams.set('code_challenge_method','S256');
    if(auth.prompt&&auth.prompt!=='omit')authorizationUrl.searchParams.set('prompt',auth.prompt);if(auth.accessType)authorizationUrl.searchParams.set('access_type',auth.accessType);
    return {authorizationUrl:authorizationUrl.toString(),allowedOrigin:new URL(REDIRECT).origin,attempt};
  }
  async function oauthFinish({tenantId,attempt,code,state}){
    const payload=verify(attempt,tenantId),projectId=await requireProject(tenantId);if(state!==attempt)fail('invalid_oauth_state','تعذّر التحقق من عودة تسجيل الدخول.',403);if(!safeText(code,4000))fail('oauth_code_missing','لم يصل رمز تسجيل الدخول.');
    const slug=payload.pieceName.replace('@activepieces/piece-',''),body={projectId,externalId:`siyadah-${tenantId}-${slug}`.slice(0,128),displayName:payload.displayName||slug,pieceName:payload.pieceName,pieceVersion:payload.pieceVersion,type:'CLOUD_OAUTH2',value:{type:'CLOUD_OAUTH2',code:safeText(code,4000),client_id:payload.clientId,code_challenge:payload.verifier,props:payload.props,authorization_method:payload.authorizationMethod}};
    return publicConnection(await provider('/api/v1/app-connections',{method:'POST',body:JSON.stringify(body)}),projectId);
  }
  async function owned(tenantId,id){
    if(!AP_ID.test(String(id||'')))fail('invalid_connection','الاتصال غير صالح.');const projectId=await requireProject(tenantId),connection=await provider(`/api/v1/app-connections/${id}?projectId=${encodeURIComponent(projectId)}`);return {projectId,connection:publicConnection(connection,projectId)};
  }
  async function revalidate({tenantId,id}){const {projectId}=await owned(tenantId,id);return publicConnection(await provider(`/api/v1/app-connections/${id}/revalidate?projectId=${encodeURIComponent(projectId)}`,{method:'POST',body:'{}'}),projectId);}
  async function disconnect({tenantId,id}){const {projectId}=await owned(tenantId,id);await provider(`/api/v1/app-connections/${id}?projectId=${encodeURIComponent(projectId)}`,{method:'DELETE'});return {id,disconnected:true};}
  return {methods,list,connect,oauthStart,oauthFinish,revalidate,disconnect};
}
