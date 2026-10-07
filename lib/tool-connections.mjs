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
function authFingerprint(meta,auth){return createHash('sha256').update(JSON.stringify({name:meta.name,version:meta.version,auth})).digest('hex');}
function propsOf(auth){return auth?.props&&typeof auth.props==='object'&&!Array.isArray(auth.props)?auth.props:{};}
function fieldsOf(auth){
  if(auth.type==='SECRET_TEXT')return [{name:'secret_text',label:auth.displayName||'المفتاح السري',description:auth.description||'',required:auth.required!==false,type:'password'}];
  if(auth.type==='BASIC_AUTH')return [{name:'username',label:'اسم المستخدم',required:true,type:'text'},{name:'password',label:'كلمة المرور',required:true,type:'password'}];
  return Object.entries(propsOf(auth)).map(([name,field])=>({name,label:field.displayName||name,description:field.description||'',required:field.required===true,type:field.type==='SECRET_TEXT'?'password':field.type==='LONG_TEXT'?'textarea':field.type==='CHECKBOX'?'checkbox':field.type==='NUMBER'?'number':field.type==='STATIC_DROPDOWN'?'dropdown':field.type==='STATIC_MULTI_SELECT_DROPDOWN'?'multiselect':field.type==='MARKDOWN'?'markdown':'text',defaultValue:field.defaultValue,options:Array.isArray(field.options?.options)?field.options.options.map(option=>({label:String(option.label),value:option.value})):[]}));
}
function publicConnection(connection,projectId){
  const projects=connection?.projectIds;
  if(connection?.scope!=='PROJECT'||!Array.isArray(projects)||projects.length!==1||projects[0]!==projectId)fail('connection_project_mismatch','رفضت سيادة اتصالًا لا يخص هذه الشركة وحدها.',403);
  const slug=publicPiece(connection.pieceName);
  if(!slug)fail('invalid_provider_connection','تعذّر تأكيد بيانات اتصال الأداة.',502);
  return {id:connection.id,slug,displayName:connection.displayName,status:connection.status,scope:'PROJECT',flowIds:(Array.isArray(connection.flowIds)?connection.flowIds:[]).filter(id=>AP_ID.test(id)),created:connection.created,updated:connection.updated};
}

