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

test('runs only an enabled company-owned flow and matches proof to the request marker',async()=>{
  const flowId='F12345678901234567890',runId='R12345678901234567890',row={tenant_id:'company_alpha',external_id:'siyadah:company_alpha',activepieces_project_id:projectId,display_name:'شركة ألف',provision_status:'ready'};
  const calls=[];
  const service=createTenantProjectService({
    query:async()=>({rows:[row]}),activepiecesUrl:'https://activepieces.example',apiKey:'secret',
    fetchImpl:async(url,options={})=>{
      calls.push({url,options});
      if(url.endsWith(`/api/v1/flows/${flowId}`))return {ok:true,status:200,json:async()=>({id:flowId,projectId,status:'ENABLED',version:{trigger:{nextAction:{type:'PIECE',name:'step_1',settings:{pieceName:'@activepieces/piece-http',actionName:'send_request'}}}}})};
      if(url.endsWith(`/api/v1/webhooks/${flowId}`))return {ok:true,status:200,json:async()=>({})};
      if(url.includes('/api/v1/flow-runs?'))return {ok:true,status:200,json:async()=>({data:[{id:runId,flowId,projectId,created:new Date().toISOString()}]})};
      if(url.endsWith(`/api/v1/flow-runs/${runId}`))return {ok:true,status:200,json:async()=>({id:runId,flowId,projectId,status:'SUCCEEDED',startTime:'2026-09-30T05:00:00Z',finishTime:'2026-09-30T05:00:01Z',steps:{trigger:{output:{body:{requestId:'request-1'}}},step_1:{output:{status:200,body:{ok:true,state:'completed',transaction_id:'tx-123'}}}}})};
      throw new Error(`unexpected ${url}`);
    },
  });
  let dispatches=0;
  const proof=await service.runFlow({tenantId:'company_alpha',flowId,requestId:'request-1',message:'نفذ المهمة',onDispatch:()=>{dispatches++;},verifyProviderResult:({actions})=>{
    const body=actions.at(-1)?.output?.body;
    return body?.ok===true&&body.state==='completed'&&typeof body.transaction_id==='string'?{verified:true,receiptId:body.transaction_id}:null;
  }});
  assert.equal(proof.runId,runId);assert.equal(proof.projectId,projectId);assert.equal(proof.result.status,200);assert.equal(proof.tool.pieceName,'@activepieces/piece-http');
  assert.equal(proof.result.receiptId,'tx-123');assert.equal(dispatches,1);
  const webhook=JSON.parse(calls.find(call=>call.url.includes('/webhooks/')).options.body);assert.deepEqual(webhook,{requestId:'request-1',task:'نفذ المهمة'});
  assert.equal(calls.find(call=>call.url.includes('/webhooks/')).options.headers.Authorization,undefined);
});

function runHarness({status='SUCCEEDED',steps,action,runProjectId=projectId,runFlowId='F12345678901234567890',candidateProjectId=projectId}={}){
  const flowId='F12345678901234567890',runId='R12345678901234567890';
  const row={tenant_id:'company_alpha',activepieces_project_id:projectId,provision_status:'ready'};
  const flowAction=action===undefined?{type:'PIECE',name:'step_1',settings:{pieceName:'@activepieces/piece-http',actionName:'send_request'}}:action;
  const runSteps=steps===undefined?{trigger:{output:{body:{requestId:'request-1'}}},step_1:{output:{status:200,body:{ok:true}}}}:steps;
  const calls=[];
  const service=createTenantProjectService({
    query:async()=>({rows:[row]}),activepiecesUrl:'https://activepieces.example',apiKey:'secret',
    fetchImpl:async(url,options={})=>{
      calls.push({url,options});
      if(url.endsWith(`/api/v1/flows/${flowId}`))return {ok:true,status:200,json:async()=>({id:flowId,projectId,status:'ENABLED',version:{trigger:{nextAction:flowAction}}})};
      if(url.endsWith(`/api/v1/webhooks/${flowId}`))return {ok:true,status:200,json:async()=>({})};
      if(url.includes('/api/v1/flow-runs?'))return {ok:true,status:200,json:async()=>({data:[{id:runId,flowId,projectId:candidateProjectId,created:new Date().toISOString()}]})};
      if(url.endsWith(`/api/v1/flow-runs/${runId}`))return {ok:true,status:200,json:async()=>({id:runId,flowId:runFlowId,projectId:runProjectId,status,steps:runSteps})};
      throw new Error(`unexpected ${url}`);
    }
  });
  return {service,calls,flowId};
}

const runInput=flowId=>({tenantId:'company_alpha',flowId,requestId:'request-1',message:'نفذ المهمة'});
const rejectsCode=code=>error=>error instanceof TenantProjectError&&error.code===code;

test('does not report a successful run when its required action output is absent',async()=>{
  const h=runHarness({steps:{trigger:{output:{body:{requestId:'request-1'}}},step_1:{}}});
  await assert.rejects(()=>h.service.runFlow(runInput(h.flowId)),rejectsCode('provider_result_unverified'));
});

