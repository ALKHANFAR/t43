import {createHash} from 'node:crypto';
import {GMAIL_PILOT_COMPANY_ID,GMAIL_PILOT_PROJECT_ID,GMAIL_PILOT_FLOW_ID,GMAIL_PILOT_CONNECTION_ID,GMAIL_PILOT_REQUEST_ID,GmailPilotError,signedGmailPilotWebhook,validateGmailPilotFlow,verifyGmailPilotRun} from './gmail-send-pilot.mjs';

const AP_ID=/^[A-Za-z0-9]{21}$/;
const EXPECTED={to:'a@sondos-ai.com',from:'a@sondos-ai.com',subject:'SIY-ABO61-PILOT-20261002',body:'اختبار إرسال سيادة من الشات للشركة 43'};
export const GMAIL_PILOT_COMMAND='أرسل رسالة اختبار إلى بريدي';
export function gmailPilotLedgerIdentity(){return {conversationId:'chat_gmail_send_pilot_v1',requestId:GMAIL_PILOT_REQUEST_ID,requestHash:createHash('sha256').update(GMAIL_PILOT_COMMAND).digest('hex')};}
export function gmailPilotSuccessResponse({conversationId,receipt}){
  return {ok:true,conversation_id:conversationId,request_status:'succeeded',work_status:'succeeded',outcome_kind:'external_run',work_id:`work_${receipt.runId}`,reply:`قبلت Google رسالة الاختبار للإرسال. معرّف الرسالة: ${receipt.messageId}`,provider_message_id:receipt.messageId,run_id:receipt.runId};
}
export async function recordGmailPilotConversation({profiles,companyId,response}){
  const {conversationId,requestId}=gmailPilotLedgerIdentity();
  if(companyId!==GMAIL_PILOT_COMPANY_ID||response?.conversation_id!==conversationId||response.request_status!=='succeeded'||response.outcome_kind!=='external_run'||!AP_ID.test(String(response.run_id||''))||!response.provider_message_id||typeof response.reply!=='string')throw new GmailPilotError('pilot_conversation_unverified');
  await profiles.recordConversation({companyId,conversationId,employeeId:null,requestId,userMessage:GMAIL_PILOT_COMMAND,assistantMessage:response.reply});
}

