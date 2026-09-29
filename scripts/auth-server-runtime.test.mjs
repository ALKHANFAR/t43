import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the current server owns the complete password authentication path',async()=>{
  const [server,onboard,auth,account]=await Promise.all([
    readFile(new URL('../server.mjs',import.meta.url),'utf8'),
    readFile(new URL('../app/onboard.html',import.meta.url),'utf8'),
    readFile(new URL('../auth.html',import.meta.url),'utf8'),
    readFile(new URL('../lib/account-auth.mjs',import.meta.url),'utf8'),
  ]);
  assert.match(server,/createAccountAuthService/);
  assert.match(server,/POST[^\n]+\/siyadah-api\/v1\/auth\/signup/);
  assert.match(server,/POST[^\n]+\/siyadah-api\/v1\/auth\/verify-email/);
  assert.match(server,/POST[^\n]+\/siyadah-api\/v1\/auth\/login/);
  assert.match(server,/POST[^\n]+\/siyadah-api\/v1\/auth\/logout/);
  assert.match(server,/GET[^\n]+\/siyadah-api\/v1\/auth\/session/);
  assert.match(server,/POST[^\n]+\/siyadah-api\/v1\/auth\/forgot-password/);
  assert.match(server,/POST[^\n]+\/siyadah-api\/v1\/auth\/reset-password/);
  assert.match(auth,/name="referrer" content="no-referrer"/);
  assert.match(auth,/\/v1\/auth\/forgot-password/);
  assert.match(auth,/\/v1\/auth\/reset-password/);
  assert.match(auth,/verifyToken/);
  assert.match(auth,/confirmEmail/);
  assert.match(server,/sendEmailVerification/);
  assert.match(account,/pending_verification/);
  assert.match(account,/email_verified_at/);
  assert.doesNotMatch(server,/const token=createTenantSession\(secret\),session=/);
  assert.doesNotMatch(onboard,/localStorage\.getItem\("siyadah_token"\)/);
});
