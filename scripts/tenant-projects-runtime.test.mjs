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

test('execution service setup errors use Siyadah language without naming the engine',async()=>{
  const service=createTenantProjectService({query:async()=>({rows:[]}),activepiecesUrl:'',apiKey:''});
  await assert.rejects(()=>service.ensure({tenantId:'company_1',displayName:'شركة'}),error=>{
    assert.equal(error.code,'provider_not_configured');
    assert.doesNotMatch(error.message,/Activepieces|@activepieces/i);
    return true;
  });
});
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

test('recovers the provider project after a concurrent or ambiguous create failure',async()=>{
  const h=harness();
  let reads=0,posts=0;
  const service=createTenantProjectService({
    query:async(text,values=[])=>{
      if(text.startsWith('SELECT'))return {rows:h.rows.has(values[0])?[h.rows.get(values[0])]:[]};
      if(text.startsWith('INSERT')){
        const row={tenant_id:values[0],external_id:values[1],activepieces_project_id:values[2],display_name:values[3],provision_status:'ready'};
        h.rows.set(values[0],row);return {rows:[row]};
      }
      throw new Error('unexpected query');
    },
    activepiecesUrl:'https://activepieces.example',apiKey:'secret',
    fetchImpl:async(url,options={})=>{
      if(options.method==='POST'){posts++;throw new DOMException('response lost after create','AbortError');}
      reads++;
      assert.equal(options.signal.aborted,false);
      return {ok:true,status:200,json:async()=>({data:reads===1?[]:[{id:projectId,externalId:'siyadah:tenant_7007'}]})};
    }
  });
  const result=await service.ensure({tenantId:'tenant_7007',displayName:'شركة الاختبار'});
  assert.equal(result.activepieces_project_id,projectId);
  assert.equal(result.created,false);
  assert.equal(posts,1);assert.equal(reads,2);
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

test('the REST project adapter exposes only Flow reads and no Flow mutations',async()=>{
  const h=harness();
  assert.equal(Object.hasOwn(h.service,'createFlow'),false);
  assert.equal(Object.hasOwn(h.service,'changeFlowStatus'),false);
  assert.equal(typeof h.service.listFlows,'function');
  assert.equal(typeof h.service.ownedFlow,'function');
  assert.equal(h.calls.length,0);
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

test('reads the requested published flow version only within its owning project',async()=>{
  const flowId='F12345678901234567890',versionId='published_1';
  const row={tenant_id:'company_alpha',external_id:'siyadah:company_alpha',activepieces_project_id:projectId,display_name:'شركة ألف',provision_status:'ready'};
  const seen=[];
  const service=createTenantProjectService({
    query:async()=>({rows:[row]}),activepiecesUrl:'https://activepieces.example',apiKey:'secret',
    fetchImpl:async url=>{
      seen.push(url);
      return {ok:true,status:200,json:async()=>({id:flowId,projectId,status:'ENABLED',version:{id:new URL(url).searchParams.get('versionId')||'draft_2',connectionIds:[]}})};
    },
  });
  const owned=await service.ownedFlow('company_alpha',flowId,versionId);
  assert.equal(owned.flow.version.id,versionId);
  assert.equal(new URL(seen[0]).searchParams.get('versionId'),versionId);
  const mismatched=createTenantProjectService({query:async()=>({rows:[row]}),activepiecesUrl:'https://activepieces.example',apiKey:'secret',fetchImpl:async()=>({ok:true,status:200,json:async()=>({id:flowId,projectId,status:'ENABLED',version:{id:'another_version'}})})});
  await assert.rejects(()=>mismatched.ownedFlow('company_alpha',flowId,versionId),error=>error instanceof TenantProjectError&&error.code==='flow_version_mismatch');
  const foreign=createTenantProjectService({query:async()=>({rows:[row]}),activepiecesUrl:'https://activepieces.example',apiKey:'secret',fetchImpl:async()=>({ok:true,status:200,json:async()=>({id:flowId,projectId:'ForeignProject123456789',version:{id:versionId}})})});
  await assert.rejects(()=>foreign.ownedFlow('company_alpha',flowId,versionId),error=>error instanceof TenantProjectError&&error.code==='flow_project_mismatch');
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
  assert.deepEqual((await service.listFlows('company_alpha')).map(flow=>flow.projectId),[projects.company_alpha]);
  assert.deepEqual((await service.listFlows('company_beta')).map(flow=>flow.projectId),[projects.company_beta]);
  assert.equal(providerCalls.some(call=>call.url.includes('/api/v1/flows')&&(call.options.method||'GET')!=='GET'),false);
});

test('customer membership uses the stored project and native Editor invitation only',async()=>{
  const calls=[];let reply={projectId,type:'PROJECT',status:'ACCEPTED',email:'owner@example.com'};
  const service=createTenantProjectService({query:async(_sql,values)=>({rows:values[0]==='company_alpha'?[{activepieces_project_id:projectId,provision_status:'ready'}]:[]}),activepiecesUrl:'https://ap.example',apiKey:'platform-secret',fetchImpl:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>reply};}});
  assert.deepEqual(await service.ensureMember({tenantId:'company_alpha',email:'Owner@Example.com'}),{projectId});
  assert.deepEqual(calls[0],{url:'https://ap.example/api/v1/user-invitations',body:{type:'PROJECT',email:'owner@example.com',projectId,projectRole:'Editor'}});
  for(const altered of [{projectId:'Z'.repeat(21)},{email:'foreign@example.com'},{type:'PLATFORM'},{status:'PENDING'}]){reply={projectId,type:'PROJECT',status:'ACCEPTED',email:'owner@example.com',...altered};await assert.rejects(()=>service.ensureMember({tenantId:'company_alpha',email:'owner@example.com'}),e=>e.code==='customer_membership_unverified');}
  const before=calls.length;await assert.rejects(()=>service.ensureMember({tenantId:'company_foreign',email:'owner@example.com'}),e=>e.code==='project_not_ready');assert.equal(calls.length,before);
});
