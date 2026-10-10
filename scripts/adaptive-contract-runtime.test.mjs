import test from 'node:test';
import assert from 'node:assert/strict';
import ReplyView from '../app/reply-view.js';
import {chatUiForResponse} from '../lib/chat-ui.mjs';
const good={schema_version:'1',fallback_text:'Proposed plan',blocks:[{type:'plan',title:'Review',items:['Check policy']}]};
test('shared presentation contract rejects executable unknown and oversized data without truncation',()=>{
  assert.deepEqual(ReplyView.parse(JSON.stringify(good)),good);
  for(const value of [{...good,actions:[{tool:'publish'}]},{...good,blocks:[{...good.blocks[0],run_id:'fake'}]},{...good,blocks:Array(7).fill(good.blocks[0])},{...good,blocks:[{...good.blocks[0],items:Array(41).fill('x')}]},{...good,blocks:[{type:'suggestion',title:'Optional',items:['x','y']}]}]){
    const raw=JSON.stringify(value);assert.equal(ReplyView.parse(raw),null);assert.equal(ReplyView.fallback(raw),'Proposed plan');
  }
  assert.equal(ReplyView.parse('ordinary reply'),null);
  assert.equal(ReplyView.parse(JSON.stringify({...good,fallback_text:'x'.repeat(12001)})),null);
});
test('server presentation validation never adopts model actions or execution claims',()=>{
  const ui=chatUiForResponse({ok:true,conversation_id:'c',reply:JSON.stringify(good)});
  assert.deepEqual(ui.blocks,good.blocks);assert.deepEqual(ui.actions,[]);assert.deepEqual(ui.components,[]);
  assert.equal(chatUiForResponse({ok:false,conversation_id:'c',reply:JSON.stringify(good)}),null);
});
