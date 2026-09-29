(function(root){
  "use strict";

  var API="/api/v1/agents";
  var STORAGE_KEY="siyadah.activepieces.conversation_id";
  var POLL_MS=1500;
  var MAX_POLLS=240;

  function token(){ return root.localStorage&&root.localStorage.getItem("token"); }
  function headers(){
    var value=token();
    if(!value) throw new Error("افتح سيادة من داخل Activepieces وسجّل الدخول أولًا.");
    return {Authorization:"Bearer "+value,Accept:"application/json","Content-Type":"application/json"};
  }
  async function request(path,options){
    options=options||{};
    var response=await fetch(API+path,{method:options.method||"GET",headers:headers(),body:options.body===undefined?undefined:JSON.stringify(options.body)});
    var body=await response.json().catch(function(){return {};});
    if(!response.ok){
      var message=body&&body.params&&body.params.message||body&&body.message||body&&body.code||("HTTP "+response.status);
      throw new Error(message);
    }
    return body;
  }
  function savedId(){ return root.localStorage&&root.localStorage.getItem(STORAGE_KEY); }
  function saveId(id){ if(root.localStorage) root.localStorage.setItem(STORAGE_KEY,id); }
  function forget(){ if(root.localStorage) root.localStorage.removeItem(STORAGE_KEY); }
  async function getConversation(id){ return request("/conversations/"+encodeURIComponent(id)); }
  async function ensureConversation(title){
    var id=savedId();
    if(id){
      try{return await getConversation(id);}catch(error){ if(!/not.found|404|ENTITY_NOT_FOUND/i.test(error.message||"")) throw error; forget(); }
    }
    var conversation=await request("/conversations",{method:"POST",body:{title:(title||"محادثة سيادة").slice(0,100),modelName:"deepseek-v4-pro"}});
    saveId(conversation.id);
    return conversation;
  }
  async function messages(id){
    var result=await request("/conversations/"+encodeURIComponent(id)+"/messages");
    return Array.isArray(result.data)?result.data:[];
  }
  async function pendingGate(id){
    return request("/conversations/"+encodeURIComponent(id)+"/pending-gate");
  }
  function wait(ms){ return new Promise(function(resolve){setTimeout(resolve,ms);}); }
  async function snapshot(id){
    var values=await Promise.all([getConversation(id),messages(id),pendingGate(id).catch(function(){return null;})]);
    return {conversation:values[0],messages:values[1],gate:values[2],conversationId:id};
  }
  async function send(text,onUpdate){
    var conversation=await ensureConversation(text);
    var sent=await request("/conversations/"+encodeURIComponent(conversation.id)+"/messages",{method:"POST",body:{content:text}});
    var last=null;
    for(var i=0;i<MAX_POLLS;i++){
      last=await snapshot(conversation.id);
      last.runId=sent.runId||null;
      if(typeof onUpdate==="function") onUpdate(last);
      if(last.gate||last.conversation.status!=="STREAMING") return last;
      await wait(POLL_MS);
    }
    throw new Error("استمر التنفيذ وقتًا طويلًا. افتح المحادثة الأصلية لمتابعة حالتها.");
  }
  async function restore(){
    var id=savedId();
    if(!id) return null;
    try{return await snapshot(id);}catch(error){forget();return null;}
  }
  function nativeUrl(id){ return "/chat/"+encodeURIComponent(id||savedId()||""); }

  root.SiyadahActivepiecesChat={send:send,restore:restore,newConversation:forget,nativeUrl:nativeUrl,status:function(){return {available:!!token(),conversationId:savedId()};}};
})(window);
