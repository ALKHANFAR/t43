import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {GMAIL_PILOT_REQUEST_ID,signedGmailPilotWebhook,validateGmailPilotFlow,verifyGmailPilotRun} from '../lib/gmail-send-pilot.mjs';

const projectId='IgVzWxZU2AsDQMo6ZCugr',flowId='F'.repeat(21),connectionId='q1jirYwoeM1gDH3wtkksz',runId='R'.repeat(21),companyId='company_Vo6C04LfL8-hsuPAF_0y9f0N';
const expected={to:'owner@example.com',from:'sender@example.com',subject:'اختبار سيادة',body:'رسالة اختبار واحدة.'};
function fixture(){
  const employee={company_id:companyId,activepieces_flow_id:flowId,status:'active'};
  const connection={id:connectionId,externalId:`siyadah-${companyId}-gmail`,scope:'PROJECT',projectIds:[projectId],status:'ACTIVE',pieceName:'@activepieces/piece-gmail'};
  const flow={id:flowId,projectId,status:'ENABLED',publishedVersionId:'version-1',version:{id:'version-1',state:'LOCKED',connectionIds:[connection.externalId],trigger:{type:'PIECE_TRIGGER',settings:{pieceName:'@activepieces/piece-webhook',triggerName:'catch_webhook',input:{authType:'hmac',authFields:{hmacHeaderName:'x-siyadah-signature',hmacAlgorithm:'sha256',hmacEncoding:'hex'}}},nextAction:{name:'send_email_1',type:'PIECE',settings:{pieceName:'@activepieces/piece-gmail',actionName:'send_email',errorHandlingOptions:{retryOnFailure:{value:false},continueOnFailure:{value:false}},input:{auth:`{{connections['siyadah-${companyId}-gmail']}}`,receiver:[expected.to],subject:expected.subject,body_type:'plain_text',body:expected.body,from:expected.from,draft:false,retry:false}}}}}};
  return {companyId,allowedCompanyId:companyId,employee:null,projectId,flow,connection,expected,expectedFlowId:flowId,expectedConnectionId:connectionId};
}

test('pilot gate accepts only the exact company published single-send flow and exclusive connection',()=>{
  const input=fixture();assert.equal(GMAIL_PILOT_REQUEST_ID,'gmail_send_pilot_v1');
  assert.deepEqual(validateGmailPilotFlow(input),{actionName:'send_email_1',flowId,projectId,connectionId});
  for(const change of [
    x=>{x.allowedCompanyId='company_other';},
    x=>{x.employee={company_id:'company_other',activepieces_flow_id:flowId,status:'active'};},
    x=>{x.flow.projectId='Q'.repeat(21);},
    x=>{x.flow.publishedVersionId='other-version';},
    x=>{x.flow.version.connectionIds=[x.connection.externalId,'other'];},
    x=>{x.connection.projectIds=[projectId,'Q'.repeat(21)];},
    x=>{x.flow.version.trigger.nextAction.nextAction={name:'extra'};},
    x=>{x.flow.version.trigger.nextAction.settings.errorHandlingOptions.retryOnFailure.value=true;},
    x=>{x.flow.version.trigger.nextAction.settings.errorHandlingOptions.continueOnFailure.value=true;},
    x=>{x.flow.version.trigger.settings.input.authType='none';},
    x=>{x.flow.version.trigger.settings.input.authFields.hmacSignaturePrefix='sha256=';},
    x=>{delete x.flow.version.trigger.nextAction.settings.input.auth;},
    x=>{x.flow.version.trigger.nextAction.settings.input.receiver=['other@example.com'];},
    x=>{x.flow.version.trigger.nextAction.settings.input.in_reply_to='old-message';},
    x=>{x.flow.version.trigger.nextAction.settings.input.draft='false';},
    x=>{delete x.flow.version.trigger.nextAction.settings.input.draft;},
  ]){const unsafe=fixture();change(unsafe);assert.throws(()=>validateGmailPilotFlow(unsafe),{name:'GmailPilotError'});}
});

test('provider receipt needs scoped successful run and Gmail message id',()=>{
  const run={id:runId,flowId,projectId,status:'SUCCEEDED',steps:{trigger:{output:{body:{requestId:GMAIL_PILOT_REQUEST_ID}}},send_email_1:{output:{status:200,data:{id:'18af123',threadId:'18af123'}}}}};
  const input={run,projectId,flowId,requestId:GMAIL_PILOT_REQUEST_ID,actionName:'send_email_1'};
  assert.deepEqual(verifyGmailPilotRun(input),{runId,messageId:'18af123',threadId:'18af123',status:'accepted_by_google'});
  for(const change of [x=>{x.run.projectId='Q'.repeat(21);},x=>{x.run.steps.trigger.output.body.requestId='other';},x=>{x.run.status='FAILED';},x=>{delete x.run.steps.send_email_1.output.data.id;},x=>{x.run.steps.send_email_1.output.status=400;},x=>{delete x.run.steps.send_email_1;}]){
    const unsafe=structuredClone(input);change(unsafe);assert.throws(()=>verifyGmailPilotRun(unsafe),{name:'GmailPilotError'});
  }
});

test('webhook signature hashes the exact bytes sent and disables alternate request identity',()=>{
  const secret='s'.repeat(40),request=signedGmailPilotWebhook({requestId:GMAIL_PILOT_REQUEST_ID,secret});
  assert.equal(request.headers['x-siyadah-signature'],createHmac('sha256',secret).update(Buffer.from(request.body,'utf8')).digest('hex'));
  assert.notEqual(request.headers['x-siyadah-signature'],createHmac('sha256',secret).update(Buffer.from(request.body+' ','utf8')).digest('hex'));
  assert.throws(()=>signedGmailPilotWebhook({requestId:'new_attempt',secret}),{name:'GmailPilotError'});
  assert.throws(()=>signedGmailPilotWebhook({requestId:GMAIL_PILOT_REQUEST_ID,secret:'short'}),{name:'GmailPilotError'});
});
