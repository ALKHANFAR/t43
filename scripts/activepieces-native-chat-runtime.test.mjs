import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JSDOM} from 'jsdom';

const source=readFileSync(new URL('../app/activepieces-native-chat.js',import.meta.url),'utf8');

function json(status,body){
  return {ok:status>=200&&status<300,status,json:async()=>body};
}

test('native Siyadah chat uses the authenticated Activepieces conversation runtime',async()=>{
  const dom=new JSDOM('',{url:'https://activepieces.example/siyadah/app/chat.html',runScripts:'outside-only'});
  const calls=[];
  let posted=false;
  dom.window.localStorage.setItem('token','test-user-token');
  dom.window.fetch=async(url,options={})=>{
    calls.push({url,options});
    if(url==='/api/v1/agents/conversations'&&options.method==='POST') return json(201,{id:'conv-1',status:'IDLE'});
    if(url==='/api/v1/agents/conversations/conv-1/messages'&&options.method==='POST') {posted=true;return json(200,{conversationId:'conv-1',runId:'run-1'});}
    if(url==='/api/v1/agents/conversations/conv-1') return json(200,{id:'conv-1',status:'IDLE'});
    if(url==='/api/v1/agents/conversations/conv-1/messages') return json(200,{data:posted?[{role:'assistant',parts:[{type:'text',text:'تم'}]}]:[]});
    if(url==='/api/v1/agents/conversations/conv-1/pending-gate') return json(200,null);
    throw new Error('unexpected request '+url);
  };
  dom.window.eval(source);
  const updates=[];
  const result=await dom.window.SiyadahActivepiecesChat.send('اعرض الفلوهات فقط',snapshot=>updates.push(snapshot));

  assert.equal(result.conversationId,'conv-1');
  assert.equal(result.runId,'run-1');
  assert.equal(updates.length,1);
  assert.equal(dom.window.localStorage.getItem('siyadah.activepieces.conversation_id'),'conv-1');
  assert.equal(calls[0].url,'/api/v1/agents/conversations');
  assert.deepEqual(JSON.parse(calls[0].options.body),{title:'اعرض الفلوهات فقط',modelName:'deepseek-v4-pro'});
  assert.ok(calls.every(call=>call.options.headers.Authorization==='Bearer test-user-token'));
  assert.ok(calls.every(call=>!String(call.url).includes('/mcp')));
  assert.ok(calls.every(call=>!String(call.url).includes('deepseek')));
});

test('native invocation waits for the queued worker instead of treating an early IDLE as completion',async()=>{
  const dom=new JSDOM('',{url:'https://activepieces.example/siyadah/app/chat.html',runScripts:'outside-only'});
  dom.window.localStorage.setItem('token','test-user-token');
  dom.window.setTimeout=(callback)=>{callback();return 1;};
  let posted=false;
  let snapshots=0;
  dom.window.fetch=async(url,options={})=>{
    if(url==='/api/v1/agents/conversations'&&options.method==='POST') return json(201,{id:'conv-queue',status:'IDLE'});
    if(url==='/api/v1/agents/conversations/conv-queue/messages'&&options.method==='POST') {posted=true;return json(200,{conversationId:'conv-queue',runId:'run-queue'});}
    if(url==='/api/v1/agents/conversations/conv-queue/messages'){
      if(!posted) return json(200,{data:[]});
      return json(200,{data:snapshots>=3?[{role:'assistant',parts:[{type:'text',text:'اكتمل'}]}]:[]});
    }
    if(url==='/api/v1/agents/conversations/conv-queue'){
      snapshots++;
      return json(200,{id:'conv-queue',status:snapshots===2?'STREAMING':'IDLE'});
    }
    if(url==='/api/v1/agents/conversations/conv-queue/pending-gate') return json(200,null);
    throw new Error('unexpected request '+url);
  };
  dom.window.eval(source);

  const updates=[];
  const result=await dom.window.SiyadahActivepiecesChat.send('اختبار استدعاء',snapshot=>updates.push(snapshot));

  assert.equal(result.runId,'run-queue');
  assert.equal(result.messages.at(-1).parts[0].text,'اكتمل');
  assert.equal(updates.length,3);
});

test('native chat fails closed when no Activepieces user session exists',async()=>{
  const dom=new JSDOM('',{url:'https://activepieces.example/siyadah/app/chat.html',runScripts:'outside-only'});
  let called=false;
  dom.window.fetch=async()=>{called=true;return json(500,{})};
  dom.window.eval(source);

  await assert.rejects(()=>dom.window.SiyadahActivepiecesChat.send('اختبار'),/سجّل الدخول/);
  assert.equal(called,false);
});
