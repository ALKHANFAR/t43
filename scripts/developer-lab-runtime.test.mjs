import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../developer-lab/server.mjs',import.meta.url),'utf8');
const client=await readFile(new URL('../developer-lab/app.js',import.meta.url),'utf8');
const production=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
const chat=await readFile(new URL('../app/chat.html',import.meta.url),'utf8');

test('developer lab is localhost-only and refuses production',()=>{
  assert.match(server,/host='127\.0\.0\.1'/);
  assert.match(server,/NODE_ENV==='production'/);
  assert.match(server,/RAILWAY_ENVIRONMENT_ID/);
});
test('lab does not import production runtime or execute tools',()=>{
  assert.doesNotMatch(server,/from ['"]\.\.\/server\.mjs/);
  assert.doesNotMatch(server,/runFlow|activepieces|DATABASE_URL/i);
  assert.match(server,/لا تنفذ أدوات/);
});
test('production has no lab route or customer link',()=>{
  assert.doesNotMatch(production,/lab_run|lab_list|lab_choose|siyadah_experiments/);
  assert.doesNotMatch(chat,/مختبر سيادة|app\/lab/);
});
test('winner creates proposal only and never promotes automatically',()=>{
  assert.match(client,/siyadah_developer_change_request/);
  assert.match(client,/status:'proposal_only'/);
  assert.match(client,/productionChanged:false/);
  assert.doesNotMatch(client,/siyadah-api|\/app\/chat/);
});
