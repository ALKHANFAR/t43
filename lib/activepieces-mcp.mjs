import {createCipheriv,createDecipheriv,createHash,hkdfSync,randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {TenantProjectError} from './tenant-projects.mjs';

const PROJECT_ID=/^[0-9A-Za-z]{21}$/;
const b64=value=>Buffer.from(value).toString('base64url');
const unb64=value=>Buffer.from(value,'base64url');

export function createActivepiecesMcp({query,requireProject,activepiecesUrl,origin,secret,fetchImpl=fetch}){
  if(typeof query!=='function'||typeof requireProject!=='function')throw new TypeError('MCP store and project resolver are required');
  const base=String(activepiecesUrl||'').replace(/\/$/,'');
  const callback=origin?new URL('/siyadah-api/v1/mcp/callback',origin).toString():'';
  const key=secret?Buffer.from(hkdfSync('sha256',secret,'siyadah-activepieces-mcp','v1',32)):null;
  const ready=()=>{if(!base||!callback||!key)throw new TenantProjectError('mcp_not_configured','اتصال أدوات سيادة غير مهيأ.',503);};
  function seal(value){
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
    const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
    return [b64(iv),b64(cipher.getAuthTag()),b64(encrypted)].join('.');
  }
  function open(value){
    try{
      const [i,t,c]=String(value).split('.');
      const decipher=createDecipheriv('aes-256-gcm',key,unb64(i));decipher.setAuthTag(unb64(t));
      return JSON.parse(Buffer.concat([decipher.update(unb64(c)),decipher.final()]).toString('utf8'));
    }catch{throw new TenantProjectError('mcp_state_invalid','جلسة الربط غير صالحة.',400);}
  }
  async function request(path,options){
    const response=await fetchImpl(base+path,{...options,signal:AbortSignal.timeout(20_000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok&&path==='/token'&&options.body?.get('grant_type')==='refresh_token'&&response.status===400&&data.error==='invalid_grant')throw new TenantProjectError('mcp_grant_expired','ربط أدوات الشركة لم يعد صالحًا. أكمل موافقة الربط مجددًا.',409);
    if(!response.ok)throw new TenantProjectError('mcp_provider_error','تعذّر الاتصال بأدوات التنفيذ.',502);
    return data;
  }
  async function begin(tenantId,{sessionBinding}={}){
    ready();
    const projectId=await requireProject(tenantId);
    const registered=await request('/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_name:'Siyadah',redirect_uris:[callback],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'})});
    if(typeof registered.client_id!=='string'||!registered.client_id)throw new TenantProjectError('mcp_registration_invalid','تعذّر تهيئة الربط.',502);
    const verifier=b64(randomBytes(48));
    const challenge=b64(createHash('sha256').update(verifier).digest());
    const state=seal({tenantId,projectId,clientId:registered.client_id,verifier,expires:Date.now()+10*60_000,...(sessionBinding?{sessionBinding}:{})});
    const url=new URL('/authorize',base);
    for(const [name,value] of Object.entries({client_id:registered.client_id,redirect_uri:callback,response_type:'code',code_challenge:challenge,code_challenge_method:'S256',scope:'mcp',resource:`${base}/mcp`,state}))url.searchParams.set(name,value);
    return url.toString();
  }
  function tokenProject(token){
    try{return JSON.parse(unb64(token.split('.')[1]).toString('utf8')).projectId;}
    catch{return null;}
  }
  async function complete(url,{tenantId,sessionBinding}={}){
    ready();
    const input=new URL(url,callback),state=open(input.searchParams.get('state'));
    if(!state||state.expires<Date.now()||!PROJECT_ID.test(String(state.projectId||'')))throw new TenantProjectError('mcp_state_invalid','انتهت جلسة الربط.',400);
    if(state.sessionBinding&&(tenantId!==state.tenantId||sessionBinding!==state.sessionBinding))throw new TenantProjectError('mcp_session_mismatch','أكمل موافقة الربط من جلسة الشركة التي بدأتها.',403);
    if(input.searchParams.has('error'))throw new TenantProjectError('mcp_consent_denied','لم تكتمل موافقة الربط.',409);
    const projectId=await requireProject(state.tenantId);
    if(projectId!==state.projectId)throw new TenantProjectError('mcp_project_mismatch','تغير مشروع الشركة أثناء الربط.',409);
    const form=new URLSearchParams({grant_type:'authorization_code',client_id:state.clientId,code:input.searchParams.get('code')||'',code_verifier:state.verifier,redirect_uri:callback,resource:`${base}/mcp`});
    const tokens=await request('/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});
    if(!tokens.refresh_token||tokenProject(tokens.access_token)!==projectId)throw new TenantProjectError('mcp_project_mismatch','رمز الأدوات لا يخص مشروع الشركة.',403);
    await rpc(tokens.access_token,'tools/list',{});
    await query(`INSERT INTO siyadah_mcp_grants (tenant_id,project_id,client_id,refresh_token_cipher)
      VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id) DO UPDATE SET project_id=EXCLUDED.project_id,client_id=EXCLUDED.client_id,
      refresh_token_cipher=EXCLUDED.refresh_token_cipher,updated_at=now()`,[state.tenantId,projectId,state.clientId,seal(tokens.refresh_token)]);
    return {tenantId:state.tenantId,projectId};
  }
  async function rpc(token,method,params){
    const response=await fetchImpl(`${base}/mcp`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(150_000)});
    if(!response.ok)throw new TenantProjectError(response.status===401?'mcp_grant_expired':'mcp_call_failed','تعذّر استخدام أدوات الشركة.',response.status===401?409:502);
    const body=await response.text();
    const payload=response.headers.get('content-type')?.includes('text/event-stream')?body.split(/\r?\n\r?\n/).map(block=>block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).join('\n')).map(line=>{try{return JSON.parse(line);}catch{return null;}}).find(item=>item?.id===1):JSON.parse(body);
    if(payload?.error||!payload||payload.result===undefined)throw new TenantProjectError('mcp_call_failed','لم تصل نتيجة صالحة من الأداة.',502);
    return payload.result;
  }
  async function call(tenantId,method,params,accessTokens){
    ready();
    const projectId=await requireProject(tenantId);
    const row=(await query('SELECT project_id,client_id,refresh_token_cipher FROM siyadah_mcp_grants WHERE tenant_id=$1',[tenantId])).rows?.[0];
    if(!row||row.project_id!==projectId)throw new TenantProjectError('mcp_not_connected','قدرات الأدوات تحتاج تهيئة مشروع الشركة.',409);
    let access=accessTokens?.get(tenantId);
    if(!access||access.projectId!==projectId||access.clientId!==row.client_id||access.cipher!==row.refresh_token_cipher||access.expires<=Date.now()){
      access={projectId,clientId:row.client_id,cipher:row.refresh_token_cipher,expires:Infinity};
      accessTokens?.set(tenantId,access);
      access.token=(async()=>{
        const refresh=open(row.refresh_token_cipher);
        const form=new URLSearchParams({grant_type:'refresh_token',client_id:row.client_id,refresh_token:refresh,resource:`${base}/mcp`});
        const tokens=await request('/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});
        if(tokenProject(tokens.access_token)!==projectId)throw new TenantProjectError('mcp_project_mismatch','رفضنا رمز أدوات لمشروع آخر.',403);
        if(tokens.refresh_token&&tokens.refresh_token!==refresh){
          access.cipher=seal(tokens.refresh_token);
          await query('UPDATE siyadah_mcp_grants SET refresh_token_cipher=$1,updated_at=now() WHERE tenant_id=$2 AND project_id=$3',[access.cipher,tenantId,projectId]);
        }
        let expires=0;
        try{expires=Number(JSON.parse(unb64(tokens.access_token.split('.')[1]).toString('utf8')).exp)*1000;}catch{}
        access.expires=Math.min(expires||0,Date.now()+Number(tokens.expires_in||0)*1000)-30_000;
        if(!Number.isFinite(access.expires))access.expires=0;
        return tokens.access_token;
      })();
    }
    try{return await rpc(await access.token,method,params);}
    catch(error){if(accessTokens?.get(tenantId)===access)accessTokens.delete(tenantId);throw error;}
  }
  async function status(tenantId){
    ready();
    const projectId=await requireProject(tenantId);
    const row=(await query('SELECT project_id,client_id FROM siyadah_mcp_grants WHERE tenant_id=$1',[tenantId])).rows?.[0];
    if(!row||row.project_id!==projectId)return {grantPresent:false};
    // Public OAuth registration identity, never a credential/token fingerprint.
    // Refresh rotation can update updated_at without completing a new consent.
    return {grantPresent:true,grantRevision:typeof row.client_id==='string'&&row.client_id.trim()?createHash('sha256').update(row.client_id).digest('hex'):null};
  }
  async function prepare({tenantId,conversationId,employeeId,toolName,args,summary}){
    ready();
    const id=randomUUID();
    await query(`INSERT INTO siyadah_mcp_approvals (id,tenant_id,conversation_id,employee_id,tool_name,args_cipher,summary,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,now()+interval '10 minutes')`,[id,tenantId,conversationId,employeeId||null,toolName,seal(args),summary]);
    return id;
  }
  async function consume({tenantId,conversationId,id}){
    ready();
    const result=await query(`DELETE FROM siyadah_mcp_approvals WHERE id=$1 AND tenant_id=$2 AND conversation_id=$3 AND expires_at>now()
      RETURNING employee_id,tool_name,args_cipher,summary`,[id,tenantId,conversationId]);
    const row=result.rows?.[0];
    return row?{employeeId:row.employee_id,toolName:row.tool_name,args:open(row.args_cipher),summary:row.summary}:null;
  }
  async function init(){await query(readFileSync(new URL('../migrations/0005-activepieces-mcp.sql',import.meta.url),'utf8'));}
  return {init,begin,complete,status,call,prepare,consume,forRequest(){const accessTokens=new Map();return {call:(...args)=>call(...args,accessTokens)};}};
}
