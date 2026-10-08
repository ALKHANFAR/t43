import test from 'node:test';
import assert from 'node:assert/strict';
import {publishedFlowWorkSteps} from '../lib/chat-intelligence.mjs';
const piece=(name,pieceName='@activepieces/piece-asana',actionName='getCurrentUser')=>({name,type:'PIECE',displayName:name,valid:true,settings:{pieceName,actionName,input:{auth:'PRIVATE_AUTH',nested:{name:'FAKE_STEP',type:'PIECE'}},sampleData:{private:'PRIVATE_SAMPLE'}}});

test('native complete Flow without AI projects trigger, actions and response without credentials',()=>{
  const response=piece('reply','@activepieces/piece-mcp','reply_to_mcp_client'),action=piece('account');action.nextAction=response;
  const trigger={name:'trigger',type:'PIECE_TRIGGER',displayName:'عند الطلب',valid:true,settings:{pieceName:'@activepieces/piece-mcp',triggerName:'mcp_tool',input:{inputSchema:{secret:'PRIVATE_SCHEMA'}}},nextAction:action};
  const result=publishedFlowWorkSteps({trigger});
  assert.equal(result.complete,true);assert.deepEqual(result.steps.map(s=>[s.name,s.kind,s.parent_name]),[['trigger','trigger',null],['account','action','trigger'],['reply','action','account']]);
  assert.equal(result.steps[0].trigger_name,'mcp_tool');assert.equal(result.steps[1].action_name,'getCurrentUser');
  assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);assert.equal(JSON.stringify(result).includes('FAKE_STEP'),false);
});

test('nested decision and loop paths preserve branches without exposing conditions',()=>{
  const inner={name:'inner',type:'AI_ROUTER',settings:{prompt:'PRIVATE_PROMPT'},children:[piece('yes'),null]};
  const loop={name:'loop',type:'LOOP_ON_ITEMS',settings:{items:'PRIVATE_ITEMS'},firstLoopAction:inner,nextAction:piece('branch_tail')};
  const router={name:'choice',type:'ROUTER',settings:{branches:[{conditions:[{firstValue:'PRIVATE_CONDITION'}]}]},children:[loop,null,piece('other')],nextAction:piece('after')};
  const result=publishedFlowWorkSteps({trigger:{name:'trigger',type:'EMPTY',nextAction:router}});
  assert.equal(result.complete,true);assert.deepEqual(result.steps.map(s=>s.name),['trigger','choice','loop','inner','yes','branch_tail','other','after']);
  assert.deepEqual(result.steps.find(s=>s.name==='yes').path,[{parent_name:'choice',kind:'branch',index:0},{parent_name:'loop',kind:'loop'},{parent_name:'inner',kind:'branch',index:0}]);
  assert.deepEqual(result.steps.find(s=>s.name==='branch_tail').path,[{parent_name:'choice',kind:'branch',index:0}]);
  assert.deepEqual(result.steps.at(-1).path,[]);assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);
});

test('native success and failure branches are separate from following actions and metadata is literal',()=>{
  const code={name:'code',type:'CODE',valid:false,skip:true,settings:{sourceCode:{code:'PRIVATE_CODE'}},continueOnFailureBranches:{onSuccess:piece('success'),onFailure:piece('failure')},nextAction:piece('after')};
  const result=publishedFlowWorkSteps({trigger:{name:'trigger',type:'EMPTY',nextAction:code}});
  assert.deepEqual(result.steps.map(s=>s.name),['trigger','code','success','failure','after']);
  assert.equal(result.steps[1].valid,false);assert.equal(result.steps[1].skipped,true);assert.equal(result.steps[1].kind,'code');
  assert.deepEqual(result.steps[2].path,[{parent_name:'code',kind:'success'}]);assert.deepEqual(result.steps[3].path,[{parent_name:'code',kind:'failure'}]);
  assert.equal(JSON.stringify(result).includes('PRIVATE_CODE'),false);assert.equal('succeeded' in result,false);
});

test('absent, unknown and malformed structures never claim a complete known workflow',()=>{
  assert.deepEqual(publishedFlowWorkSteps(null),{steps:[],complete:false});
  assert.equal(publishedFlowWorkSteps({trigger:{name:'new',type:'FUTURE_TYPE',settings:{input:'PRIVATE'}}}).complete,false);
  assert.equal(publishedFlowWorkSteps({trigger:{name:'router',type:'ROUTER',children:{bad:true}}}).complete,false);
  assert.equal(publishedFlowWorkSteps({trigger:{name:'trigger',type:'EMPTY',nextAction:'invalid'}}).complete,false);
  assert.equal(publishedFlowWorkSteps({trigger:{name:'same',type:'EMPTY',nextAction:piece('same')}}).complete,false);
});

test('cycles and large graphs are bounded and explicitly incomplete without mutating native snapshots',()=>{
  const cycle=piece('cycle');cycle.nextAction=cycle;assert.equal(publishedFlowWorkSteps({trigger:cycle}).complete,false);
  const trigger={name:'trigger',type:'EMPTY'};let cursor=trigger;for(let i=0;i<501;i++){cursor.nextAction=piece('step_'+i);cursor=cursor.nextAction;}
  const before=JSON.stringify(trigger),result=publishedFlowWorkSteps({trigger});assert.equal(result.steps.length,500);assert.equal(result.complete,false);assert.equal(JSON.stringify(trigger),before);
});
