import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source=readFileSync(new URL('../app/chat.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../app/chat.html',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const empty={ok:true,company:'Server Company',brain:null,memory:[],team:[],recent_work:[],conversations:[]};
const employee={recordId:'employee-record-1',flowId:'flow-1',name:'سارة',role:'تسجيل الفرص',status:'active',tools:['gmail']};
const proof={recordId:'proof-record-1',employeeId:employee.recordId,flowId:employee.flowId,runId:'run-1',work_id:'work-1',subject:'فرصة أ',message:'سُجلت الفرصة',status:'succeeded',proof:'قراءة السجل مؤكدة'};

async function page({storage={siyadah_token:'customer-session',siyadah_company:'Untrusted Company'},hydrate=empty,message,work,employee_state,export:exportResponse,hash='#run=build&plan=over'}={}){
  const dom=new JSDOM(html,{url:'https://siyadah.test/app/chat.html'+hash,runScripts:'outside-only'});
  const w=dom.window,requests=[],alerts=[],polls=[];let hydrateTimer;
  w.matchMedia=()=>({matches:true,addEventListener(){}});
  w.PIECES=[['gmail','Gmail','Email','communication','https://example.test/logo.png','البريد']];
  w.SIYADAH_CHAT_GATEWAY='https://gateway.test/sync';
  Object.entries(storage).forEach(([k,v])=>w.localStorage.setItem(k,v));
  const realTimeout=w.setTimeout.bind(w);
  w.setTimeout=(cb,ms)=>{
    if(ms===2000||ms===5000){polls.push(cb);return 1000+polls.length;}
    if(ms===15000)hydrateTimer=cb;
    return realTimeout(cb,ms);
  };
  w.fetch=async(url,options)=>{
    const body=JSON.parse(options.body);requests.push({url,body,headers:options.headers});
    const handler={hydrate,message,work,employee_state,export:exportResponse}[body.op];
    const response=typeof handler==='function'?await handler(body):handler;
    if(response instanceof Error)throw response;
    if(response?.httpStatus)return {ok:false,status:response.httpStatus,json:async()=>response};
    return {ok:true,status:200,json:async()=>response};
  };
  w.alert=text=>alerts.push(text);w.eval(source);await flush();await flush();
  return {dom,w,d:w.document,requests,alerts,polls,timeout:()=>hydrateTimer(),close:()=>w.close()};
}
function send(p,text){p.d.querySelector('#input').value=text;p.d.querySelector('#send').click();}
function thread(p){return p.d.querySelector('#thread').textContent;}

test('offline authenticated boot clears demo data, billing and fake connections',async()=>{
  const p=await page({hydrate:Error('offline')});try{
    assert.equal(p.w.__SIY_REAL__,true);assert.equal(p.w.EMPS.length,0);assert.equal(p.w.MEM.length,0);assert.equal(p.w.ACTIONS.length,0);
    assert.equal(p.d.querySelectorAll('.hist[data-chat]').length,0);assert.match(thread(p),/تعذّر تحميل/);
    assert.equal(p.w.PLAN.state,'unknown');assert.equal(p.w.PLAN.invoices.length,0);
    assert.ok(!p.d.querySelector('#meBtn').textContent.includes('أنس'));assert.ok(!p.d.querySelector('#toolsCnt').textContent.includes('4 مربوطة'));
  }finally{p.close();}
});
test('token-only identity uses authenticated gateway without requiring company cache',async()=>{
  const p=await page({storage:{siyadah_token:'customer-session'}});try{
    assert.equal(p.w.__SIY_LOAD_ERROR__,'');assert.deepEqual(p.requests[0].body,{op:'hydrate'});
    assert.equal(p.requests[0].headers.Authorization,'Bearer customer-session');
    assert.ok(p.d.querySelector('#meBtn').textContent.includes('Server Company'));
  }finally{p.close();}
});
test('company cache without token stays real and does not send unauthenticated request',async()=>{
  const p=await page({storage:{siyadah_company:'Untrusted'}});try{
    assert.equal(p.w.__SIY_REAL__,true);assert.equal(p.w.EMPS.length,0);assert.equal(p.requests.length,0);assert.match(thread(p),/جلسة/);
  }finally{p.close();}
});
test('invalid/unauthorized hydration cannot restore demo or ready state',async()=>{
  for(const hydrate of [{ok:false,company:'Server Company',team:[]},{httpStatus:403},{ok:true,team:'invalid'}]){
    const p=await page({hydrate});try{assert.equal(p.w.EMPS.length,0);assert.ok(p.w.__SIY_LOAD_ERROR__);}finally{p.close();}
  }
});
test('late hydration after observation timeout does not replace failure with stale state',async()=>{
  let resolve;const delayed=new Promise(r=>resolve=r);const p=await page({hydrate:()=>delayed});try{
    p.timeout();resolve({...empty,team:[employee]});await flush();await flush();
    assert.equal(p.w.EMPS.length,0);assert.ok(p.w.__SIY_LOAD_ERROR__);
  }finally{p.close();}
});
test('central request mentioning report today reaches gateway and escapes consultant reply',async()=>{
  const p=await page({message:{ok:true,conversation_id:'conversation-1',reply:'استشارة <img src=x>\nسطر ثان'}});try{
    send(p,'أبي موظف يسوي تقرير اليوم');await flush();
    const req=p.requests.find(x=>x.body.op==='message');assert.ok(req);assert.equal(req.body.message,'أبي موظف يسوي تقرير اليوم');
    assert.equal(req.body.conversation_id,null);assert.equal(req.body.employee_id,null);assert.ok(req.body.request_id);
    for(const key of ['company_name','tenant_id','history','employees','flow_id'])assert.ok(!(key in req.body));
    assert.match(thread(p),/استشارة <img src=x>/);assert.equal(p.d.querySelectorAll('#thread img').length,0);
    assert.equal(p.d.querySelector('.hist[data-chat]').dataset.chat,'conversation-1');
  }finally{p.close();}
});
test('accepted work appears pending, then proof readback upserts stable employee without clearing chat',async()=>{
  const p=await page({message:{ok:true,conversation_id:'conversation-1',work_id:'work-1',work_status:'queued'},work:{ok:true,work_id:'work-1',work_status:'succeeded',reply:'سُجلت النتيجة.',employee,recent_work:[proof]}});try{
    send(p,'أنشئ موظف الفرص');await flush();assert.match(thread(p),/بانتظار التنفيذ/);assert.ok(!thread(p).includes('✓'));
    assert.equal(p.w.EMPS.length,0);assert.equal(p.polls.length,1);await p.polls.shift()();await flush();
    assert.equal(p.d.querySelector('#emps .emp').dataset.emp,employee.recordId);assert.equal(p.w.EMPS[0].flowId,employee.flowId);
    assert.match(thread(p),/أنشئ موظف الفرص/);assert.match(thread(p),/سُجلت النتيجة/);assert.match(thread(p),/✓ succeeded/);
    assert.equal(p.w.__SIY_DASH__.recent_work[0].runId,'run-1');assert.equal(p.polls.length,0);
  }finally{p.close();}
});
test('failed work with arbitrary proof text never renders success mark',async()=>{
  const p=await page({message:{ok:true,conversation_id:'c',work_id:'w',work_status:'failed',recent_work:[{...proof,status:'failed'}]}});try{
    send(p,'نفذ');await flush();assert.match(thread(p),/تعذّر إكمال/);assert.ok(!thread(p).includes('✓'));assert.equal(p.polls.length,0);
  }finally{p.close();}
});
test('ambiguous message timeout refreshes by original request ID without redispatch',async()=>{
  const p=await page({message:Error('offline'),work:{ok:true,conversation_id:'c',work_id:'w',work_status:'succeeded',reply:'تم استلام السؤال'}});try{
    send(p,'سؤال');await flush();assert.ok(p.d.querySelector('[data-siy-retry]'));
    p.d.querySelector('[data-siy-retry]').click();await flush();
    const reqs=p.requests.filter(x=>x.body.op==='message');assert.equal(reqs.length,1);
    const refresh=p.requests.find(x=>x.body.op==='work');assert.equal(refresh.body.request_id,reqs[0].body.request_id);
    assert.equal(refresh.body.conversation_id,null);assert.equal(p.d.querySelectorAll('[data-siy-retry]').length,0);
  }finally{p.close();}
});
test('response after changing conversation stays in original stored thread',async()=>{
  let resolve;const delayed=new Promise(r=>resolve=r);const p=await page({message:()=>delayed});try{
    send(p,'السؤال الأول');p.d.querySelector('#newChat').click();resolve({ok:true,conversation_id:'first-conversation',reply:'الجواب الأول'});await flush();
    assert.ok(!thread(p).includes('الجواب الأول'));p.d.querySelector('[data-chat="first-conversation"]').click();assert.match(thread(p),/الجواب الأول/);
  }finally{p.close();}
});
test('rehydration restores saved messages and employee selection sends record ID only',async()=>{
  const p=await page({hydrate:{...empty,team:[employee],conversations:[{id:'saved',title:'محفوظة',employee_id:employee.recordId,messages:[{role:'user',content:'طلب سابق',at:'09:00'},{role:'assistant',content:'رد محفوظ',at:'09:01'}]}]},message:{ok:true,conversation_id:'saved',reply:'جواب جديد'}});try{
    p.d.querySelector('[data-chat="saved"]').click();assert.match(thread(p),/رد محفوظ/);send(p,'أكمل');await flush();
    const req=p.requests.find(x=>x.body.op==='message');assert.equal(req.body.employee_id,employee.recordId);assert.equal(req.body.conversation_id,'saved');
    assert.ok(!('employee' in req.body));
  }finally{p.close();}
});
test('stable employee mapping rejects missing IDs and exact active status, no false stop/connect',async()=>{
  const xss='"><img src=x onerror=alert(1)>';const p=await page({hydrate:{...empty,team:[{...employee,name:xss,role:xss,status:'inactive'},{name:'missing ID'}]},employee_state:{httpStatus:403}});try{
    assert.equal(p.w.EMPS.length,1);assert.equal(p.w.EMPS[0].on,false);assert.equal(p.d.querySelectorAll('#emps img').length,0);
    p.d.querySelector('#emps .emp').click();const toggle=p.d.querySelector('#onSw');toggle.click();assert.equal(toggle.getAttribute('aria-checked'),'false');await flush();
    p.d.querySelector('[data-c="gmail"]').click();p.d.querySelector('#mGo').click();assert.match(p.d.querySelector('#mD').textContent,/لم يتم ربط/);
    assert.equal(p.requests.length,2);
  }finally{p.close();}
});
test('hydrate resumes pending work by work ID without resending the original message',async()=>{
  const p=await page({hydrate:{...empty,conversations:[{id:'c',title:'طلب جاري',messages:[]}],pending_work:[{work_id:'existing-work',conversation_id:'c',work_status:'running'}]},work:{ok:true,work_status:'succeeded',reply:'اكتمل'}});try{
    assert.equal(p.polls.length,1);await p.polls.shift()();assert.equal(p.requests.filter(x=>x.body.op==='message').length,0);
    assert.deepEqual(p.requests.find(x=>x.body.op==='work').body,{op:'work',work_id:'existing-work'});
  }finally{p.close();}
});
test('expired authorization stops polling instead of looping or resubmitting',async()=>{
  const p=await page({message:{ok:true,conversation_id:'c',work_id:'w',work_status:'running'},work:{httpStatus:403}});try{
    send(p,'نفذ');await flush();await p.polls.shift()();assert.equal(p.polls.length,0);assert.match(thread(p),/صلاحية/);
  }finally{p.close();}
});

test('employee header reflects matched verified run and persisted record',async()=>{
 const p=await page({hydrate:{...empty,team:[employee],recent_work:[proof]}});try{
  p.d.querySelector('#emps .emp').click();assert.match(p.d.querySelector('.pin__s').textContent,/آخر تشغيل ناجح ونتيجته محفوظة/);
  const refs=[...p.d.querySelectorAll('.siyrefs code')].map(x=>x.textContent);
  for(const id of [employee.recordId,employee.flowId,proof.work_id,proof.runId,proof.recordId])assert.ok(refs.includes(id));
 }finally{p.close();}
});
test('employee header does not infer success from another employee, flow, or incomplete proof',async()=>{
 for(const candidate of [{...proof,employeeId:'other'},{...proof,flowId:'other'},{...proof,status:'failed'},{...proof,runId:''},{...proof,recordId:''}]){
  const p=await page({hydrate:{...empty,team:[employee],recent_work:[candidate]}});try{
   p.d.querySelector('#emps .emp').click();assert.match(p.d.querySelector('.pin__s').textContent,/لم يُتحقق منه/);
  }finally{p.close();}
 }
});

test('reload restores employee conversation and its independently persisted proof',async()=>{
 const saved={...empty,team:[employee],conversations:[{id:'central-1',title:'استشارة',messages:[{role:'assistant',content:'رأي تجاري'}]},{id:'central-2',title:'إنشاء الموظف',messages:[{role:'assistant',content:'أنشأت الموظف'}]},{id:'employee-chat',title:'سجل الطلب',employee_id:employee.recordId,messages:[{role:'user',content:'سجل الطلب',at:'2026-09-09T07:57:12.000Z'},{role:'assistant',content:'تم حفظ الطلب',at:'2026-09-09T07:57:14.000Z'}]}],recent_work:[proof]};
 const p=await page({hydrate:saved});try{
  p.d.querySelector('#emps .emp').click();assert.match(p.d.querySelector('#whoN').textContent,/سارة/);assert.match(thread(p),/تم حفظ الطلب/);assert.match(thread(p),/قراءة السجل مؤكدة/);
  p.d.querySelector('#newChat').click();p.d.querySelector('[data-chat="employee-chat"]').click();assert.match(p.d.querySelector('#whoN').textContent,/سارة/);assert.match(thread(p),/قراءة السجل مؤكدة/);
  assert.equal(thread(p).split('قراءة السجل مؤكدة').length-1,1);
  assert.ok(!thread(p).includes('2026-09-09T'));assert.match(p.d.querySelector('.m--me .m__t').textContent,/^\d{2}:\d{2}$/);
 }finally{p.close();}
});

test('employee toggle waits for matching verified server readback before changing displayed state',async()=>{
 let resolve;const response=new Promise(r=>resolve=r);const p=await page({hydrate:{...empty,team:[employee]},employee_state:()=>response});try{
  p.d.querySelector('#emps .emp').click();p.d.querySelector('#onSw').click();
  assert.equal(p.d.querySelector('#onSw').getAttribute('aria-checked'),'true');assert.equal(p.d.querySelector('#onSw').disabled,true);assert.match(p.d.querySelector('#onLbl').textContent,/جارٍ التحقق/);
  p.d.querySelector('#onSw').click();assert.equal(p.requests.filter(r=>r.body.op==='employee_state').length,1);
  assert.deepEqual(p.requests.at(-1).body,{op:'employee_state',employee_id:employee.recordId,status:'disabled'});
  assert.equal(p.requests.at(-1).headers.Authorization,'Bearer customer-session');
  resolve({ok:true,state_verified:true,employee:{...employee,status:'disabled',flow_status_verified:false}});await flush();
  assert.equal(p.w.EMPS[0].on,false);assert.equal(p.d.querySelector('#onSw').getAttribute('aria-checked'),'false');assert.equal(p.d.querySelector('#onSw').disabled,false);
 }finally{p.close();}
});
test('failed or foreign employee toggle response preserves last confirmed state',async()=>{
 for(const response of [{httpStatus:403},{ok:true,state_verified:true,employee:{...employee,recordId:'other-owner-record',status:'disabled'}},{ok:true,state_verified:true,employee:{...employee,flowId:'other-flow',status:'disabled'}},{ok:true,employee:{...employee,status:'disabled'}}]){
  const p=await page({hydrate:{...empty,team:[employee]},employee_state:response});try{
   p.d.querySelector('#emps .emp').click();p.d.querySelector('#onSw').click();await flush();
   assert.equal(p.w.EMPS.length,1);assert.equal(p.w.EMPS[0].id,employee.recordId);assert.equal(p.w.EMPS[0].on,true);assert.equal(p.d.querySelector('#onSw').disabled,false);assert.match(p.alerts.at(-1),/آخر حالة مؤكدة/);
  }finally{p.close();}
 }
});
test('disabled employee can be re-enabled only after verified readback',async()=>{
 const p=await page({hydrate:{...empty,team:[{...employee,status:'disabled'}]},employee_state:{ok:true,state_verified:true,employee:{...employee,status:'active',flow_status_verified:true}}});try{
  p.d.querySelector('#emps .emp').click();p.d.querySelector('#onSw').click();await flush();assert.equal(p.requests.at(-1).body.status,'active');assert.equal(p.w.EMPS[0].on,true);
 }finally{p.close();}
});

test('two saved employee conversations reopen and send to the clicked conversation only',async()=>{
 const p=await page({hydrate:{...empty,team:[employee],conversations:[
  {id:'older',title:'الأولى',employee_id:employee.recordId,messages:[{role:'assistant',content:'الرد الأول'}]},
  {id:'newer',title:'الثانية',employee_id:employee.recordId,messages:[{role:'assistant',content:'الرد الثاني'}]}
 ]},message:body=>({ok:true,conversation_id:body.conversation_id,reply:'رد على '+body.conversation_id})});try{
  p.d.querySelector('[data-chat="older"]').click();assert.match(thread(p),/الرد الأول/);assert.ok(!thread(p).includes('الرد الثاني'));
  send(p,'أكمل الأولى');await flush();assert.equal(p.requests.at(-1).body.conversation_id,'older');assert.equal(p.requests.at(-1).body.employee_id,employee.recordId);
  p.d.querySelector('[data-chat="newer"]').click();assert.match(thread(p),/الرد الثاني/);assert.ok(!thread(p).includes('أكمل الأولى'));
  send(p,'أكمل الثانية');await flush();assert.equal(p.requests.at(-1).body.conversation_id,'newer');
  p.d.querySelector('[data-chat="older"]').click();assert.match(thread(p),/رد على older/);assert.ok(!thread(p).includes('أكمل الثانية'));
 }finally{p.close();}
});
test('real saved instructions escape content and distinguish stored autonomy from enforced approval',async()=>{
 for(const [autonomy,label] of [['يستأذن','يستأذنك أولًا'],['ينفّذ ويبلغك','ينفّذ ويبلغك'],['يقترح فقط','يقترح فقط'],[undefined,'غير محددة']]){
  const p=await page({hydrate:{...empty,team:[{...employee,autonomy,instructions:'راجع <img src=x onerror=alert(1)>',rules:['لا ترسل <script>'],how:['وعد غير مثبت']}]}});try{
   p.d.querySelector('#emps .emp').click();p.d.querySelector('#instrTgl').click();const instructions=p.d.querySelector('#instrWrap');
   assert.match(instructions.textContent,new RegExp(label));assert.match(instructions.textContent,/لم يُتحقق منه/);
   assert.equal(instructions.querySelector('textarea').readOnly,true);assert.ok(!instructions.querySelector('img,script'));
   for(const fabricated of ['شركة الأفق','تسري فورًا','كذا يشتغل فعلًا','وعد غير مثبت'])assert.ok(!instructions.textContent.includes(fabricated));
   assert.ok(!p.d.querySelector('[data-tip="يستأذنك في القرارات الحساسة"]'));
  }finally{p.close();}
 }
});

test('restored proofs match conversation and legacy evidence is labelled separately',async()=>{
 const p=await page({hydrate:{...empty,team:[employee],conversations:[{id:'c-here',title:'محفوظة',employee_id:employee.recordId,messages:[]}],recent_work:[
  {...proof,recordId:'scoped',conversation_id:'c-here',subject:'دليل هذه المحادثة'},
  {...proof,recordId:'elsewhere',conversation_id:'c-other',subject:'دليل محادثة أخرى'},
  {...proof,recordId:'legacy',subject:'دليل قديم'}
 ]}});try{
  p.d.querySelector('[data-chat="c-here"]').click();assert.match(thread(p),/دليل هذه المحادثة/);assert.ok(!thread(p).includes('دليل محادثة أخرى'));assert.match(thread(p),/نشاط سابق للموظف — غير مرتبط بهذه المحادثة/);assert.match(thread(p),/دليل قديم/);
 }finally{p.close();}
});

test('explicit cancel after timeout has a new request ID and targets prior request without replay',async()=>{
 let calls=0;
 const p=await page({message:body=>++calls===1?Error('timeout'):{ok:true,conversation_id:'cancel-c',reply:'طلب الإلغاء قيد التحقق'},work:{ok:true,request_status:'not_observed',work_status:'unknown'}});try{
  send(p,'أنشئ الموظف');await flush();const first=p.requests.find(x=>x.body.op==='message').body;
  send(p,'ألغ طلبي السابق');await flush();const messages=p.requests.filter(x=>x.body.op==='message');
  assert.equal(messages.length,2);assert.notEqual(messages[1].body.request_id,first.request_id);assert.equal(messages[1].body.prior_request_id,first.request_id);
  assert.equal(messages[1].body.message,'ألغ طلبي السابق');assert.equal(p.alerts.length,0);
  p.d.querySelector('[data-siy-retry]').click();await flush();assert.equal(p.requests.filter(x=>x.body.op==='message').length,2);
  assert.equal(p.requests.at(-1).body.request_id,first.request_id);assert.match(thread(p),/حالته غير معروفة/);assert.ok(p.d.querySelector('[data-siy-retry]'));
 }finally{p.close();}
});

test('customer export downloads only valid server bundle using authenticated request and releases URL',async()=>{
 const bundle={schemaVersion:1,kind:'siyadah_customer_bundle',company:{name:'Server Company'},employees:[],manifest:{complete:false}};
 const p=await page({export:{ok:true,export:bundle,filename:'ملف-العميل.json'}});try{
  const blobs=[],revoked=[],links=[];p.w.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:test';};p.w.URL.revokeObjectURL=url=>revoked.push(url);
  p.w.HTMLAnchorElement.prototype.click=function(){links.push({href:this.href,download:this.download});};
  p.d.querySelector('#exportBtn').click();await flush();
  const request=p.requests.find(r=>r.body.op==='export');assert.deepEqual(request.body,{op:'export'});assert.equal(request.headers.Authorization,'Bearer customer-session');
  assert.equal(blobs.length,1);assert.match(blobs[0].type,/application.json/);assert.deepEqual(links,[{href:'blob:test',download:'ملف-العميل.json'}]);assert.deepEqual(revoked,['blob:test']);
  const exported=await new Promise((resolve,reject)=>{const reader=new p.w.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsText(blobs[0]);});assert.deepEqual(JSON.parse(exported),bundle);
  assert.equal(p.d.querySelector('#exportBtn').disabled,false);assert.equal(p.d.querySelector('a[download]'),null);
 }finally{p.close();}
});
test('export rejects errors and malformed schema without producing fake download',async()=>{
 for(const response of [{httpStatus:403},{ok:true,export:{schemaVersion:2,kind:'siyadah_customer_bundle',company:{}}},{ok:true,export:{schemaVersion:1,kind:'wrong',company:{}}},{ok:true,export:{schemaVersion:1,kind:'siyadah_customer_bundle'}}]){
  const p=await page({export:response});try{let downloads=0;p.w.URL.createObjectURL=()=>{downloads++;return 'blob:test';};p.d.querySelector('#exportBtn').click();await flush();assert.equal(downloads,0);assert.equal(p.alerts.length,1);assert.equal(p.d.querySelector('#exportBtn').disabled,false);}finally{p.close();}
 }
});
test('real settings are read-only and remove demo file counts and unconditional consent',async()=>{
 const p=await page();try{
  assert.equal(p.d.querySelector('input[aria-label="اسم الشركة"]').readOnly,true);assert.equal(p.d.querySelector('input[aria-label="وش تقدمون — سطر واحد"]').readOnly,true);
  assert.ok(!p.d.querySelector('#pane-settings').textContent.includes('3 ملفات'));assert.ok(!p.d.querySelector('#pane-settings').textContent.includes('من هنا يجاوب فهد'));
  assert.ok(!p.d.querySelector('.comp__f').textContent.includes('ما يتحرك شيء بدون موافقتك'));
 }finally{p.close();}
});

test('company knowledge panel shows owned facts with source time and partial coverage without demo data',async()=>{
 const p=await page({hydrate:{...empty,owned_knowledge:{schemaVersion:1,companyId:'owner-1',coverage:'partial',lastSuccessAt:'2026-09-09T10:00:00Z',lastError:null,facts:[{key:'price',topic:'السعر',value:'1200 <img src=x>',sourceKind:'user',certainty:'user_confirmed',observedAt:'2026-09-09T09:00:00Z'},{key:'service',topic:'خدمة',value:'الصيانة',sourceKind:'company_website',sourceUrl:'https://company.test/service',certainty:'observed',observedAt:'2026-09-08T09:00:00Z'}]}}});try{
  p.d.querySelector('#memTgl').click();const panel=p.d.querySelector('#memList');assert.match(panel.textContent,/1200 <img src=x>/);assert.match(panel.textContent,/من رسائلك/);assert.match(panel.textContent,/https:\/\/company.test\/service/);assert.match(panel.textContent,/تغطية جزئية/);assert.match(panel.textContent,/آخر تحديث ناجح/);assert.ok(!panel.querySelector('img,script,[data-mdel]'));assert.match(panel.textContent,/صححها في شات سيادة/);assert.equal(p.requests.length,1);
 }finally{p.close();}
});
test('missing invalid and empty owned knowledge distinguish unavailable from empty without invented counts',async()=>{
 for(const [knowledge,expected] of [[undefined,'لم تصل المعرفة'],[{schemaVersion:2,companyId:'owner',facts:[]},'لم تصل المعرفة'],[{schemaVersion:1,companyId:'owner',facts:[],coverage:'partial',lastError:'private internal details'},'لا توجد حقائق محفوظة']]){
  const p=await page({hydrate:{...empty,owned_knowledge:knowledge}});try{p.d.querySelector('#memTgl').click();const panel=p.d.querySelector('#memList');assert.match(panel.textContent,new RegExp(expected));assert.ok(!panel.textContent.includes('private internal details'));assert.ok(!panel.textContent.includes('3 ملفات'));}finally{p.close();}
 }
});

test('paused employee answer keeps polling until final succeeded response with no execution proof',async()=>{
 let checks=0;const p=await page({hydrate:{...empty,team:[{...employee,status:'disabled'}],conversations:[{id:'paused-conv',employee_id:employee.recordId,title:'موظف متوقف',messages:[]}]},message:{ok:true,conversation_id:'paused-conv',work_id:'paused-work',work_status:'running',employee_id:null,recent_work:[]},work:()=>++checks===1?{ok:true,conversation_id:'paused-conv',work_id:'paused-work',work_status:'running',reply:'',recent_work:[]}:{ok:true,conversation_id:'paused-conv',work_id:'paused-work',work_status:'succeeded',reply:'موظف استقبال طلبات الصيانة معطّل حاليًا',recent_work:[]}});try{
  p.d.querySelector('[data-chat="paused-conv"]').click();send(p,'شغّل الطلب');await flush();assert.match(thread(p),/العمل قيد التنفيذ/);assert.equal(p.polls.length,1);
  await p.polls.shift()();assert.equal(p.polls.length,1);await p.polls.shift()();assert.equal(p.polls.length,0);assert.match(thread(p),/معطّل حاليًا/);assert.ok(!thread(p).includes('العمل قيد التنفيذ'));assert.equal(p.requests.filter(r=>r.body.op==='message').length,1);
 }finally{p.close();}
});

test('knowledge pricing facts retain distinct evidence labels and hide technical topic and key IDs',async()=>{
 const facts=[{key:'opaque-1',topic:'pricing',value:'1200',evidenceQuote:'سعر عقد الصيانة 1200 ريال',sourceKind:'user'},{key:'opaque-2',topic:'pricing',value:'750',evidenceQuote:'تكلفته المتغيرة 750 ريال <img src=x>',sourceKind:'user'},{key:'opaque-3',topic:'internal_topic',value:'قيمة محفوظة',sourceKind:'user'}];
 const p=await page({hydrate:{...empty,owned_knowledge:{schemaVersion:1,companyId:'owner',facts,coverage:'partial'}}});try{
  p.d.querySelector('#memTgl').click();const panel=p.d.querySelector('#memList');assert.match(panel.textContent,/الأسعار والتكاليف/);assert.match(panel.textContent,/سعر عقد الصيانة 1200 ريال/);assert.match(panel.textContent,/تكلفته المتغيرة 750 ريال <img src=x>/);assert.match(panel.textContent,/قيمة محفوظة/);assert.ok(!panel.querySelector('img'));for(const key of ['pricing','internal_topic','opaque-'])assert.ok(!panel.textContent.includes(key));
 }finally{p.close();}
});

test('real billing stays unknown despite actual employees and work evidence without invented quotas',async()=>{
 const p=await page({hydrate:{...empty,team:[employee,{...employee,recordId:'second'}],recent_work:[proof]}});try{
  const plan=p.d.querySelector('#pane-plan');assert.match(plan.textContent,/بيانات الاشتراك غير متاحة/);assert.match(plan.textContent,/الاستخدام غير متحقق/);assert.match(plan.textContent,/2 موظف مسجل/);
  for(const claim of ['تنتهي خلال','9 أيام','0 /','ر.س','يتجدد'])assert.ok(!plan.textContent.includes(claim));
  assert.equal(p.w.PLAN.actions.used,null);assert.equal(p.d.querySelector('#pban').hidden,true);assert.equal(plan.querySelector('[role="progressbar"]'),null);
  p.w.PLAN.state='over';p.w.renderPlan();assert.equal(p.d.querySelector('#pban').hidden,true);
  assert.ok(!p.d.querySelector('#dataDescription').textContent.includes('تدرّب'));
 }finally{p.close();}
});
test('unavailable actions cannot mutate and hiring opens central composer without sending',async()=>{
 const p=await page({hydrate:{...empty,team:[employee]}});try{
  p.d.querySelector('#emps .emp').click();p.d.querySelector('[data-open="plan"]').click();
  const unavailable=[p.d.querySelector('#attachBtn'),p.d.querySelector('#deleteAccountBtn'),...p.d.querySelectorAll('#pane-plan button[disabled]')];
  assert.equal(unavailable.length,4);for(const button of unavailable){assert.equal(button.disabled,true);button.click();}
  assert.match(p.d.querySelector('#attachBtn').getAttribute('aria-label'),/غير متاح/);assert.equal(p.requests.length,1);
  p.d.querySelector('#hireFromPlan').click();assert.equal(p.d.activeElement.id,'input');assert.match(p.d.querySelector('#input').placeholder,/مهمة الموظف/);assert.equal(p.requests.length,1);assert.equal(p.d.querySelector('#thread').classList.contains('thread--emp'),false);
  assert.equal(p.d.querySelector('#exportBtn').disabled,false);
 }finally{p.close();}
});
test('historical demo keeps its original plan and controls separate from real account restrictions',async()=>{
 const p=await page({storage:{},hash:''});try{
  assert.ok(!p.w.__SIY_REAL__);assert.equal(p.d.querySelector('#attachBtn').disabled,false);assert.equal(p.d.querySelector('#deleteAccountBtn').disabled,false);assert.ok(!p.d.querySelector('#pane-plan').textContent.includes('بيانات الاشتراك غير متاحة'));assert.equal(p.requests.length,0);
 }finally{p.close();}
});

test('real deep link say prefills central composer and cannot submit without explicit user send',async()=>{
 const text='أنشئ موظفًا ثم شغله';
 const p=await page({hash:'#e=employee-record-1&say='+encodeURIComponent(text),hydrate:{...empty,team:[employee]},message:{ok:true,conversation_id:'explicit',reply:'وصل طلبك'}});try{
  await new Promise(resolve=>setTimeout(resolve,240));assert.equal(p.requests.length,1);assert.equal(p.requests[0].body.op,'hydrate');assert.equal(p.d.querySelector('#input').value,text);assert.equal(p.d.activeElement.id,'input');assert.equal(p.d.querySelector('#thread').classList.contains('thread--emp'),false);
  p.d.querySelector('#send').click();await flush();const req=p.requests.find(r=>r.body.op==='message');assert.equal(req.body.message,text);assert.equal(req.body.employee_id,null);assert.equal(p.requests.filter(r=>r.body.op==='message').length,1);
 }finally{p.close();}
});

test('real notifications are unavailable without channel or scheduled delivery claims',async()=>{
 const p=await page();try{
  const control=p.d.querySelector('#notificationSwitch'),row=control.closest('.srow');
  assert.equal(control.disabled,true);assert.equal(control.getAttribute('aria-checked'),'false');assert.match(row.textContent,/الإشعارات غير متاحة/);
  for(const claim of ['واتساب + بريد','ملخص يومي','تنبيه عند'])assert.ok(!row.textContent.includes(claim));
  control.click();assert.equal(p.requests.length,1);assert.equal(control.getAttribute('aria-checked'),'false');
 }finally{p.close();}
 const demo=await page({storage:{},hash:''});try{assert.equal(demo.d.querySelector('#notificationSwitch').disabled,false);assert.equal(demo.d.querySelector('#notificationSwitch').getAttribute('aria-checked'),'true');}finally{demo.close();}
});
