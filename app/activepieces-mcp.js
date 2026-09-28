(function(root){
  "use strict";

  var ACTIVEPIECES_ORIGIN="https://activepieces-production-82ad.up.railway.app";
  var MCP_URL=ACTIVEPIECES_ORIGIN+"/mcp/platform";
  var RESOURCE_METADATA_URL=ACTIVEPIECES_ORIGIN+"/.well-known/oauth-protected-resource/mcp/platform";
  var AUTH_METADATA_URL=ACTIVEPIECES_ORIGIN+"/.well-known/oauth-authorization-server";
  var STORAGE_PREFIX="siyadah.ap.mcp.";
  var protocolVersion="2025-11-25";
  var requestId=0, sessionId=null;

  function storage(){ return root.localStorage; }
  function put(key,value){ storage().setItem(STORAGE_PREFIX+key,value); }
  function get(key){ return storage().getItem(STORAGE_PREFIX+key); }
  function drop(key){ storage().removeItem(STORAGE_PREFIX+key); }
  function json(response){
    return response.json().catch(function(){ return {}; }).then(function(body){
      if(!response.ok){
        var detail=body.error_description||body.error||("HTTP "+response.status);
        throw new Error(detail);
      }
      return body;
    });
  }
  function base64url(bytes){
    var binary="";
    new Uint8Array(bytes).forEach(function(byte){ binary+=String.fromCharCode(byte); });
    return root.btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  }
  function randomValue(size){
    var bytes=new Uint8Array(size||32); root.crypto.getRandomValues(bytes); return base64url(bytes);
  }
  function redirectUri(){ return root.location.origin+root.location.pathname; }
  async function challenge(verifier){
    var bytes=new TextEncoder().encode(verifier);
    return base64url(await root.crypto.subtle.digest("SHA-256",bytes));
  }
  async function discover(){
    var resource=await fetch(RESOURCE_METADATA_URL,{headers:{Accept:"application/json"}}).then(json);
    var issuer=Array.isArray(resource.authorization_servers)&&resource.authorization_servers[0];
    if(issuer!==ACTIVEPIECES_ORIGIN) throw new Error("Activepieces أعلن خادم تفويض غير متوقع.");
    var auth=await fetch(AUTH_METADATA_URL,{headers:{Accept:"application/json"}}).then(json);
    if(!auth.authorization_endpoint||!auth.token_endpoint||!auth.registration_endpoint) throw new Error("بيانات OAuth من Activepieces ناقصة.");
    [auth.authorization_endpoint,auth.token_endpoint,auth.registration_endpoint].forEach(function(endpoint){
      if(new URL(endpoint).origin!==ACTIVEPIECES_ORIGIN) throw new Error("نقطة OAuth غير موثوقة.");
    });
    put("token_endpoint",auth.token_endpoint);
    put("authorization_endpoint",auth.authorization_endpoint);
    put("registration_endpoint",auth.registration_endpoint);
    return {resource:resource,auth:auth};
  }
  async function register(registrationEndpoint){
    var callback=redirectUri();
    var response=await fetch(registrationEndpoint,{
      method:"POST",
      headers:{Accept:"application/json","Content-Type":"application/json"},
      body:JSON.stringify({
        client_name:"Siyadah Browser",
        redirect_uris:[callback],
        grant_types:["authorization_code","refresh_token"],
        response_types:["code"],
        token_endpoint_auth_method:"none"
      })
    });
    var client=await json(response);
    if(!client.client_id) throw new Error("Activepieces لم يُصدر معرّف عميل.");
    put("client_id",client.client_id);
    return client.client_id;
  }
  async function connect(){
    var metadata=await discover();
    var callback=redirectUri();
    var clientId=get("client_id")||await register(metadata.auth.registration_endpoint);
    put("client_id",clientId);
    var verifier=randomValue(64), state=randomValue(32);
    put("verifier",verifier); put("state",state); put("redirect_uri",callback);
    var params=new URLSearchParams({
      client_id:clientId,
      redirect_uri:callback,
      response_type:"code",
      code_challenge:await challenge(verifier),
      code_challenge_method:"S256",
      scope:"mcp",
      state:state,
      resource:MCP_URL
    });
    var url=metadata.auth.authorization_endpoint+"?"+params.toString();
    if(typeof root.__SIY_MCP_NAVIGATE__==="function") root.__SIY_MCP_NAVIGATE__(url);
    else root.location.assign(url);
    return url;
  }
  function cleanCallbackUrl(){
    var url=new URL(root.location.href);
    ["code","state","error","error_description"].forEach(function(key){ url.searchParams.delete(key); });
    root.history.replaceState({},"",url.pathname+(url.search||"")+(url.hash||""));
  }
  async function exchange(code){
    var tokenEndpoint=get("token_endpoint"), clientId=get("client_id"), verifier=get("verifier"), callback=get("redirect_uri");
    if(!tokenEndpoint||!clientId||!verifier||!callback) throw new Error("جلسة ربط Activepieces غير مكتملة. ابدأ الربط من جديد.");
    var body=new URLSearchParams({grant_type:"authorization_code",client_id:clientId,code:code,code_verifier:verifier,redirect_uri:callback,resource:MCP_URL});
    var token=await fetch(tokenEndpoint,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/x-www-form-urlencoded"},body:body.toString()}).then(json);
    if(!token.access_token) throw new Error("Activepieces لم يُصدر رمز وصول.");
    put("access_token",token.access_token);
    if(token.refresh_token) put("refresh_token",token.refresh_token);
    drop("verifier"); drop("state"); drop("redirect_uri");
    return token;
  }
  async function handleCallback(){
    var params=new URLSearchParams(root.location.search);
    var error=params.get("error"), code=params.get("code"), state=params.get("state");
    if(!error&&!code) return false;
    try{
      if(error) throw new Error(params.get("error_description")||error);
      if(!state||state!==get("state")) throw new Error("تعذّر التحقق من جلسة OAuth.");
      await exchange(code);
      return true;
    }finally{ cleanCallbackUrl(); }
  }
  async function refresh(){
    var refreshToken=get("refresh_token"), tokenEndpoint=get("token_endpoint"), clientId=get("client_id");
    if(!refreshToken||!tokenEndpoint||!clientId) throw new Error("انتهت جلسة Activepieces. اربطها من جديد.");
    var body=new URLSearchParams({grant_type:"refresh_token",client_id:clientId,refresh_token:refreshToken,resource:MCP_URL});
    var token=await fetch(tokenEndpoint,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/x-www-form-urlencoded"},body:body.toString()}).then(json);
    if(!token.access_token) throw new Error("تعذّر تجديد جلسة Activepieces.");
    put("access_token",token.access_token);
    if(token.refresh_token) put("refresh_token",token.refresh_token);
    return token.access_token;
  }
  function parseSse(text,id){
    var messages=[];
    text.split(/\r?\n\r?\n/).forEach(function(block){
      var data=block.split(/\r?\n/).filter(function(line){return line.indexOf("data:")===0;}).map(function(line){return line.slice(5).trim();}).join("\n");
      if(data) try{ messages.push(JSON.parse(data)); }catch(ignore){}
    });
    return messages.find(function(message){return message&&message.id===id;})||messages[0]||null;
  }
  async function rpc(method,params,retried){
    var token=get("access_token");
    if(!token) throw new Error("Activepieces غير مربوط.");
    var id=method.indexOf("notifications/")===0?null:++requestId;
    var payload={jsonrpc:"2.0",method:method};
    if(id!==null) payload.id=id;
    if(params!==undefined) payload.params=params;
    var headers={Authorization:"Bearer "+token,Accept:"application/json, text/event-stream","Content-Type":"application/json"};
    if(method!=="initialize") headers["MCP-Protocol-Version"]=protocolVersion;
    if(sessionId) headers["Mcp-Session-Id"]=sessionId;
    var response=await fetch(MCP_URL,{method:"POST",headers:headers,body:JSON.stringify(payload)});
    if(response.status===401&&!retried){ await refresh(); return rpc(method,params,true); }
    if(!response.ok) throw new Error("MCP HTTP "+response.status+": "+(await response.text()).slice(0,240));
    sessionId=response.headers.get("mcp-session-id")||sessionId;
    if(response.status===202||response.status===204) return null;
    var text=await response.text();
    if(!text) return null;
    var message=(response.headers.get("content-type")||"").includes("text/event-stream")?parseSse(text,id):JSON.parse(text);
    if(message&&message.error) throw new Error(message.error.message||"MCP error");
    return message&&message.result!==undefined?message.result:message;
  }
  async function listTools(){
    sessionId=null;
    var initialized=await rpc("initialize",{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"siyadah-browser",version:"1.0.0"}});
    if(initialized&&typeof initialized.protocolVersion==="string") protocolVersion=initialized.protocolVersion;
    /* Activepieces serves MCP statelessly. Skip the optional initialized
       notification because its empty browser response is not fetch-compatible. */
    var tools=[],cursor=null;
    do{
      var result=await rpc("tools/list",cursor?{cursor:cursor}:{});
      if(!result||!Array.isArray(result.tools)) throw new Error("لم تصل قائمة أدوات صحيحة من Activepieces.");
      tools=tools.concat(result.tools); cursor=result.nextCursor||null;
    }while(cursor);
    return tools;
  }
  async function callTool(name,args){
    if(typeof name!=="string"||!name) throw new Error("اسم أداة Activepieces غير صالح.");
    return rpc("tools/call",{name:name,arguments:args&&typeof args==="object"?args:{}});
  }
  function status(){ return {connected:!!get("access_token"),clientRegistered:!!get("client_id")}; }
  function disconnect(){ ["access_token","refresh_token","verifier","state","redirect_uri","token_endpoint","authorization_endpoint","registration_endpoint"].forEach(drop); sessionId=null; }

  root.SiyadahActivepiecesMcp={connect:connect,handleCallback:handleCallback,listTools:listTools,callTool:callTool,status:status,disconnect:disconnect,_parseSse:parseSse};
})(window);
