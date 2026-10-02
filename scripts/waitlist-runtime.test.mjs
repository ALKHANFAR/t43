import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPublicWaitlist,PublicWaitlistError} from '../lib/public-waitlist.mjs';

const input={name:'Test Person',email:'TEST@example.com',country_code:'+966',phone:'5551234567',company:'Siyadah',role:'Founder'};

test('public waitlist saves a bounded lead in Siyadah before acknowledging it',async()=>{
  const calls=[];
  const store=createPublicWaitlist({query:async(sql,values)=>{calls.push({sql,values});return {rows:[]};}});
  const result=await store.submit({...input,company:'X'.repeat(300)});
  assert.deepEqual(result,{ok:true,status:'accepted'});
  assert.equal(calls.length,1);
  assert.match(calls[0].sql,/INSERT INTO siyadah_public_waitlist/);
  assert.match(calls[0].sql,/ON CONFLICT \(email\) DO NOTHING/);
  assert.equal(calls[0].values[0],'test@example.com');
  assert.equal(calls[0].values[4].length,160);
  assert.equal(calls[0].values[5],'Founder');
});

test('public waitlist rejects malformed leads before storage',async()=>{
  let writes=0;
  const store=createPublicWaitlist({query:async()=>{writes++;}});
  for(const bad of [{...input,email:'bad'},{...input,email:`${'a'.repeat(255)}@example.com`},{...input,phone:'12'},{...input,name:'A'}]){
    await assert.rejects(()=>store.submit(bad),error=>error instanceof PublicWaitlistError&&error.status===400);
  }
  assert.equal(writes,0);
});

test('public waitlist does not claim acceptance when storage fails',async()=>{
  const store=createPublicWaitlist({query:async()=>{throw new Error('database unavailable');}});
  await assert.rejects(()=>store.submit(input),/database unavailable/);
});

test('public site route stores leads and permits only the named site for CORS',async()=>{
  const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
  assert.match(source,/createPublicWaitlist/);
  assert.match(source,/req\.method==='POST'&&req\.url==='\/siyadah-api\/v1\/waitlist'/);
  assert.match(source,/req\.method==='OPTIONS'&&pathname==='\/siyadah-api\/v1\/waitlist'/);
  assert.match(source,/https:\/\/siyadah-ai\.com/);
  assert.doesNotMatch(source,/SIYADAH_WAITLIST_WEBHOOK_URL/);
});
