import {pathToFileURL} from 'node:url';

const ORIGIN='https://activepieces-production-82ad.up.railway.app';
// QA1 verified by the production read-only receipt on 6 October 2026 (ABO-69).
const QA_PROJECTS=new Set(['rPMd07kp7x3epzOdvdiQJ']);
const CREDENTIAL_NAMES=['ACTIVEPIECES_OPERATOR_EMAIL','ACTIVEPIECES_OPERATOR_PASSWORD'];
class ProbeFailure extends Error{
  constructor(code,httpStatus=null){super(code);this.code=code;this.httpStatus=httpStatus;}
}
function claims(token){
  try{const parts=token.split('.');if(parts.length!==3)throw new Error();return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}
  catch{throw new ProbeFailure('invalid_token_metadata');}
}
function validExpiry(payload){return Number.isFinite(payload.exp)&&payload.exp>Math.floor(Date.now()/1000);}
function shortMcpExpiry(payload){
  const now=Math.floor(Date.now()/1000);
  return validExpiry(payload)&&payload.exp<=now+960&&Number.isFinite(payload.iat)&&payload.iat<=now+60&&payload.exp-payload.iat>0&&payload.exp-payload.iat<=900;
}

export async function runNativeAuthProbe({env=process.env,fetchImpl=fetch,onReceipt=()=>{}}={}){
  let stage='configuration';
  const receipt=(value)=>onReceipt({stage,...value});
  try{
    const missing=CREDENTIAL_NAMES.filter(name=>!String(env[name]||'').trim());
    if(missing.length){receipt({ok:false,code:'missing_config',missing});return {ok:false,code:'missing_config',exitCode:2};}
    const projectId=String(env.SIYADAH_NATIVE_AUTH_QA_PROJECT_ID||'rPMd07kp7x3epzOdvdiQJ');
    if(!QA_PROJECTS.has(projectId))throw new ProbeFailure('qa_project_not_allowlisted');
    async function post(path,token,body){
      let response;
      try{response=await fetchImpl(ORIGIN+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20_000),headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{}) ,...(path==='/mcp'?{accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25'}:{})},body:JSON.stringify(body)});}
      catch{throw new ProbeFailure('transport_failed');}
      if(!response.ok)throw new ProbeFailure('http_rejected',response.status);
      receipt({ok:true,httpStatus:response.status});
      let text;
      try{text=await response.text();}catch{throw new ProbeFailure('response_unreadable',response.status);}
      if(text.length>1_000_000)throw new ProbeFailure('response_too_large',response.status);
      try{
        const dataLines=text.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim());
        return JSON.parse(dataLines.length?dataLines.at(-1):text);
      }catch{throw new ProbeFailure('invalid_response',response.status);}
    }
    stage='native_signin';
    const signedIn=await post('/api/v1/authentication/sign-in',null,{email:env.ACTIVEPIECES_OPERATOR_EMAIL,password:env.ACTIVEPIECES_OPERATOR_PASSWORD});
    if(typeof signedIn.token!=='string')throw new ProbeFailure('missing_user_token');
    const userClaims=claims(signedIn.token);
    if(userClaims.type!=='USER'||!validExpiry(userClaims))throw new ProbeFailure('invalid_user_principal');
    stage='project_mcp_issuance';
    const issued=await post(`/api/v1/projects/${projectId}/mcp-server/token`,signedIn.token,{});
    if(issued.mcpServerUrl!==`${ORIGIN}/mcp`||typeof issued.mcpToken!=='string')throw new ProbeFailure('invalid_mcp_endpoint');
    const mcpClaims=claims(issued.mcpToken);
    if(mcpClaims.type!=='mcp_oauth'||mcpClaims.projectId!==projectId||!shortMcpExpiry(mcpClaims))throw new ProbeFailure('mcp_project_or_token_mismatch');
    stage='project_tools_list';
    const listed=await post('/mcp',issued.mcpToken,{jsonrpc:'2.0',id:1,method:'tools/list',params:{}});
    if(listed.error||listed.id!==1||!Array.isArray(listed.result?.tools))throw new ProbeFailure('invalid_tools_list');
    stage='complete';receipt({ok:true,code:'qa_native_auth_verified',toolCount:listed.result.tools.length});
    return {ok:true,code:'qa_native_auth_verified',exitCode:0};
  }catch(error){
    const known=error instanceof ProbeFailure;
    const code=known?error.code:'probe_failed';
    receipt({ok:false,code,...(known&&error.httpStatus!==null?{httpStatus:error.httpStatus}:{})});
    return {ok:false,code,exitCode:1};
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==2){process.stdout.write(JSON.stringify({stage:'configuration',ok:false,code:'arguments_not_supported'})+'\n');process.exitCode=2;}
  else{const result=await runNativeAuthProbe({onReceipt:value=>process.stdout.write(JSON.stringify(value)+'\n')});process.exitCode=result.exitCode;}
}
