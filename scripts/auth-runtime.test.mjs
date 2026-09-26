import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const auth=readFileSync(new URL('../auth.html',import.meta.url),'utf8');
const chat=readFileSync(new URL('../app/chat.js',import.meta.url),'utf8');
const nginx=readFileSync(new URL('../nginx.conf',import.meta.url),'utf8');

test('authentication uses Siyadah HttpOnly session endpoints through same-origin proxy',()=>{
  assert.match(auth,/\/v1\/auth\/login/);
  assert.match(auth,/\/v1\/auth\/signup/);
  assert.match(auth,/credentials:"include"/);
  assert.ok(!auth.includes('/api/v1/webhooks/'));
  assert.ok(!auth.includes('localStorage.setItem("siyadah_token"'));
});

test('chat sends cookies and never reads or sends a browser bearer token',()=>{
  assert.match(chat,/credentials:"include"/);
  assert.ok(!chat.includes('localStorage.getItem("siyadah_token")'));
  assert.ok(!chat.includes('"Authorization":"Bearer "+'));
});

test('nginx proxies the same-origin Siyadah path to the governed core',()=>{
  assert.match(nginx,/location \/siyadah-api\//);
  assert.match(nginx,/proxy_pass https:\/\/siyadah-core-api-production\.up\.railway\.app\//);
  assert.match(nginx,/proxy_set_header Origin \$http_origin/);
});

