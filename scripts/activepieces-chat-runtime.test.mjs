import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source=readFileSync(new URL('../app/activepieces-chat.js',import.meta.url),'utf8');

function response(status,data){ return {ok:status>=200&&status<300,status,json:async()=>data}; }
function page(handler){
  const dom=new JSDOM('',{url:'https://siyadah.test/app/chat.html',runScripts:'outside-only'});
  const calls=[];
  dom.window.SIYADAH_ACTIVEPIECES_NATIVE={baseUrl:'https://cloud.activepieces.test/api/v1/agents',sessionUrl:'/native-session',pollMs:1,maxPolls:4};
  dom.window.fetch=async(url,options={})=>{ const call={url:String(url),options};calls.push(call);return handler(call,calls); };
  dom.window.eval(source);
  return {window:dom.window,calls,close:()=>dom.window.close()};
}

test('native chat creates an Activepieces conversation, sends once and reconciles persisted messages',async()=>{
  let checks=0;
  const p=page(({url,options})=>{
    if(url.endsWith('/native-session')) return response(200,{ok:true,access_token:'user-jwt',project_id:'project-1'});
    assert.equal(options.headers.Authorization,'Bearer user-jwt');
    if(url.endsWith('/conversations')&&options.method==='POST') return response(201,{id:'conversation-1'});
    if(url.endsWith('/conversations/conversation-1/messages')&&options.method==='POST') return response(200,{conversationId:'conversation-1',runId:JSON.parse(options.body).runId});
    if(url.endsWith('/conversations/conversation-1')&&options.method==='GET') return response(200,{id:'conversation-1',status:++checks===1?'STREAMING':'IDLE'});
    if(url.endsWith('/conversations/conversation-1/messages')&&options.method==='GET') return response(200,{data:[{role:'user',content:'ابن فلو'},{role:'assistant',content:'بنيت المسودة داخل Activepieces.'}]});
    throw new Error('Unexpected '+options.method+' '+url);
  });
  try{
    const result=await p.window.SiyadahActivepiecesChat.send({content:'ابن فلو'});
    assert.equal(result.conversationId,'conversation-1');
    assert.equal(result.assistantText,'بنيت المسودة داخل Activepieces.');
    const create=p.calls.find(x=>x.url.endsWith('/conversations')&&x.options.method==='POST');
    assert.deepEqual(JSON.parse(create.options.body),{title:'ابن فلو',modelName:'smart'});
    const send=p.calls.find(x=>x.url.endsWith('/messages')&&x.options.method==='POST');
    assert.equal(JSON.parse(send.options.body).content,'ابن فلو');
    assert.equal(p.calls.filter(x=>x.url.endsWith('/messages')&&x.options.method==='POST').length,1);
    assert.equal(p.window.localStorage.length,0);assert.equal(p.window.sessionStorage.length,0);
  }finally{p.close();}
});

test('native chat keeps conversation identity and exposes approval and cancel endpoints',async()=>{
  const p=page(({url,options})=>{
    if(url.endsWith('/native-session')) return response(200,{ok:true,access_token:'jwt',project_id:'project-1'});
    if(url.endsWith('/pending-gate')) return response(200,{gateId:'gate-1'});
    if(url.endsWith('/tool-approvals/gate-1')) return response(200,{ok:true});
    if(url.endsWith('/cancel')) return response(200,{ok:true});
    if(url.endsWith('/messages')&&options.method==='POST') return response(200,{conversationId:'saved',runId:'run'});
    if(url.endsWith('/conversations/saved')&&options.method==='GET') return response(200,{id:'saved',status:'IDLE'});
    if(url.endsWith('/messages')&&options.method==='GET') return response(200,{data:[{role:'assistant',parts:[{type:'text',text:'واصلت نفس المحادثة.'}]}]});
    throw new Error('Unexpected '+options.method+' '+url);
  });
  try{
    const result=await p.window.SiyadahActivepiecesChat.send({conversationId:'saved',content:'كمل'});
    assert.equal(result.conversationId,'saved');assert.equal(result.assistantText,'واصلت نفس المحادثة.');
    assert.equal(p.calls.some(x=>x.url.endsWith('/conversations')&&x.options.method==='POST'),false);
    assert.deepEqual(await p.window.SiyadahActivepiecesChat.pendingGate('saved'),{gateId:'gate-1'});
    await p.window.SiyadahActivepiecesChat.approveGate('gate-1',true,{confirmed:true});
    await p.window.SiyadahActivepiecesChat.cancel('saved');
    assert.deepEqual(JSON.parse(p.calls.find(x=>x.url.endsWith('/tool-approvals/gate-1')).options.body),{approved:true,payload:{confirmed:true}});
  }finally{p.close();}
});

test('invalid session identity fails closed before contacting Activepieces',async()=>{
  const p=page(({url})=>{ assert.equal(url,'/native-session'); return response(200,{ok:true}); });
  try{ await assert.rejects(()=>p.window.SiyadahActivepiecesChat.send({content:'طلب'}),/هوية Activepieces صالحة/);assert.equal(p.calls.length,1); }
  finally{p.close();}
});
