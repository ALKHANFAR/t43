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

test('lists only flows returned for the company stored project',async()=>{
  const row={tenant_id:'company_6006',external_id:'siyadah:company_6006',activepieces_project_id:projectId,display_name:'شركة واو',provision_status:'ready'};
  const service=createTenantProjectService({
    query:async()=>({rows:[row]}),activepiecesUrl:'https://activepieces.example',apiKey:'secret',
    fetchImpl:async url=>{
      assert.match(url,new RegExp(`projectId=${projectId}`));
      return {ok:true,status:200,json:async()=>({data:[{id:'QrStUv1234567890WxYzA',projectId,status:'DISABLED'}]})};
    }
  });
  assert.equal((await service.listFlows('company_6006')).length,1);
});

test('two companies keep distinct projects and cannot receive each other flows',async()=>{
  const projects={
    company_alpha:'A12345678901234567890',
    company_beta:'B12345678901234567890',
  },rows=new Map(),providerCalls=[];
  const query=async(text,values=[])=>{
    if(text.startsWith('SELECT'))return {rows:rows.has(values[0])?[rows.get(values[0])]:[]};
    if(text.startsWith('INSERT')){
      const row={tenant_id:values[0],external_id:values[1],activepieces_project_id:values[2],display_name:values[3],provision_status:'ready'};
      rows.set(values[0],row);return {rows:[row]};
    }
    return {rows:[]};
  };
  const fetchImpl=async(url,options={})=>{
    providerCalls.push({url,options});
    const method=options.method||'GET';
    if(url.includes('/api/v1/projects?'))return {ok:true,status:200,json:async()=>({data:[]})};
    if(url.endsWith('/api/v1/projects')&&method==='POST'){
      const body=JSON.parse(options.body),tenantId=body.metadata.tenantId;
      return {ok:true,status:201,json:async()=>({id:projects[tenantId],externalId:`siyadah:${tenantId}`})};
    }
    if(url.endsWith('/api/v1/flows')&&method==='POST'){
      const body=JSON.parse(options.body);
      return {ok:true,status:201,json:async()=>({id:body.projectId.startsWith('A')?'F12345678901234567890':'G12345678901234567890',projectId:body.projectId,status:'DISABLED'})};
    }
    if(url.includes('/api/v1/flows?')){
      const projectId=new URL(url).searchParams.get('projectId');
      return {ok:true,status:200,json:async()=>({data:[{id:projectId.startsWith('A')?'F12345678901234567890':'G12345678901234567890',projectId,status:'DISABLED'}]})};
    }
    throw new Error(`unexpected provider call: ${method} ${url}`);
  };
  const service=createTenantProjectService({query,fetchImpl,activepiecesUrl:'https://activepieces.example',apiKey:'secret'});
  const [alpha,beta]=await Promise.all([
    service.ensure({tenantId:'company_alpha',displayName:'شركة ألف'}),
    service.ensure({tenantId:'company_beta',displayName:'شركة باء'}),
  ]);
  assert.notEqual(alpha.activepieces_project_id,beta.activepieces_project_id);
  const [alphaFlow,betaFlow]=await Promise.all([
    service.createFlow({tenantId:'company_alpha',displayName:'موظف ألف'}),
    service.createFlow({tenantId:'company_beta',displayName:'موظف باء'}),
  ]);
  assert.equal(alphaFlow.projectId,projects.company_alpha);
  assert.equal(betaFlow.projectId,projects.company_beta);
  assert.deepEqual((await service.listFlows('company_alpha')).map(flow=>flow.projectId),[projects.company_alpha]);
  assert.deepEqual((await service.listFlows('company_beta')).map(flow=>flow.projectId),[projects.company_beta]);
  const flowBodies=providerCalls.filter(call=>call.url.endsWith('/api/v1/flows')&&call.options.method==='POST').map(call=>JSON.parse(call.options.body));
  assert.deepEqual(new Set(flowBodies.map(body=>body.projectId)),new Set(Object.values(projects)));
  assert.equal(flowBodies.every(body=>body.metadata.tenantId==='company_alpha'||body.metadata.tenantId==='company_beta'),true);
});