export function createGmailPilotRunner({requireProject,fetchImpl=fetch,activepiecesUrl,apiKey,flowId,connectionId,secret,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
  const base=String(activepiecesUrl||'').replace(/\/$/,'');
  let preparedResult=null;
  async function provider(path){
    if(!base||!apiKey)throw new GmailPilotError('pilot_provider_not_configured');
    const response=await fetchImpl(base+path,{headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'}});
    if(!response.ok)throw new GmailPilotError('pilot_provider_read_failed');
    return response.json();
  }
  async function preflight({companyId}){
    if(companyId!==GMAIL_PILOT_COMPANY_ID)throw new GmailPilotError('pilot_company_forbidden');
    if(!AP_ID.test(String(flowId||''))||!AP_ID.test(String(connectionId||''))||typeof secret!=='string'||secret.length<32)throw new GmailPilotError('pilot_not_configured');
    const projectId=await requireProject(companyId);
    if(projectId!==GMAIL_PILOT_PROJECT_ID)throw new GmailPilotError('pilot_project_mismatch');
    const [flowMeta,connection]=await Promise.all([
      provider(`/api/v1/flows/${flowId}`),
      provider(`/api/v1/app-connections/${connectionId}?projectId=${encodeURIComponent(projectId)}`),
    ]);
    if(flowMeta?.projectId!==projectId||flowMeta.status!=='ENABLED'||!AP_ID.test(String(flowMeta.publishedVersionId||'')))throw new GmailPilotError('pilot_flow_not_published');
    const flow=await provider(`/api/v1/flows/${flowId}?versionId=${encodeURIComponent(flowMeta.publishedVersionId)}`);
    if(flow?.publishedVersionId!==flowMeta.publishedVersionId)throw new GmailPilotError('pilot_flow_version_mismatch');
    const gate=validateGmailPilotFlow({companyId,allowedCompanyId:GMAIL_PILOT_COMPANY_ID,projectId,flow,connection,expected:EXPECTED,expectedFlowId:flowId,expectedConnectionId:connectionId});
    preparedResult={companyId,projectId,gate};
    return preparedResult;
  }
  async function send({companyId,prepared,onDispatch}){
    if(!prepared||prepared!==preparedResult||prepared.companyId!==companyId)throw new GmailPilotError('pilot_preflight_required');
    preparedResult=null;
    const {projectId,gate}=prepared;
    const signed=signedGmailPilotWebhook({requestId:GMAIL_PILOT_REQUEST_ID,secret});
    const started=Date.now();
    await onDispatch();
    const response=await fetchImpl(`${base}/api/v1/webhooks/${flowId}`,{method:'POST',headers:signed.headers,body:signed.body});
    if(!response.ok)throw new GmailPilotError('pilot_webhook_failed');
    for(let attempt=0;attempt<16;attempt++){
      if(attempt)await sleep(500);
      const listed=await provider(`/api/v1/flow-runs?projectId=${encodeURIComponent(projectId)}&flowId=${encodeURIComponent(flowId)}&limit=10`);
      for(const candidate of listed?.data||[]){
        if(candidate?.flowId!==flowId||candidate.projectId!==projectId||new Date(candidate.created).getTime()<started-2000)continue;
        const run=await provider(`/api/v1/flow-runs/${candidate.id}`);
        if(run?.projectId!==projectId||run.flowId!==flowId||run.id!==candidate.id)throw new GmailPilotError('pilot_run_scope_mismatch');
        if(!run.steps?.trigger?.output?.body||!run.steps?.[gate.actionName]?.output)continue;
        if(run.steps?.trigger?.output?.body?.requestId!==GMAIL_PILOT_REQUEST_ID)continue;
        if(run.status==='SUCCEEDED')return verifyGmailPilotRun({run,projectId,flowId,requestId:GMAIL_PILOT_REQUEST_ID,actionName:gate.actionName});
        if(['FAILED','TIMEOUT','CANCELED','CANCELLED','INTERNAL_ERROR','QUOTA_EXCEEDED'].includes(run.status))throw new GmailPilotError('pilot_run_failed');
      }
    }
    throw new GmailPilotError('pilot_run_not_observed');
  }
  async function recover({companyId,notBefore}){
    if(companyId!==GMAIL_PILOT_COMPANY_ID||flowId!==GMAIL_PILOT_FLOW_ID||connectionId!==GMAIL_PILOT_CONNECTION_ID)throw new GmailPilotError('pilot_recovery_scope_mismatch');
    const projectId=await requireProject(companyId);
    if(projectId!==GMAIL_PILOT_PROJECT_ID)throw new GmailPilotError('pilot_project_mismatch');
    const since=new Date(notBefore).getTime();
    if(notBefore==null||!Number.isFinite(since))throw new GmailPilotError('pilot_recovery_time_invalid');
    const listed=await provider(`/api/v1/flow-runs?projectId=${encodeURIComponent(projectId)}&flowId=${encodeURIComponent(flowId)}&limit=100`);
    const verified=new Map();
    for(const candidate of listed?.data||[]){
      if(candidate?.flowId!==flowId||candidate.projectId!==projectId||new Date(candidate.created).getTime()<since-2000)continue;
      const run=await provider(`/api/v1/flow-runs/${candidate.id}`);
      if(run?.id!==candidate.id||run.projectId!==projectId||run.flowId!==flowId)continue;
      if(run.steps?.trigger?.output?.body?.requestId!==GMAIL_PILOT_REQUEST_ID||run.status!=='SUCCEEDED')continue;
      try{verified.set(run.id,verifyGmailPilotRun({run,projectId,flowId,requestId:GMAIL_PILOT_REQUEST_ID,actionName:'step_1'}));}
      catch(error){if(!(error instanceof GmailPilotError))throw error;}
    }
    if(verified.size>1)throw new GmailPilotError('pilot_recovery_ambiguous');
    return verified.values().next().value||null;
  }
  return {preflight,send,recover};
}