export function createToolConnectionService({requireProject,fetchImpl=fetch,activepiecesUrl,apiKey,attemptSecret,attemptStore,googleOAuth,customerOrigin,gmailOAuthProvider='siyadah'}){
  if(typeof requireProject!=='function')throw new TypeError('requireProject is required');
  const base=String(activepiecesUrl||'').replace(/\/$/,'');
  const ownGoogle=Boolean(googleOAuth?.clientId&&googleOAuth?.clientSecret&&googleOAuth?.redirectUrl&&String(attemptSecret||'').length>=32&&attemptStore?.save&&attemptStore?.consume&&(()=>{try{const url=new URL(googleOAuth.redirectUrl);return url.protocol==='https:'&&url.hostname.endsWith('.siyadah-ai.com')&&url.pathname==='/siyadah-api/v1/integrations/oauth/callback';}catch{return false;}})());
  const callbackOrigin=ownGoogle?new URL(googleOAuth.redirectUrl).origin:'';
  const cloudOrigin='https://secrets.activepieces.com';
  const cloudReady=Boolean(String(attemptSecret||'').length>=32&&attemptStore?.save&&attemptStore?.consume&&(()=>{try{return new URL(customerOrigin).protocol==='https:';}catch{return false;}})());
  const cloudFor=name=>cloudReady&&(!GOOGLE_PIECES.has(name)||gmailOAuthProvider==='activepieces');
  async function cloudClientId(name){try{const response=await fetchImpl(`${cloudOrigin}/apps?edition=ee`);if(!response.ok)return '';const id=(await response.json())?.[name]?.clientId;return typeof id==='string'&&id.length<=300?id:'';}catch{return '';}}
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
    // Connection consent uses Activepieces auth metadata; action/Flow discovery stays on MCP.
    return {name:match.name,version:match.version,displayName:match.displayName,auth:match.auth};
  }
  async function methods({tenantId,piece,requestOrigin}){
    await requireProject(tenantId);const meta=await metadata(piece),auths=meta.auth==null?[]:(Array.isArray(meta.auth)?meta.auth:[meta.auth]),cloudAvailable=cloudFor(meta.name)&&auths.some(auth=>auth?.type==='OAUTH2')&&Boolean(await cloudClientId(meta.name));
    if(!auths.length)return {noAuth:true,methods:[]};
    return {noAuth:false,methods:auths.map((auth,index)=>{
      const type=safeText(auth?.type,40),grantType=auth?.grantType||'authorization_code',unsupportedGrant=type==='OAUTH2'&&!['authorization_code','both_client_credentials_and_authorization_code'].includes(grantType),oauth=type==='OAUTH2',google=GOOGLE_PIECES.has(meta.name)&&isGoogleAuth(auth)&&Array.isArray(auth.scope)&&auth.scope.includes(GMAIL_SEND_SCOPE),cloud=cloudAvailable&&oauth&&/^https:\/\//.test(auth.authUrl||'')&&Array.isArray(auth.scope),own=ownGoogle&&google&&gmailOwn(),correctOrigin=requestOrigin===(cloud?customerOrigin:callbackOrigin);
      return {id:`${type}:${index}`,fingerprint:authFingerprint(meta,auth),type,...(oauth?{grantType}:{}),displayName:auth.displayName||'طريقة الربط',description:(oauth&&grantType==='both_client_credentials_and_authorization_code'?'المتاح هنا تسجيل الدخول بحساب المستخدم؛ الربط من خادم إلى خادم غير مدعوم حاليًا. ':'')+(cloud?'ستظهر Activepieces في موافقة مزود الأداة، وستطلب الصلاحيات التي تعلنها هذه الأداة. '+(auth.description||''):auth.description||''),fields:fieldsOf(auth),available:TYPES.has(type)&&!unsupportedGrant&&(!oauth||(cloud||own)&&correctOrigin),message:unsupportedGrant?'الربط من خادم إلى خادم غير مدعوم في سيادة حاليًا.':oauth&&(cloud||own)&&!correctOrigin?'افتح سيادة من نطاق الحساب المعتمد لإتمام الربط.':oauth&&!cloud&&!own?'تسجيل الدخول لهذه الأداة غير متاح في سيادة حاليًا.':!TYPES.has(type)?'طريقة الربط هذه غير مدعومة بعد.':'',scopes:cloud?auth.scope||[]:google?[GMAIL_SEND_SCOPE]:oauth?[]:Array.isArray(auth.scope)?auth.scope:[]};
    })};
  }
  async function listRaw(tenantId){
    const projectId=await requireProject(tenantId),connections=[],seen=new Set();
    let cursor=null;
    do{
      const query=new URLSearchParams({projectId,scope:'PROJECT',limit:'100'});
      if(cursor)query.set('cursor',cursor);
      const page=await provider(`/api/v1/app-connections?${query}`);
      if(!Array.isArray(page?.data)||!Object.hasOwn(page,'next'))fail('connection_inventory_unknown','تعذّر تأكيد قائمة اتصالات الشركة.',502);
      connections.push(...page.data.map(row=>({raw:row,visible:publicConnection(row,projectId)})));
      cursor=page.next;
      if(cursor!==null){
        if(typeof cursor!=='string'||!cursor||cursor.length>2000||seen.has(cursor))fail('connection_inventory_unknown','تعذّر تأكيد قائمة اتصالات الشركة.',502);
        seen.add(cursor);
      }
    }while(cursor!==null);
    return connections;
  }
  async function list(tenantId){return (await listRaw(tenantId)).map(row=>row.visible);}
  async function assertOwnedExternal({tenantId,externalId,pieceName}){
    const found=(await listRaw(tenantId)).find(row=>row.raw.externalId===externalId&&row.raw.pieceName===pieceName&&row.visible.status==='ACTIVE');
    if(!found)fail('connection_not_owned','الأداة تحتاج اتصالًا نشطًا يخص شركتك وحدها.',403);
    return found.visible;
  }
  async function selected({tenantId,piece,type,methodId,methodFingerprint}){
    const projectId=await requireProject(tenantId),meta=await metadata(piece),auths=meta.auth==null?[]:(Array.isArray(meta.auth)?meta.auth:[meta.auth]),matches=auths.map((item,index)=>({item,id:`${item?.type}:${index}`})).filter(entry=>entry.item?.type===type);
    if(!methodId&&matches.length>1)fail('auth_method_required','اختر طريقة الربط المحددة.');
    const auth=(methodId?matches.find(entry=>entry.id===methodId):matches[0])?.item;
    if(!auth||!TYPES.has(type))fail('invalid_auth_method','طريقة الربط غير صالحة.');
    if(methodFingerprint&&methodFingerprint!==authFingerprint(meta,auth))fail('stale_auth_method','تغيرت طريقة الربط. افتح خيارات الأداة مجددًا.',409);
    return {projectId,meta,auth};
  }
  function authValues(auth,values={}){
    const fields=fieldsOf(auth),allowed={};
    for(const field of fields){if(field.type==='markdown')continue;let value=values[field.name];if(field.type==='multiselect'&&value!==undefined&&(!Array.isArray(value)||value.some(item=>!field.options.some(option=>option.value===item))))fail('invalid_connection_field',`راجع حقل ${field.label}.`);if(field.required&&(value===undefined||value===null||value===''||Array.isArray(value)&&!value.length))fail('missing_connection_field',`أكمل حقل ${field.label}.`);if(value!==undefined&&value!==null&&value!=='')allowed[field.name]=typeof value==='string'?value.slice(0,20_000):value;}
    if(auth.type==='SECRET_TEXT')return {type:'SECRET_TEXT',secret_text:allowed.secret_text};
    if(auth.type==='BASIC_AUTH')return {type:'BASIC_AUTH',username:allowed.username,password:allowed.password};
    return {type:auth.type,props:allowed};
  }
  async function connect({tenantId,piece,type,methodId,methodFingerprint,values}){
    if(type==='OAUTH2')fail('oauth_start_required','ابدأ تسجيل الدخول أولًا.');
    const {projectId,meta,auth}=await selected({tenantId,piece,type,methodId,methodFingerprint}),slug=meta.name.replace('@activepieces/piece-',''),body={projectId,externalId:`siyadah-${tenantId}-${slug}`.slice(0,128),displayName:meta.displayName||slug,pieceName:meta.name,pieceVersion:meta.version,type,value:authValues(auth,values)};
    return publicConnection(await provider('/api/v1/app-connections',{method:'POST',body:JSON.stringify(body)}),projectId);
  }
  function isGoogleAuth(auth){try{const url=new URL(auth?.authUrl);return auth?.type==='OAUTH2'&&url.protocol==='https:'&&url.hostname==='accounts.google.com';}catch{return false;}}
  function gmailOwn(){return gmailOAuthProvider==='siyadah';}
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
  async function oauthStart({tenantId,sessionBinding,requestOrigin,piece,methodId,methodFingerprint,values={}}){
    if(cloudFor(pieceName(piece))){
      if(!sessionBinding||requestOrigin!==customerOrigin)fail('oauth_origin_mismatch','افتح سيادة من نطاق الحساب المعتمد لإتمام ربط Google.',409);
      const {meta,auth}=await selected({tenantId,piece,type:'OAUTH2',methodId,methodFingerprint});
      if(auth.grantType&&!['authorization_code','both_client_credentials_and_authorization_code'].includes(auth.grantType))fail('unsupported_oauth_grant','الربط من خادم إلى خادم غير مدعوم في سيادة حاليًا.',409);
      if(!Array.isArray(auth.scope)||typeof auth.authUrl!=='string')fail('cloud_oauth_unavailable','تسجيل الدخول لهذه الأداة غير متاح حاليًا.',409);
      const clientId=await cloudClientId(meta.name);
      if(!clientId)fail('cloud_oauth_unavailable','تسجيل الدخول لهذه الأداة غير متاح حاليًا.',409);
      const props=authValues({...auth,type:'CUSTOM_AUTH'},values).props;
      const replace=value=>String(value??'').replace(/\{([^}]+)\}/g,(_,key)=>safeText(props[key],500));
      const scopes=auth.scope.map(replace).join(' ');
      const expiresAt=Date.now()+10*60_000,codeVerifier=auth.pkce?randomBytes(32).toString('base64url'):'',attempt=seal({provider:'activepieces',tenantId,pieceName:meta.name,pieceVersion:meta.version,displayName:meta.displayName,clientId,codeVerifier,props,scopes,authorizationMethod:auth.authorizationMethod||'BODY',expiresAt});
      let url;try{url=new URL(replace(auth.authUrl));}catch{fail('invalid_oauth_url','تعذّر التحقق من صفحة تسجيل الدخول.',502);}
      if(url.protocol!=='https:'||/\{[^}]+\}/.test(url.toString()+scopes))fail('invalid_oauth_url','تعذّر التحقق من صفحة تسجيل الدخول.',502);
      for(const [key,value] of Object.entries(auth.extra||{}))url.searchParams.set(key,replace(value));
      url.searchParams.set('response_type','code');url.searchParams.set('client_id',clientId);url.searchParams.set('redirect_uri',`${cloudOrigin}/redirect`);url.searchParams.set('state',attempt);url.searchParams.set('scope',scopes);url.searchParams.set('access_type','offline');
      if(auth.prompt!=='omit')url.searchParams.set('prompt',auth.prompt||'consent');
      if(codeVerifier){const method=auth.pkceMethod||'plain';url.searchParams.set('code_challenge_method',method);url.searchParams.set('code_challenge',method==='S256'?createHash('sha256').update(codeVerifier).digest('base64url'):codeVerifier);}
      await attemptStore.save({state:attempt,companyId:tenantId,sessionBinding,expiresAt});
      return {provider:'cloud',authorizationUrl:url.toString(),allowedOrigin:cloudOrigin,attempt};
    }
    if(!ownGoogle||!sessionBinding)fail('siyadah_oauth_not_ready','تسجيل الدخول لهذه الأداة غير متاح حتى يكتمل ربطه باسم سيادة.',409);
    if(requestOrigin!==callbackOrigin)fail('oauth_origin_mismatch','افتح سيادة من نطاق الحساب المعتمد لإتمام ربط Google.',409);
    const {meta,auth}=await selected({tenantId,piece,type:'OAUTH2',methodId,methodFingerprint});
      if(auth.grantType&&!['authorization_code','both_client_credentials_and_authorization_code'].includes(auth.grantType))fail('unsupported_oauth_grant','الربط من خادم إلى خادم غير مدعوم في سيادة حاليًا.',409);
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
  async function cloudOauthFinish({tenantId,sessionBinding,attempt,code}){
    if(!cloudReady||!sessionBinding)fail('cloud_oauth_unavailable','تسجيل الدخول لهذه الأداة غير متاح حاليًا.',409);
    const payload=open(attempt);
    if(payload.provider!=='activepieces'||payload.tenantId!==tenantId||Date.now()>payload.expiresAt||!safeText(code,4000))fail('invalid_oauth_state','محاولة الربط غير صالحة.',403);
    if(!await attemptStore.consume({state:attempt,companyId:tenantId,sessionBinding}))fail('invalid_oauth_state','محاولة الربط مستعملة أو انتهت.',403);
    const projectId=await requireProject(tenantId),slug=payload.pieceName.replace('@activepieces/piece-','');
    const body={projectId,externalId:`siyadah-${tenantId}-${slug}`.slice(0,128),displayName:payload.displayName||slug,pieceName:payload.pieceName,pieceVersion:payload.pieceVersion,type:'CLOUD_OAUTH2',value:{type:'CLOUD_OAUTH2',client_id:payload.clientId,code:safeText(code,4000),...(payload.codeVerifier?{code_challenge:payload.codeVerifier}:{}),scope:payload.scopes,props:payload.props,authorization_method:payload.authorizationMethod}};
    return publicConnection(await provider('/api/v1/app-connections',{method:'POST',body:JSON.stringify(body)}),projectId);
  }
  async function owned(tenantId,id){
    if(!AP_ID.test(String(id||'')))fail('invalid_connection','الاتصال غير صالح.');const projectId=await requireProject(tenantId),connection=await provider(`/api/v1/app-connections/${id}?projectId=${encodeURIComponent(projectId)}`);return {projectId,connection:publicConnection(connection,projectId),rawFlowIds:connection.flowIds,externalId:connection.externalId};
  }
  async function flowVersionsUseConnection(projectId,externalId){
    if(typeof externalId!=='string'||!externalId)fail('connection_usage_unknown','تعذّر التأكد من المهام المرتبطة بهذا الاتصال. بقي الاتصال نشطًا؛ حاول مجددًا أو تواصل مع الدعم.',409);
    for(const versionState of ['DRAFT','LOCKED']){
      let cursor=null;const seen=new Set();
      do{
        const query=new URLSearchParams({projectId,versionState,limit:'100'});
        if(cursor)query.set('cursor',cursor);
        const page=await provider(`/api/v1/flows?${query}`);
        if(!Array.isArray(page?.data)||!Object.hasOwn(page,'next'))fail('connection_usage_unknown','تعذّر التأكد من المهام المرتبطة بهذا الاتصال. بقي الاتصال نشطًا؛ حاول مجددًا أو تواصل مع الدعم.',409);
        for(const flow of page.data){
          const version=flow?.version;
          if(flow?.projectId!==projectId||!['DRAFT','LOCKED'].includes(version?.state)||(versionState==='LOCKED'&&(version.state!=='LOCKED'||version.id!==flow.publishedVersionId))||!Array.isArray(version.connectionIds)||version.connectionIds.some(id=>typeof id!=='string'))fail('connection_usage_unknown','تعذّر التأكد من المهام المرتبطة بهذا الاتصال. بقي الاتصال نشطًا؛ حاول مجددًا أو تواصل مع الدعم.',409);
          if(version.connectionIds.includes(externalId))return true;
        }
        cursor=page.next;
        if(cursor!==null){if(typeof cursor!=='string'||!cursor||cursor.length>2000||seen.has(cursor))fail('connection_usage_unknown','تعذّر التأكد من المهام المرتبطة بهذا الاتصال. بقي الاتصال نشطًا؛ حاول مجددًا أو تواصل مع الدعم.',409);seen.add(cursor);}
      }while(cursor!==null);
    }
    return false;
  }
  async function revalidate({tenantId,id}){const {projectId}=await owned(tenantId,id);return publicConnection(await provider(`/api/v1/app-connections/${id}/revalidate?projectId=${encodeURIComponent(projectId)}`,{method:'POST',body:'{}'}),projectId);}
  async function disconnect({tenantId,id}){
    const {projectId,connection,rawFlowIds,externalId}=await owned(tenantId,id);
    if(!Array.isArray(rawFlowIds)||rawFlowIds.some(flowId=>typeof flowId!=='string'||!AP_ID.test(flowId)))fail('connection_usage_unknown','تعذّر التأكد من المهام المرتبطة بهذا الاتصال. بقي الاتصال نشطًا؛ حاول مجددًا أو تواصل مع الدعم.',409);
    if(connection.flowIds.length)fail('connection_in_use','تعذّر فصل الاتصال لأنه مستخدم في مهمة. أوقف المهمة المرتبطة أو تواصل مع الدعم.',409);
    if(await flowVersionsUseConnection(projectId,externalId))fail('connection_in_use','تعذّر فصل الاتصال لأنه مستخدم في مهمة. أوقف المهمة المرتبطة أو تواصل مع الدعم.',409);
    await provider(`/api/v1/app-connections/${id}?projectId=${encodeURIComponent(projectId)}`,{method:'DELETE'});
    return {id,disconnected:true};
  }
  return {methods,list,assertOwnedExternal,connect,oauthStart,oauthFinish,cloudOauthFinish,revalidate,disconnect};
}
