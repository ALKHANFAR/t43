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
});

test('tampered tenant session cannot select another tenant',()=>{
  const token=createTenantSession(secret,'company_abcdefghijklmnopqrst');
  const tampered=token.slice(0,-1)+(token.endsWith('a')?'b':'a');
  assert.equal(readTenantSession(tampered,secret),null);
  assert.equal(readTenantSession(token,'x'.repeat(64)),null);
});
