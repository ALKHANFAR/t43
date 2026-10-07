import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyProfileService,CompanyProfileError} from '../lib/company-profile.mjs';
import {gmailPilotLedgerIdentity} from './support/gmail-pilot-runner.mjs';

function fixture(){
  const rows=new Map(),calls=[];
  const query=async(sql,values=[])=>{
    calls.push({sql,values});
    const key=`${values[0]}:${values[1]}`;
    if(sql.startsWith('INSERT INTO siyadah_chat_requests')){
      if(rows.has(key))return {rows:[]};
      rows.set(key,{conversation_id:values[2],request_hash:values[3],claim_token:values[4],status:'pending',created_at:new Date()});
      return {rows:[{request_id:values[1]}]};
    }
    if(sql.startsWith('SELECT conversation_id,request_hash'))return {rows:rows.has(key)?[rows.get(key)]:[]};
    if(sql.includes("SET status='unknown'")){
      const row=rows.get(key);
      if(row?.status==='pending'&&Date.now()-new Date(row.created_at).getTime()>120_000){
        Object.assign(row,{status:'unknown',http_status:200,response_json:{ok:true,conversation_id:row.conversation_id,request_status:'not_observed',work_status:'unknown',work_id:`request_${values[1]}`,reply:'لم نؤكد نتيجة الطلب بعد. لم نعد تنفيذه.'}});
      }
      return {rows:[]};
    }
    if(sql.includes("SET status='succeeded'")){
      const row=rows.get(key);
      if(sql.includes('request_hash=$4')){
        if(!row||row.status!=='unknown'||row.conversation_id!==values[2]||row.request_hash!==values[3])return {rows:[]};
        Object.assign(row,{status:'succeeded',http_status:200,response_json:JSON.parse(values[4])});
        return {rows:[{request_id:values[1]}]};
      }
      if(!row||row.status!=='unknown'||row.claim_token!==values[4])return {rows:[]};
      Object.assign(row,{status:'succeeded',http_status:values[2],response_json:JSON.parse(values[3])});
      return {rows:[{request_id:values[1]}]};
    }
    if(sql.startsWith('UPDATE siyadah_chat_requests')){
      const row=rows.get(key);
      if(!row||row.status!=='pending')return {rows:[]};
      Object.assign(row,{status:values[2],http_status:values[3],response_json:JSON.parse(values[4])});
      return {rows:[{request_id:values[1]}]};
    }
    throw new Error(`unexpected SQL: ${sql}`);
  };
  return {service:createCompanyProfileService({query}),calls,rows};
}

test('same request is claimed once and result is read back only within its company',async()=>{
  const {service,calls}=fixture(),input={companyId:'company_a',conversationId:'chat_a',requestId:'req_1',requestHash:'a'.repeat(64)};
  assert.equal((await service.claimChatRequest(input)).claimed,true);
  assert.equal((await service.claimChatRequest(input)).claimed,false);
  await service.completeChatRequest({companyId:'company_a',requestId:'req_1',status:'succeeded',httpStatus:200,response:{ok:true,reply:'saved'}});
  assert.equal((await service.claimChatRequest(input)).response.reply,'saved');
  assert.equal(await service.readChatRequest({companyId:'company_b',requestId:'req_1'}),null);
  assert.equal((await service.claimChatRequest({...input,companyId:'company_b'})).claimed,true);
  assert.ok(calls.every(call=>call.values[0]==='company_a'||call.values[0]==='company_b'));
  assert.ok(calls.every(call=>/company_id=\$1|\(company_id,request_id,conversation_id,request_hash,claim_token\)/.test(call.sql)));
});

