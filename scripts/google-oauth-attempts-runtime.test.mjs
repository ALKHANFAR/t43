import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleOAuthAttemptStore} from '../lib/google-oauth-attempts.mjs';

test('OAuth attempt ledger stores hashes and consumes exactly once for its company session',async()=>{
  const rows=new Map(),calls=[];
  const query=async(sql,args=[])=>{
    calls.push({sql,args});
    if(sql.startsWith('INSERT')){rows.set(args[0],{companyId:args[1],sessionHash:args[2],expiresAt:args[3]});return {rows:[]};}
    if(sql.startsWith('DELETE')&&sql.includes('RETURNING')){
      const row=rows.get(args[0]);
      if(!row||row.companyId!==args[1]||row.sessionHash!==args[2]||row.expiresAt<Date.now())return {rows:[]};
      rows.delete(args[0]);return {rows:[{state_hash:args[0]}]};
    }
    return {rows:[]};
  };
  const store=createGoogleOAuthAttemptStore({query});
  await store.save({state:'private-state',companyId:'company-a',sessionBinding:'private-cookie',expiresAt:Date.now()+60_000});
  assert.equal(rows.size,1);
  assert.doesNotMatch(JSON.stringify(calls),/private-state|private-cookie/);
  assert.equal(await store.consume({state:'private-state',companyId:'company-b',sessionBinding:'private-cookie'}),false);
  assert.equal(await store.consume({state:'private-state',companyId:'company-a',sessionBinding:'other-cookie'}),false);
  assert.equal(await store.consume({state:'private-state',companyId:'company-a',sessionBinding:'private-cookie'}),true);
  assert.equal(await store.consume({state:'private-state',companyId:'company-a',sessionBinding:'private-cookie'}),false);
});
