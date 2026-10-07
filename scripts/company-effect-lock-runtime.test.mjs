import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyEffectLock} from '../lib/company-effect-lock.mjs';

function harness(){
  const owners=new Map(),events=[];let serial=0;
  const database=async()=>({connect:async()=>{
    const session=++serial;return {
      query:async(sql,keys)=>{
        const key=JSON.stringify(keys);events.push({session,sql,keys});
        if(sql.includes('pg_try_advisory_lock')){const locked=!owners.has(key);if(locked)owners.set(key,session);return {rows:[{locked}]};}
        const unlocked=owners.get(key)===session;if(unlocked)owners.delete(key);return {rows:[{unlocked}]};
      },release:destroy=>{events.push({session,destroy:destroy===true,released:true});if(destroy)for(const [key,owner] of owners)if(owner===session)owners.delete(key);}
    };
  }});
  return {database,events,owners};
}
test('separate requests share the company effect lock and another company remains available',async()=>{
  const h=harness(),first=createCompanyEffectLock({...h,companyId:'a'}),second=createCompanyEffectLock({...h,companyId:'a'}),other=createCompanyEffectLock({...h,companyId:'b'});
  await first.acquire();await first.acquire();
  await assert.rejects(second.acquire,{code:'company_effect_busy'});
  await other.acquire();
  assert.equal(h.owners.size,2);
  await second.release();assert.equal(h.owners.size,2);
  await first.release();await second.acquire();await second.release();await other.release();
  assert.equal(h.owners.size,0);
  const firstQueries=h.events.filter(e=>e.session===1&&e.sql);
  assert.equal(firstQueries.length,2);
  assert.deepEqual(firstQueries[0].keys,firstQueries[1].keys);
});
test('unused effect lock does not open a database session',async()=>{
  const h=harness(),lock=createCompanyEffectLock({...h,companyId:'a'});
  await lock.release();assert.deepEqual(h.events,[]);
});
test('uncertain acquisition or unlock destroys the session instead of pooling a possible held lock',async()=>{
  for(const failOn of ['acquire','release']){
    const releases=[];
    const database=async()=>({connect:async()=>({query:async sql=>{
      if(sql.includes('pg_try_advisory_lock')){if(failOn==='acquire')throw new Error('transport failed');return {rows:[{locked:true}]};}
      return {rows:[{unlocked:false}]};
    },release:destroy=>releases.push(destroy)})});
    const lock=createCompanyEffectLock({database,companyId:'a'});
    if(failOn==='acquire')await assert.rejects(lock.acquire);else{await lock.acquire();await assert.rejects(lock.release);}
    assert.deepEqual(releases,[true]);
    await lock.release();assert.deepEqual(releases,[true]);
  }
});

test('holding an effect connection does not consume the pool used for ownership and result queries',async()=>{
  const {readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  const start=source.indexOf('function databaseOptions()'),end=source.indexOf('async function accountAuth()',start);
  class Pool{
    held=0;
    async connect(){this.held++;return {release:()=>{this.held--;}};}
    async query(){if(this.held)throw new Error('pool exhausted by lock holder');return {rows:[{saved:true}]};}
  }
  const providers=runInNewContext(`let databasePromise,effectDatabasePromise;${source.slice(start,end)};({database,effectDatabase})`,{process:{env:{DATABASE_URL:'postgres://test@localhost/test'}},pg:{Pool},URL,Promise});
  const lockConnection=await (await providers.effectDatabase()).connect();
  try{assert.equal((await (await providers.database()).query('ownership/readback')).rows[0].saved,true);}finally{lockConnection.release();}
});
