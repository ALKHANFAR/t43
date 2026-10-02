import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createGmailPilotRunner,GMAIL_PILOT_COMMAND} from '../lib/gmail-pilot-runner.mjs';

const companyId='company_Vo6C04LfL8-hsuPAF_0y9f0N',projectId='IgVzWxZU2AsDQMo6ZCugr',flowId='F'.repeat(21),connectionId='q1jirYwoeM1gDH3wtkksz',runId='R'.repeat(21),secret='s'.repeat(40);
const externalId=`siyadah-${companyId}-gmail`;
const connection={id:connectionId,externalId,scope:'PROJECT',projectIds:[projectId],status:'ACTIVE',pieceName:'@activepieces/piece-gmail'};
const flow={id:flowId,projectId,status:'ENABLED',publishedVersionId:'v1',version:{id:'v1',state:'LOCKED',connectionIds:[externalId],trigger:{type:'PIECE_TRIGGER',settings:{pieceName:'@activepieces/piece-webhook',triggerName:'catch_webhook',input:{authType:'hmac',authFields:{hmacHeaderName:'x-siyadah-signature',hmacAlgorithm:'sha256',hmacEncoding:'hex'}}},nextAction:{name:'step_1',type:'PIECE',settings:{pieceName:'@activepieces/piece-gmail',actionName:'send_email',errorHandlingOptions:{retryOnFailure:{value:false},continueOnFailure:{value:false}},input:{auth:`{{connections['${externalId}']}}`,receiver:['a@sondos-ai.com'],from:'a@sondos-ai.com',subject:'SIY-ABO61-PILOT-20261002',body_type:'plain_text',body:'اختبار إرسال سيادة من الشات للشركة 43',draft:false,retry:false}}}}}};
const run={id:runId,projectId,flowId,status:'SUCCEEDED',steps:{trigger:{output:{body:{requestId:'gmail_send_pilot_v1'}}},step_1:{output:{status:200,data:{id:'gmail-message-1'}}}}};
function harness({withRun=true,otherCompany=false,draft=false}={}){
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    let data;
    if(url.endsWith(`/flows/${flowId}`))data=draft?{...flow,status:'DISABLED',publishedVersionId:null}:flow;
    else if(url.includes(`/app-connections/${connectionId}`))data=connection;
    else if(url.includes('/flow-runs?'))data={data:withRun?[{id:runId,flowId,projectId,created:new Date().toISOString()}]:[]};
    else if(url.endsWith(`/flow-runs/${runId}`))data=run;
    else if(url.endsWith(`/webhooks/${flowId}`))data={ok:true};
    else throw new Error('unexpected URL: '+url);
    return {ok:true,status:200,json:async()=>data};
  };
  const runner=createGmailPilotRunner({requireProject:async()=>otherCompany?'Q'.repeat(21):projectId,fetchImpl,activepiecesUrl:'https://ap.example',apiKey:'test-api-key',flowId,connectionId,secret,sleep:async()=>{}});
  return {runner,calls};
}
test('one exact signed dispatch returns only Gmail provider message id',async()=>{
  assert.equal(GMAIL_PILOT_COMMAND,'أرسل رسالة اختبار إلى بريدي');
  const {runner,calls}=harness();let dispatches=0;
  assert.deepEqual(await runner.send({companyId,onDispatch:()=>{dispatches++;}}),{runId,messageId:'gmail-message-1',threadId:null,status:'accepted_by_google'});
  assert.equal(dispatches,1);
  const webhooks=calls.filter(call=>call.url.includes('/webhooks/'));
  assert.equal(webhooks.length,1);
  assert.equal(webhooks[0].options.body,'{"requestId":"gmail_send_pilot_v1","task":"gmail_send_pilot_v1"}');
  assert.equal(webhooks[0].options.headers['x-siyadah-signature'],createHmac('sha256',secret).update(webhooks[0].options.body).digest('hex'));
});
test('wrong tenant or project cannot read provider or dispatch',async()=>{
  const h=harness();await assert.rejects(()=>h.runner.send({companyId:'company_other',onDispatch:()=>{}}),{name:'GmailPilotError'});assert.equal(h.calls.length,0);
  const wrong=harness({otherCompany:true});await assert.rejects(()=>wrong.runner.send({companyId,onDispatch:()=>{}}),{name:'GmailPilotError'});assert.equal(wrong.calls.length,0);
});
test('draft pilot flow is rejected before webhook dispatch',async()=>{
  const {runner,calls}=harness({draft:true});
  await assert.rejects(()=>runner.send({companyId,onDispatch:()=>{throw new Error('should not dispatch');}}),{code:'pilot_flow_not_published'});
  assert.equal(calls.some(call=>call.url.includes('/webhooks/')),false);
});
test('webhook 200 without provider run is unknown and never retries',async()=>{
  const {runner,calls}=harness({withRun:false});
  await assert.rejects(()=>runner.send({companyId,onDispatch:()=>{}}),{code:'pilot_run_not_observed'});
  assert.equal(calls.filter(call=>call.url.includes('/webhooks/')).length,1);
});
