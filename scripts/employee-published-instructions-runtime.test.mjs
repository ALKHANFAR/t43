import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {publishedAIInstructionSteps} from '../lib/chat-intelligence.mjs';
import {CompanyProfileError} from '../lib/company-profile.mjs';
import {TenantProjectError} from '../lib/tenant-projects.mjs';

const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const start=source.indexOf("    if(input.op==='employee_instructions'){"),end=source.indexOf("    if(input.op==='export'){",start);
const flowId='F'.repeat(21),versionId='V'.repeat(21);
const ai=(name,action,prompt,extra={})=>({type:'PIECE',name,settings:{pieceName:'@activepieces/piece-ai',actionName:action,input:{prompt,auth:'private credential',...extra}}});
const normalized=value=>JSON.parse(JSON.stringify(value));

function request({input={op:'employee_instructions',employee_id:'employee-1',read_published:true},employee={id:'employee-1',activepieces_flow_id:flowId},current={id:flowId,status:'DISABLED',publishedVersionId:versionId},version={id:versionId,trigger:{type:'PIECE_TRIGGER',name:'trigger',nextAction:ai('ask','askAi','Published instruction')}},failure=null,publishedRead=null}={}){
  const calls=[],writes=[];
  const context={input,companyId:'company-1',res:{},sessionHeaders:{},CompanyProfileError,TenantProjectError,publishedAIInstructionSteps,console:{warn:()=>{}},
    companyProfiles:async()=>({findEmployee:async(company,id)=>{calls.push(['employee',company,id]);return id==='employee-1'?employee:null;},updateEmployeeInstructions:async args=>{writes.push(args);return {recordId:args.employeeId,instructions:args.instructions};}}),
    tenantProjects:async()=>({ownedFlow:async(company,id,selectedVersion)=>{calls.push(['flow',company,id,selectedVersion||null]);if(failure)throw failure;if(selectedVersion&&version.id!==selectedVersion)throw new TenantProjectError('flow_version_mismatch','Version mismatch',502);return {flow:selectedVersion?{...current,...publishedRead,version}:current};}}),
    json:(_res,status,response)=>({status,response})};
  return {run:()=>runInNewContext(`(async()=>{${source.slice(start,end)}})()`,context),calls,writes};
}

test('published instruction read selects exactly the owned published version and does not write',async()=>{
  const {run,calls,writes}=request({input:{op:'employee_instructions',employee_id:'employee-1',read_published:true,instructions:'Never save this'}});
  const result=normalized(await run());
  assert.deepEqual(calls,[['employee','company-1','employee-1'],['flow','company-1',flowId,null],['flow','company-1',flowId,versionId]]);
  assert.deepEqual(writes,[]);
  assert.equal(result.response.published_instructions.read_status,'verified');
  assert.equal(result.response.published_instructions.flow_status,'DISABLED');
  assert.equal(result.response.published_instructions.steps[0].prompt,'Published instruction');
  assert.equal(JSON.stringify(result).includes('private credential'),false);
  assert.equal(Object.hasOwn(result.response,'employee'),false);
});

test('foreign employee cannot cause any Activepieces read or instruction write',async()=>{
  const {run,calls,writes}=request({input:{op:'employee_instructions',employee_id:'foreign',read_published:true}});
  await assert.rejects(run, error=>error.code==='employee_not_found'&&error.status===404);
  assert.deepEqual(calls,[['employee','company-1','foreign']]);assert.deepEqual(writes,[]);
});

test('project ownership and exact version errors fail closed with unavailable and no prompt data',async()=>{
  for(const options of [{failure:new TenantProjectError('flow_project_mismatch','private details',403)},{version:{id:'different',trigger:{nextAction:ai('secret','askAi','must not return')}}}]){
    const {run,writes}=request(options),result=normalized(await run());
    assert.equal(result.response.published_instructions.read_status,'unavailable');assert.deepEqual(result.response.published_instructions.steps,[]);assert.deepEqual(writes,[]);
    assert.equal(JSON.stringify(result).includes('private details'),false);assert.equal(JSON.stringify(result).includes('must not return'),false);
  }
});

