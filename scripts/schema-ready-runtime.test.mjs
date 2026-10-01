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

test('local draft checks activate only when migration 0002 is in the image',async()=>{
  const statements=[];
  const query=async sql=>{
    statements.push(sql);
    if(sql.includes('pg_constraint'))return {rows:[{ledger_pk_ok:true}]};
    if(sql.includes('pg_index'))return {rows:[{flow_nullable_ok:true,draft_unique_ok:true}]};
    return {rows:[]};
  };
  await assertSchemaReady(query,{localDrafts:false});
  assert.equal(statements.some(sql=>sql.includes('creation_payload_key')),false);
  statements.length=0;
  await assertSchemaReady(query,{localDrafts:true});
  assert.equal(statements.some(sql=>sql.includes('creation_payload_key')),true);
  assert.equal(statements.some(sql=>sql.includes('pg_index')&&sql.includes('indisunique')&&sql.includes('indpred IS NULL')),true);
});

test('local draft readiness rejects missing columns, nullable flow rule, or unique request index',async()=>{
  const queryFor=checks=>async sql=>{
    if(sql.includes('pg_constraint'))return {rows:[{ledger_pk_ok:true}]};
    if(sql.includes('creation_payload_key')&&checks.columns===false)throw Object.assign(new Error('column missing'),{code:'42703'});
    if(sql.includes('pg_index'))return {rows:[{flow_nullable_ok:checks.nullable,draft_unique_ok:checks.unique}]};
    return {rows:[]};
  };
  await assert.rejects(()=>assertSchemaReady(queryFor({columns:false,nullable:true,unique:true}),{localDrafts:true}),{code:'42703'});
  await assert.rejects(()=>assertSchemaReady(queryFor({columns:true,nullable:false,unique:true}),{localDrafts:true}),/local employee draft schema is incomplete/);
  await assert.rejects(()=>assertSchemaReady(queryFor({columns:true,nullable:true,unique:false}),{localDrafts:true}),/local employee draft schema is incomplete/);
});
