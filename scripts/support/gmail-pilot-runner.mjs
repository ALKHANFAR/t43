// Historical test-only recovery helper. Never imported by production.
import {createHash} from 'node:crypto';
import {GMAIL_PILOT_COMPANY_ID,GMAIL_PILOT_PROJECT_ID,GMAIL_PILOT_FLOW_ID,GMAIL_PILOT_CONNECTION_ID,GMAIL_PILOT_REQUEST_ID,GmailPilotError,verifyGmailPilotRun} from './gmail-send-pilot.mjs';

const AP_ID=/^[A-Za-z0-9]{21}$/;
export const GMAIL_PILOT_COMMAND='Send a test email to my inbox';
export function gmailPilotLedgerIdentity(){return {conversationId:'chat_gmail_send_review_demo_v2',requestId:GMAIL_PILOT_REQUEST_ID,requestHash:createHash('sha256').update(GMAIL_PILOT_COMMAND).digest('hex')};}
export function gmailPilotSuccessResponse({conversationId,receipt}){
  return {ok:true,conversation_id:conversationId,request_status:'succeeded',work_status:'succeeded',outcome_kind:'external_run',work_id:`work_${receipt.runId}`,reply:`Google accepted the test email for sending. Message ID: ${receipt.messageId}`,provider_message_id:receipt.messageId,run_id:receipt.runId};
}
export async function recordGmailPilotConversation({profiles,companyId,response}){
  const {conversationId,requestId}=gmailPilotLedgerIdentity();
  if(companyId!==GMAIL_PILOT_COMPANY_ID||response?.conversation_id!==conversationId||response.request_status!=='succeeded'||response.outcome_kind!=='external_run'||!AP_ID.test(String(response.run_id||''))||!response.provider_message_id||typeof response.reply!=='string')throw new GmailPilotError('pilot_conversation_unverified');
  await profiles.recordConversation({companyId,conversationId,employeeId:null,requestId,userMessage:GMAIL_PILOT_COMMAND,assistantMessage:response.reply});
}

export function createGmailPilotRunner({requireProject,fetchImpl=fetch,activepiecesUrl,apiKey,flowId,connectionId}){
  const base=String(activepiecesUrl||'').replace(/\/$/,'');
  async function provider(path){
    if(!base||!apiKey)throw new GmailPilotError('pilot_provider_not_configured');
    const response=await fetchImpl(base+path,{headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'}});
    if(!response.ok)throw new GmailPilotError('pilot_provider_read_failed');
    return response.json();
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
  return {recover};
}
