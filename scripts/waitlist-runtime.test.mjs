import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWaitlistProxy,WaitlistError} from '../lib/waitlist.mjs';

const webhookUrl='https://example.test/webhook-secret';
const input={name:'Test Person',email:'test@example.com',country_code:'+966',phone:'5551234567',company:'Siyadah',page:'https://siyadah.test/',ref:'',ts:'2026-10-02T00:00:00.000Z'};

test('waitlist proxy forwards a bounded lead and returns only a Siyadah receipt',async()=>{
  const calls=[];
  const submit=createWaitlistProxy({webhookUrl,fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,status:200};}});
  const result=await submit({...input,company:'X'.repeat(300)});
  assert.deepEqual(result,{ok:true,status:'accepted'});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,webhookUrl);
  assert.equal(calls[0].options.method,'POST');
  const body=JSON.parse(calls[0].options.body);
  assert.equal(body.company.length,160);
  assert.equal(body.email,input.email);
  assert.equal(body.page,input.page);
});

test('waitlist proxy rejects invalid leads and missing destination without forwarding',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;return {ok:true};};
  await assert.rejects(()=>createWaitlistProxy({webhookUrl,fetchImpl})({...input,email:'bad'}),error=>error instanceof WaitlistError&&error.status===400);
  await assert.rejects(()=>createWaitlistProxy({webhookUrl:'',fetchImpl})(input),error=>error instanceof WaitlistError&&error.status===503);
  assert.equal(calls,0);
});

test('waitlist proxy does not claim delivery after upstream failure',async()=>{
  for(const fetchImpl of [async()=>({ok:false,status:500}),async()=>{throw new Error('network');}]){
    await assert.rejects(()=>createWaitlistProxy({webhookUrl,fetchImpl})(input),error=>error instanceof WaitlistError&&error.status===502);
  }
});

test('public server registers a same-origin waitlist route',async()=>{
  const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
  assert.match(source,/req\.url==='\/siyadah-api\/v1\/waitlist'\)return waitlist\(req,res\)/);
  assert.match(source,/process\.env\.SIYADAH_WAITLIST_WEBHOOK_URL/);
});
