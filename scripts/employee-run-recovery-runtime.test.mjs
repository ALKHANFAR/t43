import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createEmployeeRunRecovery} from '../lib/employee-run-recovery.mjs';
import {createCompanyProfileService} from '../lib/company-profile.mjs';

const url=process.env.SIYADAH_RECOVERY_TEST_DATABASE_URL;
test('durable native receipts survive restart, expiry and concurrent reconciliation in PostgreSQL',{skip:!url},async t=>{
  const parsed=new URL(url);
  assert.ok(['127.0.0.1','localhost'].includes(parsed.hostname)&&parsed.pathname.startsWith('/siyadah_receipt_'),'use an isolated local test database');
  const pool=new pg.Pool({connectionString:url}),query=(sql,values)=>pool.query(sql,values);
  try{
    const profiles=createCompanyProfileService({query});await profiles.init();
    async function fixture(){
      const companyId=`qa_${randomUUID()}`,employeeId=randomUUID(),flowId=randomUUID().replaceAll('-','').slice(0,21),runId=randomUUID().replaceAll('-','').slice(0,21),projectId='P'.repeat(21),requestId='r1',conversationId='c1',claimToken='a'.repeat(64);
      await query(`INSERT INTO siyadah_digital_employees(id,company_id,activepieces_flow_id,role_key,name,role_title,prompt,knowledge_topics_json,knowledge_version,status)
        VALUES ($1,$2,$3,'qa','QA','QA','QA','[]',1,'active')`,[employeeId,companyId,flowId]);
      await query(`INSERT INTO siyadah_chat_requests(company_id,request_id,conversation_id,request_hash,claim_token,created_at)
        VALUES ($1,$2,$3,$4,$5,now()-interval '20 minutes')`,[companyId,requestId,conversationId,'b'.repeat(64),claimToken]);
      const employee=await profiles.findEmployee(companyId,employeeId),execution={runId,flowId,projectId,flowVersionId:'v1',environment:'PRODUCTION'},calls=[];
      let unavailable=false,overrides={};
      const projects={requireProject:async()=>projectId,ownedFlow:async()=>({flow:{status:'DISABLED',publishedVersionId:'v2'}})};
      const mcp={call:async(_company,method,params)=>{calls.push(params.name);assert.equal(method,'tools/call');assert.equal(params.name,'ap_get_run');if(unavailable)throw new Error('readback unavailable');return {structuredContent:{id:runId,flowId,flowVersionId:'v1',projectId,environment:'PRODUCTION',status:'SUCCEEDED',steps:[{output:{value:42}}],...overrides}};}};
      const fresh=(queryImpl=query)=>createEmployeeRunRecovery({query:queryImpl,projects,mcp});
      const context={companyId,requestId,conversationId};
      await fresh().capture({...context,claimToken,employee,execution,publishedVersion:'v1'});
      return {...context,employeeId,runId,execution,calls,fresh,unavailable:value=>{unavailable=value;},overrides:value=>{overrides=value;}};
    }
    await t.test('crash after durable identity and expiry then recovery does not redispatch',async()=>{
      const f=await fixture();f.unavailable(true);await assert.rejects(f.fresh().reconcile(f));
      await profiles.expireChatRequest(f);
      f.unavailable(false);const result=await f.fresh().reconcile(f);
      assert.equal(result.run_id,f.runId);assert.equal(result.work_status,'succeeded');
      const employee=await profiles.findEmployee(f.companyId,f.employeeId);assert.equal(employee.last_run_id,f.runId);
      const before=employee.run_snapshot_updated_at;
      await f.fresh().reconcile(f);assert.equal((await profiles.findEmployee(f.companyId,f.employeeId)).run_snapshot_updated_at,before);
      assert.deepEqual(f.calls,['ap_get_run','ap_get_run']);
    });
    await t.test('concurrent repair persists one stable result and employee timestamp',async()=>{
      const f=await fixture();const results=await Promise.all(Array.from({length:8},()=>f.fresh().reconcile(f)));
      assert.ok(results.every(result=>result.run_id===f.runId));
      const row=await profiles.readChatRequest(f);assert.equal(row.status,'succeeded');
      assert.equal((await profiles.findEmployee(f.companyId,f.employeeId)).last_run_id,f.runId);
    });
    await t.test('disabled employee and a newer employee run are preserved',async()=>{
      for(const disabled of [true,false]){
        const f=await fixture(),newRun='N'.repeat(21);
        await query(`UPDATE siyadah_digital_employees SET status=$3,last_run_id=$4,last_run_at=now(),updated_at=now() WHERE company_id=$1 AND id=$2`,[f.companyId,f.employeeId,disabled?'disabled':'active',newRun]);
        assert.equal((await f.fresh().reconcile(f)).run_id,f.runId);
        const employee=await profiles.findEmployee(f.companyId,f.employeeId);assert.equal(employee.status,disabled?'disabled':'active');assert.equal(employee.last_run_id,newRun);
      }
    });
    await t.test('two dispatch snapshots keep the newer request run in either recovery order',async()=>{
      for(const newerFirst of [true,false]){
        const f=await fixture(),secondRun='S'.repeat(21),claimToken='c'.repeat(64),employee=await profiles.findEmployee(f.companyId,f.employeeId);
        await query(`INSERT INTO siyadah_chat_requests(company_id,request_id,conversation_id,request_hash,claim_token,created_at)
          VALUES ($1,'r2',$2,$3,$4,now()-interval '10 minutes')`,[f.companyId,f.conversationId,'d'.repeat(64),claimToken]);
        await f.fresh().capture({...f,requestId:'r2',claimToken,employee,execution:{...f.execution,runId:secondRun},publishedVersion:'v1'});
        for(const newer of newerFirst?[true,false]:[false,true]){
          f.overrides({id:newer?secondRun:f.runId});
          await f.fresh().reconcile({...f,requestId:newer?'r2':'r1'});
        }
        assert.equal((await profiles.findEmployee(f.companyId,f.employeeId)).last_run_id,secondRun);
      }
    });
    await t.test('SQL receipt persistence failure leaves both records unchanged and retry succeeds',async()=>{
      const f=await fixture();
      await assert.rejects(f.fresh(async(sql,values)=>{
        if(sql.startsWith('WITH receipt AS'))throw new Error('injected receipt write failure');
        return query(sql,values);
      }).reconcile(f),/injected receipt write failure/);
      assert.equal((await profiles.findEmployee(f.companyId,f.employeeId)).last_run_id,null);
      assert.equal((await profiles.readChatRequest(f)).status,'pending');
      assert.equal((await f.fresh().reconcile(f)).run_id,f.runId);
      assert.equal((await profiles.findEmployee(f.companyId,f.employeeId)).last_run_id,f.runId);
      assert.ok(f.calls.every(name=>name==='ap_get_run'));
    });
    await t.test('scope mismatch and nonterminal exact runs stay unknown',async()=>{
      const f=await fixture();assert.equal(await f.fresh().reconcile({...f,conversationId:'foreign'}),null);
      for(const overrides of [{id:'X'.repeat(21)},{flowId:'F'.repeat(21)},{projectId:'Q'.repeat(21)},{flowVersionId:'v2'},...['RUNNING','FAILED','CANCELED','TIMED_OUT'].map(status=>({status})),{environment:'TESTING'}]){
        f.overrides(overrides);assert.equal(await f.fresh().reconcile(f),null);
      }
      assert.equal((await profiles.findEmployee(f.companyId,f.employeeId)).last_run_id,null);
    });
  }finally{await pool.end();}
});
