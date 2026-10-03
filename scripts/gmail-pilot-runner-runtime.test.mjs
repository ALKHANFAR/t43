import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createGmailPilotRunner,GMAIL_PILOT_COMMAND} from '../lib/gmail-pilot-runner.mjs';

const companyId='company_Vo6C04LfL8-hsuPAF_0y9f0N',projectId='IgVzWxZU2AsDQMo6ZCugr',flowId='xoYfYSvwoNH3JGOpQdqpM',connectionId='q1jirYwoeM1gDH3wtkksz',runId='IM2FOjaApVRHWWqAf8iO2',versionId='V'.repeat(21),secret='s'.repeat(40);
const externalId=`siyadah-${companyId}-gmail`;
const connection={id:connectionId,externalId,scope:'PROJECT',projectIds:[projectId],status:'ACTIVE',pieceName:'@activepieces/piece-gmail'};
const flow={id:flowId,projectId,status:'ENABLED',publishedVersionId:versionId,version:{id:versionId,state:'LOCKED',connectionIds:[externalId],trigger:{type:'PIECE_TRIGGER',settings:{pieceName:'@activepieces/piece-webhook',triggerName:'catch_webhook',input:{authType:'hmac',authFields:{hmacHeaderName:'x-siyadah-signature',hmacAlgorithm:'sha256',hmacEncoding:'hex'}}},nextAction:{name:'step_1',type:'PIECE',settings:{pieceName:'@activepieces/piece-gmail',actionName:'send_email',errorHandlingOptions:{retryOnFailure:{value:false},continueOnFailure:{value:false}},input:{auth:`{{connections['${externalId}']}}`,receiver:['a@sondos-ai.com'],from:'a@sondos-ai.com',subject:'SIY-ABO61-PILOT-20261002',body_type:'plain_text',body:'اختبار إرسال سيادة من الشات للشركة 43',draft:false,retry:false}}}}}};
const run={id:runId,projectId,flowId,status:'SUCCEEDED',steps:{trigger:{output:{body:{requestId:'gmail_send_review_demo_v2'}}},step_1:{status:'SUCCEEDED',output:{data:{id:'gmail-message-1'}}}}};
function harness({withRun=true,otherCompany=false,draft=false,logsDelayed=false,duplicateRun=false}={}){
  const calls=[];
  let detailReads=0;
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    let data;
    if(url.endsWith(`/flows/${flowId}`))data=draft?{...flow,status:'DISABLED',publishedVersionId:null}:flow;
    else if(url.includes(`/flows/${flowId}?versionId=`))data=flow;
    else if(url.includes(`/app-connections/${connectionId}`))data=connection;
    else if(url.includes('/flow-runs?'))data={data:withRun?[{id:runId,flowId,projectId,created:new Date().toISOString()},...(duplicateRun?[{id:'S'.repeat(21),flowId,projectId,created:new Date().toISOString()}]:[])]:[]};
    else if(url.endsWith(`/flow-runs/${runId}`))data=logsDelayed&&detailReads++===0?{...run,steps:{}}:run;
    else if(url.endsWith(`/flow-runs/${'S'.repeat(21)}`))data={...run,id:'S'.repeat(21),steps:{...run.steps,step_1:{...run.steps.step_1,output:{data:{id:'other-message'}}}}};
    else if(url.endsWith(`/webhooks/${flowId}`))data={ok:true};
    else throw new Error('unexpected URL: '+url);
    return {ok:true,status:200,json:async()=>data};
  };
  const runner=createGmailPilotRunner({requireProject:async()=>otherCompany?'Q'.repeat(21):projectId,fetchImpl,activepiecesUrl:'https://ap.example',apiKey:'test-api-key',flowId,connectionId,secret,sleep:async()=>{}});
  return {runner,calls};
}
test('one exact signed dispatch returns only Gmail provider message id',async()=>{
  assert.equal(GMAIL_PILOT_COMMAND,'Send a test email to my inbox');
  const {runner,calls}=harness();let dispatches=0;
  const prepared=await runner.preflight({companyId});
  assert.deepEqual(await runner.send({companyId,prepared,onDispatch:()=>{dispatches++;}}),{runId,messageId:'gmail-message-1',threadId:null,status:'accepted_by_google'});
  assert.equal(dispatches,1);
  const webhooks=calls.filter(call=>call.url.includes('/webhooks/'));
  assert.equal(webhooks.length,1);
  assert.equal(webhooks[0].options.body,'{"requestId":"gmail_send_review_demo_v2","task":"gmail_send_review_demo_v2"}');
  assert.equal(webhooks[0].options.headers['x-siyadah-signature'],createHmac('sha256',secret).update(webhooks[0].options.body).digest('hex'));
  await assert.rejects(()=>runner.send({companyId,prepared,onDispatch:()=>{dispatches++;}}),{code:'pilot_preflight_required'});
  assert.equal(dispatches,1);
});
test('wrong tenant or project cannot read provider or dispatch',async()=>{
  const h=harness();await assert.rejects(()=>h.runner.preflight({companyId:'company_other'}),{name:'GmailPilotError'});assert.equal(h.calls.length,0);
  const wrong=harness({otherCompany:true});await assert.rejects(()=>wrong.runner.preflight({companyId}),{name:'GmailPilotError'});assert.equal(wrong.calls.length,0);
});
test('draft pilot flow is rejected before webhook dispatch',async()=>{
  const {runner,calls}=harness({draft:true});
  await assert.rejects(()=>runner.preflight({companyId}),{code:'pilot_flow_not_published'});
  assert.equal(calls.some(call=>call.url.includes('/webhooks/')),false);
});
test('webhook 200 without provider run is unknown and never retries',async()=>{
  const {runner,calls}=harness({withRun:false});
  const prepared=await runner.preflight({companyId});
  await assert.rejects(()=>runner.send({companyId,prepared,onDispatch:()=>{}}),{code:'pilot_run_not_observed'});
  assert.equal(calls.filter(call=>call.url.includes('/webhooks/')).length,1);
});
test('delayed run logs are polled without a second webhook dispatch',async()=>{
  const {runner,calls}=harness({logsDelayed:true}),prepared=await runner.preflight({companyId});
  assert.equal((await runner.send({companyId,prepared,onDispatch:()=>{}})).messageId,'gmail-message-1');
  assert.equal(calls.filter(call=>call.url.includes('/webhooks/')).length,1);
  assert.equal(calls.filter(call=>call.url.endsWith(`/flow-runs/${runId}`)).length,2);
});
test('unknown pilot recovers a scoped Gmail receipt read-only while flow is disabled',async()=>{
  const {runner,calls}=harness({draft:true});
  const receipt=await runner.recover({companyId,notBefore:new Date(Date.now()-5000)});
  assert.equal(receipt.messageId,'gmail-message-1');
  assert.equal(calls.some(call=>call.url.includes('/webhooks/')),false);
  assert.equal(calls.some(call=>call.url.includes('/flows/')),false);
  await assert.rejects(()=>runner.recover({companyId:'company_other',notBefore:new Date()}),{code:'pilot_recovery_scope_mismatch'});
});
test('readback refuses two verified runs for the same fixed pilot request',async()=>{
  const {runner,calls}=harness({duplicateRun:true});
  await assert.rejects(()=>runner.recover({companyId,notBefore:new Date(Date.now()-5000)}),{code:'pilot_recovery_ambiguous'});
  assert.equal(calls.some(call=>call.url.includes('/webhooks/')),false);
});