test('Gmail pilot shares one ledger key across two chat conversations',async()=>{
  const {service}=fixture(),identity=gmailPilotLedgerIdentity();
  const first=await service.claimChatRequest({companyId:'company_43',...identity});
  assert.equal(first.claimed,true);
  const second=await service.claimChatRequest({companyId:'company_43',...gmailPilotLedgerIdentity()});
  assert.equal(second.claimed,false);
  await service.completeChatRequest({companyId:'company_43',requestId:identity.requestId,status:'unknown',httpStatus:200,response:{work_status:'unknown'}});
  assert.equal((await service.claimChatRequest({companyId:'company_43',...gmailPilotLedgerIdentity()})).status,'unknown');
});

test('verified readback upgrades only the matching unknown pilot request',async()=>{
  const {service}=fixture(),identity=gmailPilotLedgerIdentity(),companyId='company_43';
  await service.claimChatRequest({companyId,...identity});
  await service.completeChatRequest({companyId,requestId:identity.requestId,status:'unknown',httpStatus:200,response:{work_status:'unknown'}});
  const response={request_status:'succeeded',outcome_kind:'external_run',run_id:'IM2FOjaApVRHWWqAf8iO2',provider_message_id:'1a0fc1b96c6e6f55'};
  const input={companyId,...identity,response};
  assert.equal((await service.reconcileVerifiedChatRequest(input)).status,'succeeded');
  assert.equal((await service.reconcileVerifiedChatRequest(input)).response.provider_message_id,response.provider_message_id);
  await assert.rejects(service.reconcileVerifiedChatRequest({...input,companyId:'company_other'}),{code:'request_scope_mismatch'});
  await assert.rejects(service.reconcileVerifiedChatRequest({...input,response:{...response,provider_message_id:null}}),TypeError);
  const failed={...identity,requestId:'failed_pilot'};
  await service.claimChatRequest({companyId,...failed});
  await service.completeChatRequest({companyId,requestId:failed.requestId,status:'failed',httpStatus:200,response:{work_status:'failed'}});
  assert.equal((await service.reconcileVerifiedChatRequest({companyId,...failed,response})).status,'failed');
});

test('request ID cannot be reused for another conversation or payload',async()=>{
  const {service}=fixture(),input={companyId:'company_a',conversationId:'chat_a',requestId:'req_1',requestHash:'a'.repeat(64)};
  await service.claimChatRequest(input);
  await assert.rejects(service.claimChatRequest({...input,conversationId:'chat_b'}),{code:'request_scope_mismatch',status:409});
  await assert.rejects(service.claimChatRequest({...input,requestHash:'b'.repeat(64)}),{code:'request_scope_mismatch',status:409});
});

test('failure and uncertain outcomes become terminal and cannot be overwritten',async()=>{
  const {service}=fixture();
  for(const [requestId,status] of [['failed_1','failed'],['unknown_1','unknown']]){
    const input={companyId:'company_a',conversationId:'chat_a',requestId,requestHash:'a'.repeat(64)};
    await service.claimChatRequest(input);
    await service.completeChatRequest({companyId:'company_a',requestId,status,httpStatus:200,response:{ok:true,work_status:status}});
    assert.equal((await service.claimChatRequest(input)).status,status);
    await assert.rejects(service.completeChatRequest({companyId:'company_a',requestId,status:'succeeded',httpStatus:200,response:{ok:true}}),CompanyProfileError);
  }
});

test('an aged pending request becomes terminal unknown without allowing a new claim',async()=>{
  const {service,rows}=fixture(),input={companyId:'company_a',conversationId:'chat_a',requestId:'req_1',requestHash:'a'.repeat(64)};
  await service.claimChatRequest(input);
  rows.get('company_a:req_1').created_at=new Date(Date.now()-121_000);
  const expired=await service.expireChatRequest({companyId:'company_a',requestId:'req_1'});
  assert.equal(expired.status,'unknown');
  assert.equal(expired.response.work_status,'unknown');
  assert.equal((await service.claimChatRequest(input)).claimed,false);
  assert.equal((await service.claimChatRequest(input)).status,'unknown');
  await assert.rejects(service.completeChatRequest({companyId:'company_a',requestId:'req_1',status:'succeeded',httpStatus:200,response:{ok:true}}),{code:'request_completion_missing'});
});