test('an absent Flow or unpublished draft never projects draft instructions',async()=>{
  for(const options of [{employee:{id:'employee-1',activepieces_flow_id:null}},{current:{id:flowId,status:'DISABLED',publishedVersionId:null,version:{trigger:{nextAction:ai('draft','askAi','draft text')}}}}]){
    const {run,calls,writes}=request(options),result=normalized(await run());
    assert.equal(result.response.published_instructions.read_status,'not_published');assert.deepEqual(result.response.published_instructions.steps,[]);assert.equal(calls.filter(c=>c[0]==='flow').length,options.employee?0:1);assert.deepEqual(writes,[]);
  }
});

test('published native graph returns multiple exact AI prompts, not nested business data or Agent instructions',()=>{
  const trigger={type:'PIECE_TRIGGER',name:'trigger',settings:{input:{nested:ai('fake','askAi','Not a step')}},nextAction:{type:'LOOP_ON_ITEMS',name:'loop',firstLoopAction:ai('ask','askAi','  exact\n{{trigger.task}}  '),nextAction:{type:'ROUTER',name:'router',children:[ai('agent','run_agent','Task text',{agentId:'shared-agent'}),ai('adhoc','run_agent','Inline task')]}}};
  assert.deepEqual(publishedAIInstructionSteps({trigger}),[
    {name:'ask',piece_name:'@activepieces/piece-ai',action_name:'askAi',prompt:'  exact\n{{trigger.task}}  '},
    {name:'agent',piece_name:'@activepieces/piece-ai',action_name:'run_agent',prompt:'Task text',prompt_scope:'task_input',agent_instructions_unverified:true},
    {name:'adhoc',piece_name:'@activepieces/piece-ai',action_name:'run_agent',prompt:'Inline task',prompt_scope:'task_input'},
  ]);
});

test('a published Flow with no known literal AI prompt is verified with an empty projection',async()=>{
  const unknown=ai('unknown','unproven_action','Do not label this AI instruction');unknown.nextAction=ai('object','askAi',{secret:'not literal'});
  const {run}=request({version:{id:versionId,trigger:{name:'trigger',nextAction:unknown}}}),result=normalized(await run());
  assert.equal(result.response.published_instructions.read_status,'verified');assert.deepEqual(result.response.published_instructions.steps,[]);
});

test('the existing conversation instruction save stays unchanged and performs no AP reads',async()=>{
  const {run,calls,writes}=request({input:{op:'employee_instructions',employee_id:'employee-1',instructions:'  Saved instruction  '}});
  assert.deepEqual(normalized(await run()),{status:200,response:{ok:true,instructions_verified:true,instruction_scope:'conversation',employee:{recordId:'employee-1',instructions:'Saved instruction'}}});
  assert.deepEqual(calls,[]);assert.deepEqual(normalized(writes),[{companyId:'company-1',employeeId:'employee-1',instructions:'Saved instruction'}]);
});


test('a concurrent new publication cannot label an old version prompt as currently published',async()=>{
  const {run,writes}=request({publishedRead:{publishedVersionId:'N'.repeat(21)}}),result=normalized(await run());
  assert.equal(result.response.published_instructions.read_status,'unavailable');assert.deepEqual(result.response.published_instructions.steps,[]);assert.deepEqual(writes,[]);
});

test('published read reports the status of its final snapshot without claiming activation',async()=>{
  const {run}=request({current:{id:flowId,status:'ENABLED',publishedVersionId:versionId},publishedRead:{status:'DISABLED'}}),result=normalized(await run());
  assert.equal(result.response.published_instructions.read_status,'verified');assert.equal(result.response.published_instructions.flow_status,'DISABLED');
});
