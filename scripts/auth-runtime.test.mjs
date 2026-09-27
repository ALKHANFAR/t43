import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const auth=readFileSync(new URL('../auth.html',import.meta.url),'utf8');
const chat=readFileSync(new URL('../app/chat.js',import.meta.url),'utf8');
const chatPage=readFileSync(new URL('../app/chat.html',import.meta.url),'utf8');
const dockerfile=readFileSync(new URL('../Dockerfile',import.meta.url),'utf8');
const labServer=readFileSync(new URL('../lab-server.mjs',import.meta.url),'utf8');

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
  assert.ok(!chatPage.includes('localStorage.getItem("siyadah_token")'));
  assert.ok(!chat.includes('"Authorization":"Bearer "+'));
});

test('isolated lab runtime starts the local direct-MCP server without a legacy core proxy',()=>{
  assert.match(dockerfile,/CMD \["node", "lab-server\.mjs"\]/);
  assert.match(labServer,/https:\/\/cloud\.activepieces\.com\/mcp/);
  assert.ok(!labServer.includes('siyadah-core'));
  assert.ok(!labServer.includes('proxy_pass'));
});
