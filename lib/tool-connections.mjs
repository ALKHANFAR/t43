import {createDecipheriv,createHash} from 'node:crypto';
import {TenantProjectError} from './tenant-projects.mjs';

const PIECE=/^@activepieces\/piece-[a-z0-9-]+$/;
const AP_ID=/^[0-9A-Za-z]{21}$/;
const GOOGLE_PIECES=new Set(['@activepieces/piece-gmail']);

function fail(code,message,status=400){throw new TenantProjectError(code,message,status);}
function safeText(value,max=240){return String(value??'').trim().slice(0,max);}
function publicPiece(value){const name=String(value||'');return PIECE.test(name)?name.slice('@activepieces/piece-'.length):'';}
function pieceName(slug){const value=String(slug||'').startsWith('@activepieces/piece-')?String(slug):`@activepieces/piece-${slug}`;if(!PIECE.test(value)||value==='@activepieces/piece-activepieces')fail('invalid_piece','الأداة غير صالحة.');return value;}
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
  const cloudReady=Boolean(String(attemptSecret||'').length>=32&&attemptStore?.save&&attemptStore?.consume&&(()=>{try{return new URL(customerOrigin).protocol==='https:';}catch{return false;}})());
  const cloudFor=name=>cloudReady&&(!GOOGLE_PIECES.has(name)||gmailOAuthProvider==='activepieces');
  const provider=async(path,options={})=>{
    if(!base||!apiKey)fail('provider_not_configured','ربط الأدوات غير مهيأ.',503);
    const response=await fetchImpl(base+path,{...options,headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json',...(options.headers||{})}});
    if(response.status===204)return null;
    const result=await response.json().catch(()=>({}));
    if(!response.ok)fail('connection_provider_error','تعذّر تنفيذ الربط. حاول مجددًا أو تواصل مع الدعم.',response.status===401?502:Math.min(response.status||502,599));
    return result;
  };
  async function metadata(piece){
    pieceName(piece);
    // Tool and connection-field discovery must use the company's native MCP.
    // No auth-schema MCP adapter is configured here; REST is not a fallback.
    fail('native_mcp_discovery_required','تجهيز حقول الربط غير متاح حاليًا. حاول لاحقًا.',409);
  }
  async function methods({tenantId,piece}){
    await requireProject(tenantId);return metadata(piece);
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
  async function connect({tenantId,piece,type}){
    if(type==='OAUTH2')fail('oauth_start_required','ابدأ تسجيل الدخول أولًا.');
    return methods({tenantId,piece});
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
  async function oauthStart({tenantId,sessionBinding,requestOrigin,piece}){
    if(cloudFor(pieceName(piece))){
      if(!sessionBinding||requestOrigin!==customerOrigin)fail('oauth_origin_mismatch','افتح سيادة من نطاق الحساب المعتمد لإتمام ربط Google.',409);
    }else{
      if(!ownGoogle||!sessionBinding)fail('siyadah_oauth_not_ready','تسجيل الدخول لهذه الأداة غير متاح حتى يكتمل ربطه باسم سيادة.',409);
      if(requestOrigin!==callbackOrigin)fail('oauth_origin_mismatch','افتح سيادة من نطاق الحساب المعتمد لإتمام ربط Google.',409);
    }
    return methods({tenantId,piece});
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
