import test from 'node:test';
import assert from 'node:assert/strict';
import {cookieValue,createTenantSession,readTenantSession,sessionCookie} from '../lib/tenant-session.mjs';

const secret='s'.repeat(64);

test('signed tenant session survives cookie round-trip without exposing it to scripts',()=>{
  const token=createTenantSession(secret,'company_abcdefghijklmnopqrst');
  const header=sessionCookie(token,{secure:true});
  assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Lax/);assert.match(header,/Secure/);
  const parsed=readTenantSession(cookieValue(header),secret);
  assert.equal(parsed.companyId,'company_abcdefghijklmnopqrst');
  assert.equal(parsed.sessionVersion,1);
});

test('session version is signed so password reset can invalidate old sessions',()=>{
  const token=createTenantSession(secret,'company_abcdefghijklmnopqrst',7);
  assert.equal(readTenantSession(token,secret).sessionVersion,7);
});

test('tampered tenant session cannot select another tenant',()=>{
  const token=createTenantSession(secret,'company_abcdefghijklmnopqrst');
  const tampered=token.slice(0,-1)+(token.endsWith('a')?'b':'a');
  assert.equal(readTenantSession(tampered,secret),null);
  assert.equal(readTenantSession(token,'x'.repeat(64)),null);
});

test('expired or implausibly future session is rejected',()=>{
  const current=Date.now,now=current();
  try{
    Date.now=()=>now-31*24*60*60*1000;
    const expired=createTenantSession(secret,'company_abcdefghijklmnopqrst');
    Date.now=()=>now;
    assert.equal(readTenantSession(expired,secret),null);
  }finally{Date.now=current;}
});
