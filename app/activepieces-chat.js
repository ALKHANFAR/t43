(function(root){
  "use strict";

  var cfg=root.SIYADAH_ACTIVEPIECES_NATIVE||{};
  var base=String(cfg.baseUrl||"https://cloud.activepieces.com/api/v1/agents").replace(/\/$/,"");
  var sessionUrl=cfg.sessionUrl||"/siyadah-api/v1/activepieces/native-session";
  var pollMs=Number(cfg.pollMs)||5000;
  var maxPolls=Number(cfg.maxPolls)||120;
  var auth=null;

  function failure(message,noRetry){ var error=new Error(message); error.noRetry=!!noRetry; return error; }
  function sleep(ms){ return new Promise(function(resolve){ root.setTimeout(resolve,ms); }); }
  function json(response){
    return response.json().catch(function(){ throw failure("وصل رد غير صالح من Activepieces."); });
  }
  async function session(force){
    if(auth&&!force) return auth;
    var response=await root.fetch(sessionUrl,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:"{}"});
    if(response.status===401||response.status===403) throw failure("تعذّر ربط حساب سيادة بمستخدم Activepieces.",true);
    if(!response.ok) throw failure("تعذّر إنشاء جلسة Activepieces الأصلية.");
    var data=await json(response);
    if(!data||data.ok!==true||typeof data.access_token!=="string"||!data.access_token||typeof data.project_id!=="string"||!data.project_id) throw failure("لم تصل هوية Activepieces صالحة.",true);
    auth={token:data.access_token,projectId:data.project_id};
    return auth;
  }
  async function request(path,options,retry){
    var current=await session(false), init=Object.assign({},options||{}), headers=Object.assign({},init.headers||{});
    headers.Authorization="Bearer "+current.token; headers["Content-Type"]="application/json"; init.headers=headers;
    var response=await root.fetch(base+path,init);
    if((response.status===401||response.status===403)&&retry!==false){ auth=null; await session(true); return request(path,options,false); }
    if(response.status===429) throw failure("Activepieces أوقف الطلب مؤقتًا بسبب حد الرسائل.");
    if(!response.ok) throw failure("تعذّر إكمال الطلب في شات Activepieces الأصلي.");
    return json(response);
  }
  function id(){ return root.crypto&&typeof root.crypto.randomUUID==="function"?root.crypto.randomUUID():"run-"+Date.now()+"-"+Math.random().toString(16).slice(2); }
  function title(text){ return String(text||"").trim().slice(0,100)||"محادثة سيادة"; }
  function messageText(message){
    if(!message||message.role!=="assistant") return "";
    if(typeof message.content==="string") return message.content;
    var parts=Array.isArray(message.parts)?message.parts:Array.isArray(message.content)?message.content:[];
    return parts.map(function(part){
      if(typeof part==="string") return part;
      if(!part||typeof part!=="object") return "";
      if(typeof part.text==="string") return part.text;
      if(part.type==="text"&&typeof part.content==="string") return part.content;
      return "";
    }).filter(Boolean).join("\n");
  }
  function latestAssistant(messages){
    for(var i=messages.length-1;i>=0;i--){ var text=messageText(messages[i]); if(text) return text; }
    return "أكمل Activepieces الطلب، لكن لم يصل نص الرد المحفوظ.";
  }
  async function createConversation(text){
    return request("/conversations",{method:"POST",body:JSON.stringify({title:title(text),modelName:"smart"})});
  }
  async function getConversation(conversationId){ return request("/conversations/"+encodeURIComponent(conversationId),{method:"GET"}); }
  async function getMessages(conversationId){
    var data=await request("/conversations/"+encodeURIComponent(conversationId)+"/messages",{method:"GET"});
    return Array.isArray(data&&data.data)?data.data:Array.isArray(data)?data:[];
  }
  async function waitForResult(conversationId){
    for(var attempt=0;attempt<maxPolls;attempt++){
      var conversation=await getConversation(conversationId), status=String(conversation&&conversation.status||"").toUpperCase();
      if(status==="ERROR") throw failure("تعذّر تنفيذ الطلب داخل شات Activepieces الأصلي.");
      if(status==="IDLE"){
        var messages=await getMessages(conversationId);
        return {status:status,messages:messages,assistantText:latestAssistant(messages)};
      }
      await sleep(pollMs);
    }
    throw failure("استمر تنفيذ Activepieces مدة أطول من الحد؛ لم نعتبره مكتملًا.");
  }
  async function send(input){
    var text=String(input&&input.content||"").trim(); if(!text) throw failure("اكتب طلبًا قبل الإرسال.",true);
    var conversationId=input&&input.conversationId;
    if(!conversationId){ var created=await createConversation(text); conversationId=created&&created.id; }
    if(typeof conversationId!=="string"||!conversationId) throw failure("لم ينشئ Activepieces محادثة صالحة.");
    var runId=id();
    await request("/conversations/"+encodeURIComponent(conversationId)+"/messages",{method:"POST",body:JSON.stringify({content:text,runId:runId})});
    var result=await waitForResult(conversationId);
    return Object.assign({conversationId:conversationId,runId:runId},result);
  }
  async function pendingGate(conversationId){ return request("/conversations/"+encodeURIComponent(conversationId)+"/pending-gate",{method:"GET"}); }
  async function approveGate(gateId,approved,payload){ return request("/tool-approvals/"+encodeURIComponent(gateId),{method:"POST",body:JSON.stringify({approved:approved===true,payload:payload||undefined})}); }
  async function cancel(conversationId){ return request("/conversations/"+encodeURIComponent(conversationId)+"/cancel",{method:"POST",body:"{}"}); }

  root.SiyadahActivepiecesChat={send:send,getConversation:getConversation,getMessages:getMessages,pendingGate:pendingGate,approveGate:approveGate,cancel:cancel,clear:function(){auth=null;}};
})(window);
