import {TenantProjectError} from './tenant-projects.mjs';

const PIECE=/^@activepieces\/piece-[a-z0-9-]+$/;
const AP_ID=/^[0-9A-Za-z]{21}$/;
const TYPES=new Set(['SECRET_TEXT','BASIC_AUTH','CUSTOM_AUTH','OAUTH2','OIDC']);

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
  return {id:connection.id,pieceName:slug,pieceVersion:connection.pieceVersion,displayName:connection.displayName,status:connection.status,scope:'PROJECT',flowIds:(Array.isArray(connection.flowIds)?connection.flowIds:[]).filter(id=>AP_ID.test(id)),created:connection.created,updated:connection.updated};
}

export function createToolConnectionService({requireProject,fetchImpl=fetch,activepiecesUrl,apiKey}){
  if(typeof requireProject!=='function')throw new TypeError('requireProject is required');
  const base=String(activepiecesUrl||'').replace(/\/$/,'');
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
  async function methods({tenantId,piece}){
    await requireProject(tenantId);const meta=await metadata(piece),auths=meta.auth==null?[]:(Array.isArray(meta.auth)?meta.auth:[meta.auth]);
    if(!auths.length)return {pieceName:publicPiece(meta.name),pieceVersion:meta.version,noAuth:true,methods:[]};
    return {pieceName:publicPiece(meta.name),pieceVersion:meta.version,noAuth:false,methods:auths.map((auth,index)=>{
      const type=safeText(auth?.type,40),oauth=type==='OAUTH2';
      return {id:`${type}:${index}`,type,displayName:auth.displayName||'طريقة الربط',description:auth.description||'',fields:fieldsOf(auth),available:TYPES.has(type)&&!oauth,message:oauth?'تسجيل الدخول لهذه الأداة غير متاح حتى يكتمل ربطه باسم سيادة.':!TYPES.has(type)?'طريقة الربط هذه غير مدعومة بعد.':'',scopes:Array.isArray(auth.scope)?auth.scope:[]};
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
  async function oauthStart(){
    fail('siyadah_oauth_not_ready','تسجيل الدخول لهذه الأداة غير متاح حتى يكتمل ربطه باسم سيادة.',409);
  }
  async function oauthFinish(){
    fail('siyadah_oauth_not_ready','تسجيل الدخول لهذه الأداة غير متاح حتى يكتمل ربطه باسم سيادة.',409);
  }
  async function owned(tenantId,id){
    if(!AP_ID.test(String(id||'')))fail('invalid_connection','الاتصال غير صالح.');const projectId=await requireProject(tenantId),connection=await provider(`/api/v1/app-connections/${id}?projectId=${encodeURIComponent(projectId)}`);return {projectId,connection:publicConnection(connection,projectId)};
  }
  async function revalidate({tenantId,id}){const {projectId}=await owned(tenantId,id);return publicConnection(await provider(`/api/v1/app-connections/${id}/revalidate?projectId=${encodeURIComponent(projectId)}`,{method:'POST',body:'{}'}),projectId);}
  async function disconnect({tenantId,id}){const {projectId}=await owned(tenantId,id);await provider(`/api/v1/app-connections/${id}?projectId=${encodeURIComponent(projectId)}`,{method:'DELETE'});return {id,disconnected:true};}
  return {methods,list,connect,oauthStart,oauthFinish,revalidate,disconnect};
}