test('expiry leaves a completed request unchanged if completion wins the race',async()=>{
  const {service,rows}=fixture(),input={companyId:'company_a',conversationId:'chat_a',requestId:'req_2',requestHash:'b'.repeat(64)};
  await service.claimChatRequest(input);
  rows.get('company_a:req_2').created_at=new Date(Date.now()-121_000);
  await service.completeChatRequest({companyId:'company_a',requestId:'req_2',status:'succeeded',httpStatus:200,response:{ok:true,reply:'done'}});
  const after=await service.expireChatRequest({companyId:'company_a',requestId:'req_2'});
  assert.equal(after.status,'succeeded');
  assert.equal(after.response.reply,'done');
});

test('a final model reply cannot replace a run already reconciled for the request',async()=>{
  const {service}=fixture(),input={companyId:'company_a',conversationId:'chat_a',requestId:'req_run',requestHash:'e'.repeat(64)};
  const claim=await service.claimChatRequest(input);
  const verified={ok:true,conversation_id:'chat_a',request_status:'succeeded',work_status:'succeeded',outcome_kind:'tool_result',run_id:'AyDcS8RxKFU1u8L4Bggki',flow_id:'wlyKFTxiAOHCMHWS1GIKd'};
  await service.completeChatRequest({companyId:input.companyId,requestId:input.requestId,status:'succeeded',httpStatus:200,response:verified});
  const settled=await service.settleChatRequest({companyId:input.companyId,requestId:input.requestId,status:'succeeded',httpStatus:200,response:{ok:true,reply:'model reply without run identity'},claimToken:claim.claimToken});
  assert.deepEqual(settled.response,verified);
  assert.deepEqual((await service.readChatRequest({companyId:input.companyId,requestId:input.requestId})).response,verified);
});

test('the original claim can upgrade an expired unknown to its verified late success',async()=>{
  const {service,rows}=fixture(),input={companyId:'company_a',conversationId:'chat_a',requestId:'req_3',requestHash:'c'.repeat(64)};
  const claim=await service.claimChatRequest(input);
  rows.get('company_a:req_3').created_at=new Date(Date.now()-121_000);
  await service.expireChatRequest({companyId:'company_a',requestId:'req_3'});
  const settled=await service.settleChatRequest({companyId:'company_a',requestId:'req_3',status:'succeeded',httpStatus:200,response:{ok:true,work_status:'succeeded',reply:'done'},claimToken:claim.claimToken});
  assert.equal(settled.status,'succeeded');
  assert.equal((await service.readChatRequest({companyId:'company_a',requestId:'req_3'})).response.reply,'done');
});

test('a duplicate without the original claim cannot upgrade unknown or failed',async()=>{
  const {service,rows}=fixture(),input={companyId:'company_a',conversationId:'chat_a',requestId:'req_4',requestHash:'d'.repeat(64)};
  await service.claimChatRequest(input);
  rows.get('company_a:req_4').created_at=new Date(Date.now()-121_000);
  await service.expireChatRequest({companyId:'company_a',requestId:'req_4'});
  const replay=await service.settleChatRequest({companyId:'company_a',requestId:'req_4',status:'succeeded',httpStatus:200,response:{ok:true,work_status:'succeeded',reply:'false success'}});
  assert.equal(replay.status,'unknown');
  assert.notEqual(replay.response.reply,'false success');
  const failed={...input,requestId:'req_5'};
  const claim=await service.claimChatRequest(failed);
  await service.completeChatRequest({companyId:'company_a',requestId:'req_5',status:'failed',httpStatus:200,response:{ok:true,work_status:'failed'}});
  const after=await service.settleChatRequest({companyId:'company_a',requestId:'req_5',status:'succeeded',httpStatus:200,response:{ok:true,work_status:'succeeded'},claimToken:claim.claimToken});
  assert.equal(after.status,'failed');
});
