// Native MCP access without a consent page (ABO-69, answer to «the customer must not choose an Activepieces project»).
//
// Activepieces 0.92.1 issues a short-lived MCP access token for one project to a signed-in USER with the `READ_MCP` permission on
// it: `POST /api/v1/projects/{id}/mcp-server/token`. A platform OPERATOR has the Editor role in every project of the platform and an
// ADMIN has the Admin role (`project-member.service.ts#getRole`), so one operator account can mint a token for any company's project,
// and the company's own user does not need to be a member. A service key (SERVICE principal) is refused by that route.
// The company is never chosen by the browser: the caller gives the project that `requireProject` resolved for the session's company.
//
// A minted token is checked before it is used: type `mcp_oauth`, the claim `projectId` equal to the project asked for, and an expiry no
// further than 15 minutes (plus 60 s of clock skew). A token that fails any check is refused, so a wrong project cannot be used.
const PROJECT_ID=/^[0-9A-Za-z]{21}$/;
const MAX_LIFETIME_SECONDS=900,SKEW_SECONDS=60,REFRESH_BEFORE_MS=60_000;

export class NativeAuthError extends Error{
  constructor(code){super(code);this.name='NativeAuthError';this.code=code;}
}

function claims(token){
  try{const parts=String(token).split('.');if(parts.length!==3)throw new Error();return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}
  catch{throw new NativeAuthError('native_token_unreadable');}
}

export function createNativeMcpAuth({url,email,password,fetchImpl=fetch,now=()=>Date.now()}={}){
  const origin=String(url||'').replace(/\/$/,''),configured=Boolean(email&&password&&(()=>{try{const parsed=new URL(origin);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash&&parsed.pathname==='/';}catch{return false;}})());
  let user=null,userWork=null;const projects=new Map(),work=new Map();
  async function post(path,token,body){
    let response;
    try{response=await fetchImpl(origin+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20_000),headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});}
    catch{throw new NativeAuthError('native_transport_failed');}
    if(!response.ok)throw new NativeAuthError(response.status===401||response.status===403?'native_rejected':'native_http_error');
    try{return await response.json();}catch{throw new NativeAuthError('native_response_invalid');}
  }
  const fresh=entry=>entry&&entry.expires-now()>REFRESH_BEFORE_MS;
  async function userToken(){
    if(fresh(user))return user.token;
    if(!userWork)userWork=(async()=>{
      const signedIn=await post('/api/v1/authentication/sign-in',null,{email,password});
      if(typeof signedIn.token!=='string')throw new NativeAuthError('native_user_token_missing');
      const payload=claims(signedIn.token);
      if(payload.type!=='USER'||!Number.isFinite(payload.exp)||payload.exp*1000<=now())throw new NativeAuthError('native_user_token_invalid');
      user={token:signedIn.token,expires:payload.exp*1000};
      return user.token;
    })().finally(()=>{userWork=null;});
    return userWork;
  }
  async function mint(projectId){
    let issued;
    try{issued=await post(`/api/v1/projects/${projectId}/mcp-server/token`,await userToken(),{});}
    catch(error){if(error?.code==='native_rejected')user=null;throw error;}
    if(issued.mcpServerUrl!==`${origin}/mcp`||typeof issued.mcpToken!=='string')throw new NativeAuthError('native_endpoint_mismatch');
    const payload=claims(issued.mcpToken),seconds=Math.floor(now()/1000);
    if(payload.type!=='mcp_oauth'||payload.projectId!==projectId)throw new NativeAuthError('native_project_mismatch');
    if(!Number.isFinite(payload.exp)||payload.exp<=seconds||payload.exp>seconds+MAX_LIFETIME_SECONDS+SKEW_SECONDS)throw new NativeAuthError('native_lifetime_invalid');
    return {token:issued.mcpToken,expires:payload.exp*1000};
  }
  return Object.freeze({
    configured,
    // The access token for one company project. Callers of one project share one mint.
    async tokenFor(projectId){
      if(!configured)throw new NativeAuthError('native_not_configured');
      if(!PROJECT_ID.test(String(projectId||'')))throw new NativeAuthError('native_project_invalid');
      const cached=projects.get(projectId);
      if(fresh(cached))return cached.token;
      let pending=work.get(projectId);
      if(!pending){
        pending=mint(projectId).then(entry=>{projects.set(projectId,entry);return entry.token;}).finally(()=>{if(work.get(projectId)===pending)work.delete(projectId);});
        work.set(projectId,pending);
      }
      return pending;
    },
    // A token the engine refused is dropped, but only if it is still the stored one.
    drop(projectId,token){const cached=projects.get(projectId);if(cached&&cached.token===token)projects.delete(projectId);},
  });
}
