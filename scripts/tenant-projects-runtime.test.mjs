import test from 'node:test';
import assert from 'node:assert/strict';
import {createTenantProjectService,TenantProjectError} from '../lib/tenant-projects.mjs';

const projectId='AbCdEf1234567890GhIjK';

function harness({listed=[],createdProject}={}){
  const rows=new Map(),calls=[];
  async function query(text,values=[]){
    if(text.startsWith('CREATE TABLE'))return {rows:[]};
    if(text.startsWith('SELECT'))return {rows:rows.has(values[0])?[rows.get(values[0])]:[]};
    if(text.startsWith('INSERT')){
      const row={tenant_id:values[0],external_id:values[1],activepieces_project_id:values[2],display_name:values[3],provision_status:'ready'};
      rows.set(values[0],row);return {rows:[row]};
    }
    throw new Error('unexpected query');
  }
  async function fetchImpl(url,options={}){
    calls.push({url,options});
    if((options.method||'GET')==='GET')return {ok:true,status:200,json:async()=>({data:listed})};
    return {ok:true,status:201,json:async()=>createdProject};
  }
  return {service:createTenantProjectService({query,fetchImpl,activepiecesUrl:'https://activepieces.example',apiKey:'secret'}),rows,calls};
}

test('provisions one isolated project with stable externalId and reuses the stored mapping',async()=>{
  const h=harness({createdProject:{id:projectId,externalId:'siyadah:tenant_1001'}});
  await h.service.init();
  const first=await h.service.ensure({tenantId:'tenant_1001',displayName:'شركة ألف'});
  const second=await h.service.ensure({tenantId:'tenant_1001',displayName:'اسم متغير'});
  assert.equal(first.created,true);assert.equal(second.created,false);
  assert.equal(first.activepieces_project_id,projectId);
  assert.equal(h.calls.filter(call=>(call.options.method||'GET')==='POST').length,1);
  const createdBody=JSON.parse(h.calls.find(call=>call.options.method==='POST').options.body);
  assert.equal(createdBody.externalId,'siyadah:tenant_1001');
  assert.equal(createdBody.metadata.tenantId,'tenant_1001');
  assert.equal(createdBody.maxConcurrentJobs,2);
});

test('adopts the exact existing provider project instead of creating a duplicate',async()=>{
  const h=harness({listed:[{id:projectId,externalId:'siyadah:tenant_2002'}]});
  const result=await h.service.ensure({tenantId:'tenant_2002',displayName:'شركة باء'});
  assert.equal(result.created,false);assert.equal(result.activepieces_project_id,projectId);
  assert.equal(h.calls.length,1);
});

test('coalesces concurrent signup retries so only one provider project is created',async()=>{
  const h=harness({createdProject:{id:projectId,externalId:'siyadah:tenant_4004'}});
  const [first,second]=await Promise.all([
    h.service.ensure({tenantId:'tenant_4004',displayName:'شركة دال'}),
    h.service.ensure({tenantId:'tenant_4004',displayName:'شركة دال'})
  ]);
  assert.equal(first.activepieces_project_id,second.activepieces_project_id);
  assert.equal(h.calls.filter(call=>call.options.method==='POST').length,1);
});

test('never accepts an unprovisioned or malformed tenant project for flow operations',async()=>{
  const h=harness();
  await assert.rejects(()=>h.service.requireProject('tenant_3003'),error=>error instanceof TenantProjectError&&error.code==='project_not_ready');
  await assert.rejects(()=>h.service.ensure({tenantId:'../other',displayName:'سيئ'}),error=>error instanceof TenantProjectError&&error.code==='invalid_tenant');
});

test('creates flows only with the stored tenant project and rejects a foreign provider result',async()=>{
  const h=harness({createdProject:{id:projectId,externalId:'siyadah:tenant_5005'}});
  await h.service.ensure({tenantId:'tenant_5005',displayName:'شركة هاء'});
  h.calls.length=0;
  const flowHarness=createTenantProjectService({
    query:async(text,values=[])=>{
      if(text.startsWith('SELECT'))return {rows:[h.rows.get(values[0])]};
      return {rows:[]};
    },
    activepiecesUrl:'https://activepieces.example',apiKey:'secret',
    fetchImpl:async(url,options)=>({ok:true,status:201,json:async()=>({id:'ZyXwVu9876543210TsRqP',projectId,version:{displayName:'فلو عميل'},status:'DISABLED'})})
  });
  const flow=await flowHarness.createFlow({tenantId:'tenant_5005',displayName:'فلو عميل'});
  assert.equal(flow.projectId,projectId);

  const foreign=createTenantProjectService({
    query:async()=>({rows:[h.rows.get('tenant_5005')]}),activepiecesUrl:'https://activepieces.example',apiKey:'secret',
    fetchImpl:async()=>({ok:true,status:201,json:async()=>({id:'ZyXwVu9876543210TsRqP',projectId:'WrongProject1234567890'})})
  });
  await assert.rejects(()=>foreign.createFlow({tenantId:'tenant_5005',displayName:'مرفوض'}),error=>error instanceof TenantProjectError&&error.code==='flow_project_mismatch');
});
