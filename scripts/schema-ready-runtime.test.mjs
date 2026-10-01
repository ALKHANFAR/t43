import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertSchemaReady} from '../lib/schema-ready.mjs';

test('health checks schema without creating or altering tables',async()=>{
  const statements=[];
  await assertSchemaReady(async sql=>{statements.push(sql);return {rows:sql.includes('pg_constraint')?[{ledger_pk_ok:true}]:[]};});
  assert.ok(statements.length>=5);
  assert.ok(statements.every(sql=>/^SELECT\b/i.test(sql)));
  assert.ok(statements.slice(0,-1).every(sql=>/\bLIMIT 0$/i.test(sql)));
  const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  const health=server.slice(server.indexOf('async function health('),server.indexOf('async function createTenantFlow('));
  assert.match(health,/assertSchemaReady/);
  assert.doesNotMatch(health,/\.init\(|CREATE\s+TABLE|ALTER\s+TABLE/i);
});

test('schema check fails closed on a missing table',async()=>{
  let count=0;
  await assert.rejects(()=>assertSchemaReady(async()=>{if(++count===3)throw Object.assign(new Error('relation missing'),{code:'42P01'});}),{code:'42P01'});
  assert.equal(count,3);
});

test('schema check rejects a ledger without the request identity primary key',async()=>{
  await assert.rejects(()=>assertSchemaReady(async sql=>({rows:sql.includes('pg_constraint')?[{ledger_pk_ok:false}]:[]})),/primary key is missing/);
});