test('HTTP 2xx alone cannot prove a provider outcome',async()=>{
  for(const [status,body] of [[200,{ok:false}],[202,{ok:true,state:'accepted'}],[200,'not-json'],[200,null],[200,{ok:true}]]){
    const h=runHarness({steps:{trigger:{output:{body:{requestId:'request-1'}}},step_1:{output:{status,body}}}});
    await assert.rejects(()=>h.service.runFlow(runInput(h.flowId)),error=>{
      assert.equal(error.code,'provider_result_unverified');
      assert.deepEqual(error.transportReceipt,{runId:'R12345678901234567890',flowId:h.flowId,projectId,httpStatus:status,receivedAt:null,outcome:'unverified'});
      return true;
    });
    await assert.rejects(()=>h.service.runFlow({...runInput(h.flowId),verifyProviderResult:()=>({verified:true})}),rejectsCode('provider_result_unverified'));
  }
});

test('dispatch callback runs only after preflight and before webhook',async()=>{
  const order=[],h=runHarness();
  const original=h.calls.push.bind(h.calls);
  h.calls.push=(call)=>{if(call.url.includes('/webhooks/'))order.push('webhook');return original(call);};
  await assert.rejects(()=>h.service.runFlow({...runInput(h.flowId),onDispatch:()=>order.push('dispatch')}),rejectsCode('provider_result_unverified'));
  assert.deepEqual(order,['dispatch','webhook']);
  const invalid=runHarness({action:{type:'CODE',name:'step_1',settings:{}}}),events=[];
  await assert.rejects(()=>invalid.service.runFlow({...runInput(invalid.flowId),onDispatch:()=>events.push('dispatch')}),rejectsCode('provider_result_unverified'));
  assert.deepEqual(events,[]);assert.equal(invalid.calls.some(call=>call.url.includes('/webhooks/')),false);
  const callbackFails=runHarness();
  await assert.rejects(()=>callbackFails.service.runFlow({...runInput(callbackFails.flowId),onDispatch:()=>{throw new Error('ledger unavailable');}}),/ledger unavailable/);
  assert.equal(callbackFails.calls.some(call=>call.url.includes('/webhooks/')),false);
});

test('treats paused and canceled runs as non-successful',async()=>{
  for(const [status,code] of [['PAUSED','flow_run_paused'],['CANCELED','flow_run_failed'],['CANCELLED','flow_run_failed']]){
    const h=runHarness({status});
    await assert.rejects(()=>h.service.runFlow(runInput(h.flowId)),rejectsCode(code));
  }
});

test('rejects an HTTP action failure despite a successful Activepieces run',async()=>{
  for(const status of [302,400,500]){
    const h=runHarness({steps:{trigger:{output:{body:{requestId:'request-1'}}},step_1:{output:{status,body:{error:'failed'}}}}});
    await assert.rejects(()=>h.service.runFlow(runInput(h.flowId)),rejectsCode('provider_action_failed'));
  }
});

test('does not infer provider success from a non-HTTP action output',async()=>{
  const h=runHarness({action:{type:'PIECE',name:'step_1',settings:{pieceName:'@activepieces/piece-slack',actionName:'send_message'}}});
  await assert.rejects(()=>h.service.runFlow(runInput(h.flowId)),rejectsCode('provider_result_unverified'));
  assert.equal(h.calls.some(call=>call.url.includes('/webhooks/')),false);
});

test('does not trigger unsupported or malformed action chains',async()=>{
  for(const action of [null,{type:'CODE',name:'step_1',settings:{}},{type:'PIECE',name:'step_1',settings:{pieceName:'@activepieces/piece-http'},nextAction:{type:'PIECE',name:'step_1',settings:{pieceName:'@activepieces/piece-http'}}}]){
    const h=runHarness({action});
    await assert.rejects(()=>h.service.runFlow(runInput(h.flowId)),error=>error.code==='provider_result_unverified'&&error.message.includes('لم نبدأ التشغيل')&&!error.transportReceipt);
    assert.equal(h.calls.some(call=>call.url.includes('/webhooks/')),false);
  }
});

test('rejects a run whose readback belongs to another project or flow',async()=>{
  for(const values of [{runProjectId:'Z12345678901234567890'},{runFlowId:'Z12345678901234567890'}]){
    const h=runHarness(values);
    await assert.rejects(()=>h.service.runFlow(runInput(h.flowId)),rejectsCode('flow_run_project_mismatch'));
  }
});

test('checks every HTTP action before returning the final response',async()=>{
  const action={type:'PIECE',name:'step_1',settings:{pieceName:'@activepieces/piece-http',actionName:'first'},nextAction:{type:'PIECE',name:'step_2',settings:{pieceName:'@activepieces/piece-http',actionName:'second'}}};
  const h=runHarness({action,steps:{trigger:{output:{body:{requestId:'request-1'}}},step_1:{output:{status:200,body:{ok:true}}},step_2:{output:{status:201,body:{ok:true,state:'completed',transaction_id:'tx-456'}}}}});
  const result=await h.service.runFlow({...runInput(h.flowId),verifyProviderResult:({actions})=>actions.length===2&&actions[0].output.body.ok===true&&actions[1].output.body.state==='completed'?{verified:true,receiptId:actions[1].output.body.transaction_id}:null});
  assert.deepEqual(result.result,{status:201,body:{ok:true,state:'completed',transaction_id:'tx-456'},receiptId:'tx-456'});
  const missing=runHarness({action,steps:{trigger:{output:{body:{requestId:'request-1'}}},step_1:{output:{status:200,body:{ok:true}}}}});
  await assert.rejects(()=>missing.service.runFlow(runInput(missing.flowId)),rejectsCode('provider_result_unverified'));
});
