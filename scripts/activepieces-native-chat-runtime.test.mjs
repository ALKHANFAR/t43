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
  dom.window.localStorage.setItem('token','test-user-token');
  dom.window.fetch=async(url,options={})=>{
    calls.push({url,options});
    if(url==='/api/v1/agents/conversations'&&options.method==='POST') return json(201,{id:'conv-1',status:'IDLE'});
    if(url==='/api/v1/agents/conversations/conv-1/messages'&&options.method==='POST') return json(200,{conversationId:'conv-1',runId:'run-1'});
    if(url==='/api/v1/agents/conversations/conv-1') return json(200,{id:'conv-1',status:'IDLE'});
    if(url==='/api/v1/agents/conversations/conv-1/messages') return json(200,{data:[{role:'assistant',parts:[{type:'text',text:'تم'}]}]});
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
  assert.deepEqual(JSON.parse(calls[0].options.body),{title:'اعرض الفلوهات فقط',modelName:'smart'});
  assert.ok(calls.every(call=>call.options.headers.Authorization==='Bearer test-user-token'));
  assert.ok(calls.every(call=>!String(call.url).includes('/mcp')));
  assert.ok(calls.every(call=>!String(call.url).includes('deepseek')));
});

test('native chat fails closed when no Activepieces user session exists',async()=>{
  const dom=new JSDOM('',{url:'https://activepieces.example/siyadah/app/chat.html',runScripts:'outside-only'});
  let called=false;
  dom.window.fetch=async()=>{called=true;return json(500,{})};
  dom.window.eval(source);

  await assert.rejects(()=>dom.window.SiyadahActivepiecesChat.send('اختبار'),/سجّل الدخول/);
  assert.equal(called,false);
});
