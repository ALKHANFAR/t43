// A read-only gate for one explicitly configured Gmail send flow. No webhook is
// dispatched from this module; callers must pass this gate before dispatch.
import {createHmac} from 'node:crypto';
const AP_ID=/^[A-Za-z0-9]{21}$/;
const MESSAGE_ID=/^[A-Za-z0-9_-]{1,256}$/;
export const GMAIL_PILOT_REQUEST_ID='gmail_send_review_demo_v2';
export const GMAIL_PILOT_COMPANY_ID='company_Vo6C04LfL8-hsuPAF_0y9f0N';
export const GMAIL_PILOT_PROJECT_ID='IgVzWxZU2AsDQMo6ZCugr';
export const GMAIL_PILOT_FLOW_ID='xoYfYSvwoNH3JGOpQdqpM';
export const GMAIL_PILOT_CONNECTION_ID='q1jirYwoeM1gDH3wtkksz';

export class GmailPilotError extends Error{
  constructor(code){super('تجربة إرسال البريد غير جاهزة أو لم تثبت نتيجتها.');this.name='GmailPilotError';this.code=code;this.status=409;}
}
function deny(code){throw new GmailPilotError(code);}
function sameArray(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>value===b[index]);}

export function validateGmailPilotFlow({companyId,allowedCompanyId,employee,projectId,flow,connection,expected,expectedFlowId,expectedConnectionId}){
  if(companyId!==GMAIL_PILOT_COMPANY_ID||allowedCompanyId!==GMAIL_PILOT_COMPANY_ID||projectId!==GMAIL_PILOT_PROJECT_ID)deny('pilot_company_forbidden');
  if(!AP_ID.test(String(projectId||''))||!AP_ID.test(String(flow?.id||''))||!AP_ID.test(String(connection?.id||'')))deny('pilot_mapping_invalid');
  if(flow.id!==expectedFlowId||connection.id!==expectedConnectionId)deny('pilot_mapping_invalid');
  if(employee&&(employee.company_id!==companyId||employee.activepieces_flow_id!==flow.id||employee.status!=='active'))deny('pilot_employee_not_ready');
  if(flow.projectId!==projectId||flow.status!=='ENABLED'||flow.publishedVersionId!==flow.version?.id||flow.version?.state!=='LOCKED')deny('pilot_flow_not_published');
  if(connection.scope!=='PROJECT'||!sameArray(connection.projectIds,[projectId])||connection.status!=='ACTIVE'||connection.pieceName!=='@activepieces/piece-gmail'||connection.externalId!==`siyadah-${companyId}-gmail`)deny('pilot_connection_not_owned');
  if(!sameArray(flow.version.connectionIds,[connection.externalId]))deny('pilot_connection_mismatch');
  const trigger=flow.version.trigger,action=trigger?.nextAction,input=action?.settings?.input;
  const webhook=trigger?.settings?.input;
  if(trigger?.type!=='PIECE_TRIGGER'||trigger.settings?.pieceName!=='@activepieces/piece-webhook'||trigger.settings?.triggerName!=='catch_webhook'||webhook?.authType!=='hmac'||webhook.authFields?.hmacHeaderName?.toLowerCase()!=='x-siyadah-signature'||webhook.authFields?.hmacAlgorithm!=='sha256'||webhook.authFields?.hmacEncoding!=='hex'||webhook.authFields?.hmacSignaturePrefix||action?.type!=='PIECE'||action.settings?.pieceName!=='@activepieces/piece-gmail'||action.settings?.actionName!=='send_email'||action.nextAction)deny('pilot_flow_shape_invalid');
  if(action.settings?.errorHandlingOptions?.retryOnFailure?.value!==false||action.settings?.errorHandlingOptions?.continueOnFailure?.value!==false)deny('pilot_flow_retry_unsafe');
  if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(String(action.name||'')))deny('pilot_action_name_invalid');
  if(!expected?.to||!expected?.from||!expected?.subject||!expected?.body)deny('pilot_message_not_configured');
  if(!sameArray(input?.receiver,[expected.to])||input.subject!==expected.subject||input.body_type!=='plain_text'||input.body!==expected.body||input.from!==expected.from||input.draft!==false||input.in_reply_to||input.cc?.length||input.bcc?.length||input.attachments?.length)deny('pilot_message_mismatch');
  if(input.auth!==`{{connections['${connection.externalId}']}}`)deny('pilot_connection_mismatch');
  return {actionName:action.name,flowId:flow.id,projectId,connectionId:connection.id};
}

export function signedGmailPilotWebhook({requestId,secret}){
  if(requestId!==GMAIL_PILOT_REQUEST_ID||typeof secret!=='string'||secret.length<32)deny('pilot_webhook_not_configured');
  const body=JSON.stringify({requestId,task:GMAIL_PILOT_REQUEST_ID});
  const signature=createHmac('sha256',secret).update(Buffer.from(body,'utf8')).digest('hex');
  return {body,headers:{'content-type':'application/json','x-siyadah-signature':signature}};
}

export function verifyGmailPilotRun({run,projectId,flowId,requestId,actionName}){
  if(run?.projectId!==projectId||run.flowId!==flowId||!AP_ID.test(String(run.id||'')))deny('pilot_run_scope_mismatch');
  if(run.steps?.trigger?.output?.body?.requestId!==requestId||run.status!=='SUCCEEDED')deny('pilot_run_unverified');
  const step=run.steps?.[actionName],output=step?.output,status=output?.status,messageId=output?.data?.id;
  if(step?.error||step?.status!=='SUCCEEDED'||(status!==undefined&&(!Number.isInteger(status)||status<200||status>=300))||!MESSAGE_ID.test(String(messageId||'')))deny('pilot_message_unverified');
  return {runId:run.id,messageId,threadId:MESSAGE_ID.test(String(output.data.threadId||''))?output.data.threadId:null,status:'accepted_by_google'};
}
