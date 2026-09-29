import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {createAccountAuthService,AccountAuthError} from '../lib/account-auth.mjs';

test('new accounts remain unverified until a one-time email token is accepted',async()=>{
  const calls=[],passwordHash=await bcrypt.hash('strong-password',4);
  const query=async(text,values=[])=>{
    calls.push({text,values});
    if(text.includes('WITH account AS'))return {rowCount:1,rows:[{company_id:'company_test',company_name:'شركة اختبار',status:'pending_verification',session_version:1,email:'qa@example.com'}]};
    if(text.startsWith('SELECT u.company_id'))return {rowCount:1,rows:[{company_id:'company_test',email:'qa@example.com',password_hash:passwordHash,email_verified_at:null,failed_attempts:0,locked_until:null,company_name:'شركة اختبار',status:'pending_verification',session_version:1}]};
    if(text.includes('WITH verified AS'))return {rowCount:1,rows:[{company_id:'company_test'}]};
    return {rowCount:0,rows:[]};
  };
  const service=createAccountAuthService({query});await service.init();
  const account=await service.signup({company_name:'شركة اختبار',email:'qa@example.com',password:'strong-password'});
  assert.equal(account.status,'pending_verification');assert.ok(account.verificationToken.length>=32);
  const signup=calls.find(call=>call.text.includes('WITH account AS'));
  assert.match(signup.text,/email_verified_at,verification_token_hash,verification_expires_at/);
  assert.notEqual(signup.values.at(-1),account.verificationToken);
  await assert.rejects(()=>service.login({email:'qa@example.com',password:'strong-password'}),error=>error instanceof AccountAuthError&&error.code==='email_not_verified'&&error.status===403);
  assert.deepEqual(await service.verifyEmail(account.verificationToken),{companyId:'company_test'});
  const verification=calls.find(call=>call.text.includes('WITH verified AS'));
  assert.notEqual(verification.values[0],account.verificationToken);
});

test('password recovery ignores accounts whose email is not verified',async()=>{
  let insert;
  const service=createAccountAuthService({query:async(text)=>{if(text.includes('INSERT INTO siyadah_password_resets'))insert=text;return {rowCount:0,rows:[]};}});
  await service.init();
  assert.equal(await service.createPasswordReset('pending@example.com'),null);
  assert.match(insert,/email_verified_at IS NOT NULL/);
});
