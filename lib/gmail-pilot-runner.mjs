import {createHash} from 'node:crypto';
import {GMAIL_PILOT_COMPANY_ID,GMAIL_PILOT_PROJECT_ID,GMAIL_PILOT_REQUEST_ID,GmailPilotError,signedGmailPilotWebhook,validateGmailPilotFlow,verifyGmailPilotRun} from './gmail-send-pilot.mjs';

const AP_ID=/^[A-Za-z0-9]{21}$/;
const EXPECTED={to:'a@sondos-ai.com',from:'a@sondos-ai.com',subject:'SIY-ABO61-PILOT-20261002',body:'اختبار إرسال سيادة من الشات للشركة 43'};
export const GMAIL_PILOT_COMMAND='أرسل رسالة اختبار إلى بريدي';
export function gmailPilotLedgerIdentity(){return {conversationId:'chat_gmail_send_pilot_v1',requestId:GMAIL_PILOT_REQUEST_ID,requestHash:createHash('sha256').update(GMAIL_PILOT_COMMAND).digest('hex')};}

export function createGmailPilotRunner({requireProject,fetchImpl=fetch,activepiecesUrl,apiKey,flowId,connectionId,secret,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
  const base=String(activepiecesUrl||'').replace(/\/$/,'');
  async function provider(path){
    if(!base||!apiKey)throw new GmailPilotError('pilot_provider_not_configured');
    const response=await fetchImpl(base+path,{headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'}});
    if(!response.ok)throw new GmailPilotError('pilot_provider_read_failed');
    return response.json();
  }
  async function send({companyId,onDispatch}){
    if(companyId!==GMAIL_PILOT_COMPANY_ID)throw new GmailPilotError('pilot_company_forbidden');
    if(!AP_ID.test(String(flowId||''))||!AP_ID.test(String(connectionId||''))||typeof secret!=='string'||secret.length<32)throw new GmailPilotError('pilot_not_configured');
    const projectId=await requireProject(companyId);
    if(projectId!==GMAIL_PILOT_PROJECT_ID)throw new GmailPilotError('pilot_project_mismatch');
    const [flow,connection]=await Promise.all([
      provider(`/api/v1/flows/${flowId}`),
      provider(`/api/v1/app-connections/${connectionId}?projectId=${encodeURIComponent(projectId)}`),
    ]);
    const gate=validateGmailPilotFlow({companyId,allowedCompanyId:GMAIL_PILOT_COMPANY_ID,projectId,flow,connection,expected:EXPECTED,expectedFlowId:flowId,expectedConnectionId:connectionId});
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
        if(run.steps?.trigger?.output?.body?.requestId!==GMAIL_PILOT_REQUEST_ID)continue;
        if(run.status==='SUCCEEDED')return verifyGmailPilotRun({run,projectId,flowId,requestId:GMAIL_PILOT_REQUEST_ID,actionName:gate.actionName});
        if(['FAILED','TIMEOUT','CANCELED','CANCELLED','INTERNAL_ERROR','QUOTA_EXCEEDED'].includes(run.status))throw new GmailPilotError('pilot_run_failed');
      }
    }
    throw new GmailPilotError('pilot_run_not_observed');
  }
  return {send};
}
