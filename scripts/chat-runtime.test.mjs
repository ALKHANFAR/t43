import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source=readFileSync(new URL('../app/chat.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../app/chat.html',import.meta.url),'utf8');
const onboardingHtml=readFileSync(new URL('../app/onboard.html',import.meta.url),'utf8');
const onboardingSource=readFileSync(new URL('../app/onboard.js',import.meta.url),'utf8');
const serverSource=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const empty={ok:true,company:'Server Company',brain:null,memory:[],team:[],recent_work:[],conversations:[]};
const employee={recordId:'employee-record-1',flowId:'flow-1',name:'سارة',role:'تسجيل الفرص',status:'active',tools:['gmail']};
const proof={recordId:'proof-record-1',employeeId:employee.recordId,flowId:employee.flowId,runId:'run-1',work_id:'work-1',subject:'فرصة أ',message:'سُجلت الفرصة',status:'succeeded',proof:'قراءة السجل مؤكدة'};

test('chat UI never bypasses Siyadah with a direct Activepieces webhook',()=>{
  assert.ok(!source.includes('activepieces-p8l1-455.up.railway.app/api/v1/webhooks'));
  assert.match(source,/SIYADAH_CHAT_GATEWAY\|\|"\/siyadah-api\/v1\/chat"/);
  assert.ok(!source.includes('localStorage.getItem("siyadah_token")'));
});

test('browser has no direct execution client or project selection path',()=>{
  assert.ok(!html.includes('activepieces-mcp.js'));
  assert.ok(!source.includes('SiyadahActivepiecesMcp'));
  assert.ok(!source.includes('projectId'));
  assert.ok(!source.includes('tenantId'));
});

test('customer shell hides implementation brands and forbidden legacy dependency',()=>{
  assert.doesNotMatch(html,/>\s*(?:Activepieces|MCP|Flow)\b/i);
  assert.doesNotMatch([html,source,onboardingHtml,onboardingSource,serverSource].join('\n'),/\b77766\b/);
  assert.match(html,/الأدوات والربط/);
  assert.doesNotMatch(onboardingHtml,/مسودة الموظف|<small>مسودة<\/small>/);
});

test('customer tool catalog excludes the execution platform while retaining useful tools',async()=>{
  const pieces=[
    ['activepieces','Activepieces Platform','Automation engine','developer','https://example.test/platform.png','إدارة الأتمتة'],
    ['gmail','Gmail','Email','communication','https://example.test/gmail.png','البريد'],
  ];
  const p=await page({pieces});try{
    p.d.querySelector('#toolsLink').click();await flush();
    p.d.querySelector('#allTgl').click();await flush();
    const visible=thread(p);
    assert.doesNotMatch(visible,/Activepieces Platform|إدارة الأتمتة/);
    assert.match(visible,/Gmail/);
    assert.match(visible,/1 أداة/);
  }finally{p.close();}
});

test('customer integrations API does not expose internal pilot inventory',()=>{
  assert.ok(!serverSource.includes("input.op==='pilot_discover'"));
  assert.ok(!serverSource.includes('createPilotToolDiscovery'));
});

test('selected real employee opens without placeholder metrics or invented activity',async()=>{
  const draft={...employee,status:'disabled',tools:[]};
  const p=await page({hash:'#e='+encodeURIComponent(draft.recordId),hydrate:{...empty,team:[draft]}});try{
    assert.equal(p.d.querySelector('#whoN').textContent,'سارة · تسجيل الفرص');
    assert.equal(p.d.querySelector('#kpiTgl'),null);
    assert.doesNotMatch(thread(p),/بيانات الموظف من سجل الشركة/);
    assert.match(p.d.querySelector('.pin__s').textContent,/مسودة محفوظة/);
    assert.equal(p.d.querySelector('#onSw').disabled,true);
    p.d.querySelector('#reviewStart').click();
    assert.equal(p.d.querySelector('#instrWrap').hidden,false);
    assert.equal(p.d.querySelector('#reviewStart').getAttribute('aria-expanded'),'true');
    assert.equal(p.d.querySelector('#instrTgl'),null);
    assert.equal(p.d.querySelector('#draftTools')?.textContent,'الأدوات والربط');
    p.d.querySelector('#draftTools').click();
    assert.equal(p.d.querySelector('#whoN').textContent,'الأدوات');
  }finally{p.close();}
});

test('routine draft work skips approval while an MCP action is approval gated',()=>{
  assert.match(serverSource,/createManualEmployeeDraft/);
  assert.match(serverSource,/لم تُجهّز أدواته ولم يبدأ العمل بعد/);
  assert.match(serverSource,/if\(input\.op==='approve'\)/);
  assert.match(serverSource,/mcp\.consume\(\{tenantId:companyId,conversationId,id:approvalId\}\)/);
});

test('employee MCP response remains unverified without provider proof',()=>{
  assert.match(serverSource,/if\(answer\.flowToolAttempted\|\|answer\.effects\?\.length\)return finish\(200,\{[^\n]+completedToolActions\(answer\)/);
  assert.doesNotMatch(serverSource,/const proof=\{[^\n]+conversation_id:conversationId/);
});

test('chat shows only safe tool receipt metadata while the request remains unverified',async()=>{
  const response={ok:true,conversation_id:'c',request_status:'not_observed',work_status:'unknown',outcome_kind:'unverified',reply:'تعذر التأكد من النتيجة.',tool_receipts:[{name:'ap_run_action',status:'error',private:'secret'},{name:'<bad>',status:'returned'}]};
  const p=await page({message:response});try{
    send(p,'افحص الأداة');await flush();
    const details=p.d.querySelector('#thread details.plan');
    assert.ok(details);
    assert.match(details.textContent,/استدعاءات الأدوات · 2/);
    assert.match(details.textContent,/تعذّر الاستدعاء/);
    assert.match(details.textContent,/رد الأداة وحده لا يثبت نتيجة الخدمة/);
    assert.doesNotMatch(details.textContent,/secret/);
    assert.equal(details.querySelector('bad'),null);
  }finally{p.close();}
});

async function page({storage={},session={},locale,hydrate=empty,message,work,approve,employee_state,employee_instructions,resume_employee_activation={ok:true,activation_status:'none'},add_knowledge,update_company_settings,export:exportResponse,integrations={list:{ok:true,connections:[]}},integrationStatus={ok:true,connected:false},integrationConnect,mcpStatus={ok:true,state:'authorization_stored',liveVerified:false},mcpConnect,hash='#run=build&plan=over',real=true,pieces=[['gmail','Gmail','Email','communication','https://example.test/logo.png','البريد',{pieceName:'@activepieces/piece-gmail'}]]}={}){
  const dom=new JSDOM(html,{url:'https://siyadah.test/app/chat.html'+hash,runScripts:'outside-only'});
  const w=dom.window,requests=[],activationRequests=[],alerts=[],polls=[],navigations=[];let hydrateTimer;
  w.matchMedia=()=>({matches:true,addEventListener(){}});
  w.PIECES=pieces;
  w.SIYADAH_REAL_ACCOUNT=real;
  w.SIYADAH_CHAT_GATEWAY='https://gateway.test/sync';
  Object.entries(session).forEach(([k,v])=>w.sessionStorage.setItem(k,v));
  if(locale)w.sessionStorage.setItem('siyadah_locale',locale);
  Object.entries(storage).forEach(([k,v])=>w.localStorage.setItem(k,v));
  const realTimeout=w.setTimeout.bind(w);
  w.setTimeout=(cb,ms)=>{
    if(ms===2000||ms===5000){polls.push(cb);return 1000+polls.length;}
    if(ms===15000)hydrateTimer=cb;
    return realTimeout(cb,ms);
  };
  w.fetch=async(url,options={})=>{
    if(String(url).includes('/v1/mcp/')){
      requests.push({url,body:options.body?JSON.parse(options.body):null,headers:options.headers,credentials:options.credentials,method:options.method||'GET'});
      const handler=String(url).endsWith('/status')?mcpStatus:mcpConnect;
      const response=typeof handler==='function'?await handler():handler;
      if(response instanceof Error)throw response;
      if(response?.httpStatus)return {ok:false,status:response.httpStatus,json:async()=>response};
      return {ok:true,status:200,json:async()=>response};
    }
    if(String(url).includes('/v1/integrations/activepieces/')){
      requests.push({url,body:null,headers:options.headers,credentials:options.credentials,method:options.method||'GET'});
      const response=String(url).endsWith('/status')?integrationStatus:integrationConnect;
      if(response instanceof Error)throw response;
      if(response?.httpStatus)return {ok:false,status:response.httpStatus,json:async()=>response};
      return {ok:true,status:200,json:async()=>response};
    }
    const body=JSON.parse(options.body);(body.op==='resume_employee_activation'?activationRequests:requests).push({url,body,headers:options.headers,credentials:options.credentials});
    const handler=String(url).includes('/v1/integrations')?integrations[body.op]:{hydrate,message,work,approve,employee_state,employee_instructions,add_knowledge,update_company_settings,export:exportResponse,resume_employee_activation}[body.op];
    const response=typeof handler==='function'?await handler(body):handler;
    if(response instanceof Error)throw response;
    if(response?.httpStatus)return {ok:false,status:response.httpStatus,json:async()=>response};
    return {ok:true,status:200,json:async()=>response};
  };
  w.alert=text=>alerts.push(text);w.__SIY_NAVIGATE__=url=>navigations.push(url);w.eval(source);await flush();await flush();
  return {dom,w,d:w.document,requests,activationRequests,alerts,polls,navigations,timeout:()=>hydrateTimer(),close:()=>setImmediate(()=>w.close())};
}
function send(p,text){p.d.querySelector('#input').value=text;p.d.querySelector('#send').click();}
function thread(p){return p.d.querySelector('#thread').textContent;}

test('interface language follows the account choice without changing company data or reply language',async()=>{
  const saved={id:'saved-locale',title:'خطة النمو',messages:[{role:'user',content:'Build a sales assistant',at:'09:00'},{role:'assistant',content:'هذه خطتك',at:'09:01'}]};
  const p=await page({locale:'en',hydrate:{...empty,company:'شركة مدار',team:[employee],conversations:[saved]},hash:''});try{
    assert.equal(p.d.documentElement.lang,'en');assert.equal(p.d.documentElement.dir,'ltr');
    assert.match(p.d.querySelector('#newChat').textContent,/New request/);
    assert.match(p.d.querySelector('#meBtn').textContent,/شركة مدار/);
    assert.equal(p.d.querySelector('#companyNameField').value,'شركة مدار');
    assert.equal(p.d.querySelector('#companyNameField').getAttribute('aria-label'),'Company name');
    assert.equal(p.d.querySelector('#companyLanguage').value,'ar');
    p.d.querySelector('[data-chat="saved-locale"]').click();
    assert.match(thread(p),/Build a sales assistant/);assert.match(thread(p),/هذه خطتك/);
    assert.equal(p.d.querySelector('.m--ai .m__c').getAttribute('dir'),'auto');
    p.d.querySelector('#localeToggle').click();
    assert.equal(p.d.documentElement.lang,'ar');assert.equal(p.d.documentElement.dir,'rtl');
    assert.match(p.d.querySelector('#meBtn').textContent,/شركة مدار/);
    assert.equal(p.d.querySelector('#companyNameField').value,'شركة مدار');
    assert.equal(p.d.querySelector('#companyLanguage').value,'ar');
    assert.match(thread(p),/Build a sales assistant/);assert.match(thread(p),/هذه خطتك/);
  }finally{p.close();}
});
test('account loading error follows interface language without changing a saved conversation',async()=>{
  const p=await page({locale:'en',hydrate:new Error('offline'),hash:''});try{
    assert.match(thread(p),/Could not load your account/);
    p.d.querySelector('#localeToggle').click();
    assert.match(thread(p),/تعذّر تحميل بيانات حسابك/);
  }finally{p.close();}
});

test('saved connections use interface language while their real account and employee names survive switching',async()=>{
  const connection={id:'C'.repeat(21),slug:'gmail',displayName:'Gmail',status:'ACTIVE',scope:'PROJECT',flowIds:['flow-1']};
  const saved={id:'locale-conversation',title:'عميل الرياض',messages:[{role:'assistant',content:'وصلنا الطلب من العميل',at:'09:01'}]};
  const p=await page({locale:'en',hydrate:{...empty,company:'شركة مدار',team:[employee],conversations:[saved]},integrations:{list:{ok:true,connections:[connection]}},hash:''});try{
    assert.match(p.d.querySelector('#toolsCnt').textContent,/1 saved connection/);
    p.d.querySelector('#toolsLink').click();await flush();
    assert.match(thread(p),/Saved connections/);
    assert.match(thread(p),/Assigned/);
    assert.match(thread(p),/سارة/);
    p.d.querySelector('[data-tool-details="gmail"]').click();
    assert.match(p.d.querySelector('#mD').textContent,/Connection saved.*Run a real task.*سارة/);
    assert.equal(p.d.querySelector('#mGo').hidden,true);
    assert.equal(p.d.activeElement,p.d.querySelector('#mX'));
    p.d.querySelector('#mX').click();p.d.querySelector('#localeToggle').click();
    assert.match(p.d.querySelector('#toolsCnt').textContent,/اتصال محفوظ/);
    assert.match(thread(p),/الاتصالات المحفوظة/);
    p.d.querySelector('[data-chat="locale-conversation"]').click();
    assert.match(thread(p),/وصلنا الطلب من العميل/);
    assert.match(p.d.querySelector('#meBtn').textContent,/شركة مدار/);
  }finally{p.close();}
});

test('connection load failure and retry labels follow interface language without claiming a connection',async()=>{
  const p=await page({locale:'en',integrations:{list:new Error('offline')}});try{
    p.d.querySelector('#toolsLink').click();await flush();
    assert.match(thread(p),/Could not load connection status/);
    assert.match(p.d.querySelector('#toolsCnt').textContent,/Connection status unavailable/);
    assert.match(p.d.querySelector('[data-retry-tools]').textContent,/Try again/);
    assert.doesNotMatch(thread(p),/Assigned|Connection saved/);
    p.d.querySelector('#localeToggle').click();
    assert.match(thread(p),/تعذّر تحميل حالة الاتصالات/);
    assert.match(p.d.querySelector('#toolsCnt').textContent,/حالة الربط غير متاحة/);
    assert.match(p.d.querySelector('[data-retry-tools]').textContent,/أعد المحاولة/);
  }finally{p.close();}
});

test('real account waiting state shows no guessed tool scan or connection count before server readback',async()=>{
  let finishList,finishMessage;
  const listPending=new Promise(resolve=>{finishList=resolve;});
  const messagePending=new Promise(resolve=>{finishMessage=resolve;});
  const p=await page({locale:'en',integrations:{list:()=>listPending},message:()=>messagePending,hash:''});try{
    assert.match(p.d.querySelector('#toolsCnt').textContent,/Connections not verified/);
    send(p,'Build a social media employee');await flush();
    assert.match(thread(p),/Processing your request/);
    assert.equal(p.d.querySelector('#thread .toolscan'),null);
    assert.equal(p.d.querySelector('#thread .scanmeta'),null);
    assert.doesNotMatch(thread(p),/Gmail|Checked \d+ tools/);
  }finally{
    finishList({ok:true,connections:[]});
    finishMessage({ok:true,conversation_id:'wait-test',reply:'Received'});
    await flush();p.close();
  }
});

test('English settings save retains Arabic company values, reply language, and stored conversation text',async()=>{
  const initial={voice:'مباشر وهادئ',language:'auto',dialect:'سعودية بيضاء',preferredWords:['أبشر'],forbiddenWords:['مستحيل'],version:2};
  const saved={id:'saved-settings',title:'رحلة العميل',messages:[{role:'user',content:'ابن لي موظف سوشل ميديا',at:'09:00'}]};
  const p=await page({locale:'en',hydrate:{...empty,company:'شركة مدار',company_settings:initial,conversations:[saved]},update_company_settings:{ok:true,settings:{...initial,voice:'مختصر وواضح'},version:3},hash:''});try{
    assert.equal(p.d.querySelector('#companyNameField').value,'شركة مدار');
    assert.equal(p.d.querySelector('#companyVoice').value,'مباشر وهادئ');
    assert.equal(p.d.querySelector('#companyLanguage').value,'auto');
    assert.match(p.d.querySelector('#settingsSave').textContent,/Save settings/);
    p.d.querySelector('#companyVoice').value='مختصر وواضح';
    p.d.querySelector('#settingsSave').click();await flush();
    const save=p.requests.find(r=>r.body.op==='update_company_settings');
    assert.equal(save.body.voice,'مختصر وواضح');assert.equal(save.body.language,'auto');
    assert.deepEqual(save.body.preferredWords,['أبشر']);
    assert.match(p.d.querySelector('#settingsStatus').textContent,/Saved.*version 3/);
    p.d.querySelector('[data-chat="saved-settings"]').click();
    assert.match(thread(p),/ابن لي موظف سوشل ميديا/);
    p.d.querySelector('#localeToggle').click();
    assert.equal(p.d.querySelector('#companyVoice').value,'مختصر وواضح');
    assert.equal(p.d.querySelector('#companyLanguage').value,'auto');
    assert.match(thread(p),/ابن لي موظف سوشل ميديا/);
  }finally{p.close();}
});

test('offline authenticated boot clears demo data, billing and fake connections',async()=>{
  const p=await page({hydrate:Error('offline')});try{
    assert.equal(p.w.__SIY_REAL__,true);assert.equal(p.w.EMPS.length,0);assert.equal(p.w.MEM.length,0);assert.equal(p.w.ACTIONS.length,0);
    assert.equal(p.d.querySelectorAll('.hist[data-chat]').length,0);assert.match(thread(p),/تعذّر تحميل/);
    assert.equal(p.w.PLAN.state,'unknown');assert.equal(p.w.PLAN.invoices.length,0);
    assert.ok(!p.d.querySelector('#meBtn').textContent.includes('أنس'));assert.ok(!p.d.querySelector('#toolsCnt').textContent.includes('4 مربوطة'));
  }finally{p.close();}
});
test('cookie session uses authenticated gateway without browser-readable identity token',async()=>{
  const p=await page();try{
    assert.equal(p.w.__SIY_LOAD_ERROR__,'');assert.deepEqual(p.requests[0].body,{op:'hydrate'});
    assert.equal(p.requests[0].credentials,'include');assert.equal(p.requests[0].headers.Authorization,undefined);
    assert.ok(p.d.querySelector('#meBtn').textContent.includes('Server Company'));
  }finally{p.close();}
});
test('account menu reports the governed company gateway without direct browser connection',async()=>{
  const p=await page();try{
    p.d.querySelector('#meBtn').click();await flush();
    assert.equal(p.d.querySelector('#builderConnectState').textContent,'مساحة شركتك');
    p.d.querySelector('#builderConnectBtn').click();await flush();
    assert.match(thread(p),/الأدوات/);
    assert.equal(p.requests.some(x=>String(x.url).includes('/v1/integrations/activepieces/')),false);
    assert.ok(!source.includes('ACTIVEPIECES_MCP_ACCESS_TOKEN'));
    assert.ok(!source.includes('SiyadahActivepiecesMcp'));
  }finally{p.close();}
});
test('real account tools hide legacy demo employees and internal platform labels',async()=>{
  const p=await page({pieces:[['gmail','Gmail','Email','communication','https://example.test/gmail.png','البريد'],['hubspot','HubSpot','CRM','sales','https://example.test/hubspot.png','إدارة العملاء']]});try{
    p.d.querySelector('#toolsLink').click();await flush();
    const visible=thread(p);
    assert.doesNotMatch(visible,/يحتاجه سعد|تحتاجه ريم|تحتاجه نورة/);
    assert.doesNotMatch(visible,/Activepieces|MCP|ap_[a-z_]+/);
    assert.doesNotMatch(visible,/مقترحة لك/);
    assert.match(visible,/الأدوات/);
    assert.doesNotMatch(visible,/محرك التنفيذ|بوابة سيادة متصلة/);
  }finally{p.close();}
});
test('tool buttons show saved connection details without claiming a provider run',async()=>{
  const connection={id:'C'.repeat(21),slug:'gmail',displayName:'Gmail',status:'ACTIVE',scope:'PROJECT'};
  const p=await page({hydrate:{...empty,team:[employee]},integrations:{list:{ok:true,connections:[connection]}},pieces:[['gmail','Gmail','Email','communication','https://example.test/gmail.png','البريد',{pieceName:'@activepieces/piece-gmail'}]]});try{
    p.d.querySelector('#toolsLink').click();await flush();
    const details=p.d.querySelector('[data-tool-details="gmail"]');assert.ok(details);details.click();
    assert.ok(p.d.querySelector('#modal').classList.contains('on'));assert.match(p.d.querySelector('#mD').textContent,/الاتصال محفوظ.*مهمة فعلية.*سارة/);assert.equal(p.d.querySelector('#mGo').hidden,true);
    p.d.querySelector('#mX').click();p.d.querySelector('[data-request-tool]').click();
    assert.equal(p.d.querySelector('#input').value,'أحتاج أداة غير موجودة في القائمة: ');assert.equal(p.d.activeElement,p.d.querySelector('#input'));
  }finally{p.close();}
});
test('Google connect popup opens in the submit gesture before OAuth preparation returns',async()=>{
  let finishStart,opened=0;
  const start=new Promise(resolve=>{finishStart=resolve;});
  const p=await page({integrations:{list:{ok:true,connections:[]},methods:{ok:true,methods:[{type:'OAUTH2',available:true,displayName:'Google',fields:[]}]},oauth_start:()=>start},hash:''});
  try{
    p.w.open=()=>{opened++;return {closed:false,close(){},location:{replace(){}}};};
    p.d.querySelector('#toolsLink').click();await flush();
    p.d.querySelector('#allTgl').click();await flush();
    p.d.querySelector('[data-c="gmail"]').click();await flush();
    p.d.querySelector('#mF form').dispatchEvent(new p.w.Event('submit',{bubbles:true,cancelable:true}));
    assert.equal(opened,1);
    assert.equal(p.requests.some(request=>request.body?.op==='oauth_start'),true);
    finishStart({ok:true,authorizationUrl:'https://accounts.google.com/o/oauth2/auth',allowedOrigin:'https://accounts.siyadah-ai.com'});
    await flush();
  }finally{p.close();}
});
test('cloud OAuth accepts only the opened popup and reads back the saved company connection',async()=>{
  const connection={id:'C'.repeat(21),slug:'gmail',displayName:'Gmail',status:'ACTIVE',scope:'PROJECT'},popup={closed:false,close(){this.closed=true;},location:{replace(){}}};let lists=0;
  const p=await page({integrations:{list:()=>({ok:true,connections:++lists===1?[]:[connection]}),methods:{ok:true,methods:[{type:'OAUTH2',available:true,displayName:'Google',fields:[]}]},oauth_start:{ok:true,provider:'cloud',attempt:'sealed-attempt',authorizationUrl:'https://accounts.google.com/o/oauth2/auth',allowedOrigin:'https://secrets.activepieces.com'},oauth_finish:{ok:true,connection}},hash:''});
  try{
    p.w.open=()=>popup;
    p.d.querySelector('#toolsLink').click();await flush();p.d.querySelector('#allTgl').click();await flush();p.d.querySelector('[data-c="gmail"]').click();await flush();
    p.d.querySelector('#mF form').dispatchEvent(new p.w.Event('submit',{bubbles:true,cancelable:true}));await flush();
    const post=(origin,source)=>{const event=new p.w.MessageEvent('message',{origin,data:{code:'oauth-code'}});Object.defineProperty(event,'source',{value:source});p.w.dispatchEvent(event);};
    post('https://other.example',popup);post('https://secrets.activepieces.com',{});await flush();
    assert.equal(p.requests.some(request=>request.body?.op==='oauth_finish'),false);
    post('https://secrets.activepieces.com',popup);await flush();await flush();
    const finish=p.requests.find(request=>request.body?.op==='oauth_finish');assert.deepEqual(finish.body,{op:'oauth_finish',attempt:'sealed-attempt',code:'oauth-code'});
    assert.equal(popup.closed,true);assert.equal(p.d.querySelector('#modal').classList.contains('on'),false);
  }finally{p.close();}
});
test('tools page distinguishes a saved connection from one assigned to an employee flow',async()=>{
  const flowId='F'.repeat(21),connection={id:'C'.repeat(21),slug:'gmail',displayName:'Gmail',status:'ACTIVE',scope:'PROJECT',flowIds:[flowId]};
  const p=await page({hydrate:{...empty,team:[{...employee,flowId,tools:[]}]},integrations:{list:{ok:true,connections:[connection]}}});try{
    p.d.querySelector('#toolsLink').click();await flush();
    assert.match(thread(p),/ضمن موظف/);
    assert.match(thread(p),/سارة/);
    assert.doesNotMatch(thread(p),/اكتمل اختبار فعلي/);
  }finally{p.close();}
});
test('real employee shows natural instructions without exposing a compiled prompt',async()=>{
  const changed='تابعي الفرص الجديدة وأرسلي ملخصًا واضحًا.';
  const p=await page({hydrate:{...empty,team:[{...employee,instructions:'تابعي الفرص الجديدة واكتبي ملخصًا واضحًا.',instructionSource:'company_profile',instructionVersion:1}]},employee_instructions:body=>({ok:true,instruction_scope:'conversation',instructions_verified:true,employee:{...employee,instructions:body.instructions,instructionSource:'owner',instructionVersion:2}})});try{
    p.d.querySelector('#emps .emp').click();await flush();
    p.d.querySelector('#instrTgl').click();await flush();
    assert.match(thread(p),/تعليماته|تعليمات/);
    assert.equal(p.d.querySelector('#instr').readOnly,false);
    p.d.querySelector('#instr').value=changed;p.d.querySelector('#instrSave').click();await flush();
    assert.equal(p.requests.at(-1).body.op,'employee_instructions');
    assert.equal(p.requests.at(-1).body.instructions,changed);
    assert.match(p.d.querySelector('#instrF').textContent,/حُفظت للمحادثة · النسخة 2/);
    assert.equal(p.d.querySelector('.prompt'),null);
    assert.doesNotMatch(thread(p),/Prompt|Activepieces|MCP|# الهوية|# الصلاحية/);
  }finally{p.close();}
});
test('builder labels hide platform vocabulary while assistant reply retains original wording',async()=>{
  const proposal={ok:true,conversation_id:'builder-conversation',work_id:'builder-work',interaction_state:'awaiting_approval',reply:'الخطة جاهزة.',flow_plan:{name:'Daily greeting',trigger:{piece_name:'@activepieces/piece-schedule',operation:'cron_expression'},steps:[{type:'CODE',display_name:'Greeting'}]},approval:{required:true,approval_id:'approval-1'}};
  const built={ok:true,conversation_id:'builder-conversation',work_id:'builder-work',work_status:'awaiting_input',interaction_state:'draft_ready',reply:'تم إنشاء مسودة معطلة عبر @activepieces/piece-slack وقراءتها من Activepieces MCP. لم تُختبر أو تُنشر بعد.',flow_id:'flow-proof',draft:{published:false,tested:false,validation:{valid:true},readback:{id:'flow-proof',status:'DISABLED'}}};
  const p=await page({message:proposal,approve:built});try{
    send(p,'أنشئ Flow يبدأ Webhook ثم Code يعيد {ok:true}');await flush();
    assert.match(thread(p),/Daily greeting/);assert.match(thread(p),/الوقت أو الحدث الذي تحدده/);assert.match(thread(p),/Greeting/);
    assert.doesNotMatch(thread(p),/Activepieces|MCP|cron_expression|@activepieces|\bCODE\b|المشغّل/);
    const button=p.d.querySelector('[data-siy-approval="approve"]');assert.ok(button);button.click();await flush();
    const approval=p.requests.find(x=>x.body.op==='approve');assert.ok(approval.body.request_id);assert.equal(approval.body.conversation_id,'builder-conversation');assert.equal(approval.body.approval_id,'approval-1');assert.equal(approval.body.decision,'approve');
    assert.match(thread(p),/لم تُختبر أو تُنشر بعد/);assert.match(thread(p),/flow-proof/);assert.equal(p.d.querySelectorAll('[data-siy-approval]').length,0);
    assert.ok(thread(p).includes(built.reply));
  }finally{p.close();}
});
test('MCP action approval shows exact inputs and never places credentials in the browser',async()=>{
  const proposal={ok:true,conversation_id:'chat-mcp',request_status:'succeeded',work_status:'awaiting_input',outcome_kind:'conversation_reply',reply:'راجع الإجراء.',approval:{required:true,kind:'tool_action',approval_id:'approval-mcp',summary:'اقرأ التقويم',details:'{"pieceName":"google-calendar","input":"<img src=x onerror=alert(1)>"}'}};
  const p=await page({message:proposal,approve:{ok:true,conversation_id:'chat-mcp',request_status:'not_observed',work_status:'unknown',outcome_kind:'unverified',reply:'وصل الرد، ولم نتحقق بعد من أثره لدى المزود.'}});try{
    send(p,'وش عندي في التقويم؟');await flush();
    const details=p.d.querySelector('.plan details');assert.ok(details);assert.match(details.textContent,/google-calendar/);assert.equal(details.querySelector('img'),null);
    p.d.querySelector('[data-siy-approval="approve"]').click();await flush();
    assert.equal(p.requests.find(row=>row.body.op==='approve').body.approval_id,'approval-mcp');
    assert.match(thread(p),/لم نتحقق بعد/);assert.equal(p.d.querySelector('[data-siy-approval]'),null);
    assert.equal(p.requests.some(row=>Object.hasOwn(row.body,'projectId')||Object.hasOwn(row.body,'token')),false);
  }finally{p.close();}
});
test('table approval keeps the next flow approval visible and sends each approval once',async()=>{
  const proposal={ok:true,conversation_id:'table-flow-chat',request_status:'succeeded',work_status:'awaiting_input',outcome_kind:'conversation_reply',reply:'سأجهز جدول العملاء.',approval:{required:true,kind:'tool_action',approval_id:'table-approval',summary:'إنشاء الجدول',details:'{}'}};
  let decisions=0;
  const p=await page({message:proposal,approve:()=>++decisions===1?{
    ok:true,conversation_id:'table-flow-chat',request_status:'succeeded',work_status:'awaiting_input',outcome_kind:'conversation_reply',reply:'تحققنا من إنشاء الجدول. جهزت خطة التدفق للمراجعة.',table:{id:'T12345678901234567890',externalId:'E12345678901234567890',name:'Leads'},approval:{required:true,kind:'tool_action',approval_id:'flow-approval',summary:'بناء طريقة العمل',details:'{}'},
  }:{ok:true,conversation_id:'table-flow-chat',request_status:'succeeded',work_status:'not_started',outcome_kind:'conversation_reply',reply:'حُفظت طريقة العمل كمسودة.',flow_id:'F12345678901234567890',draft:true}});
  try{
    send(p,'ابنِ فلو لجمع العملاء');await flush();
    p.d.querySelector('[data-siy-approval="approve"]').click();await flush();
    assert.match(thread(p),/تحققنا من إنشاء الجدول/);
    assert.ok(p.d.querySelector('[data-siy-approval="approve"]'));
    p.d.querySelector('[data-siy-approval="approve"]').click();await flush();
    assert.deepEqual(p.requests.filter(row=>row.body.op==='approve').map(row=>row.body.approval_id),['table-approval','flow-approval']);
    assert.equal(decisions,2);
    assert.match(thread(p),/حُفظت طريقة العمل كمسودة/);
    assert.equal(p.d.querySelector('[data-siy-approval="approve"]'),null);
  }finally{p.close();}
});
test('approved flow draft updates the same employee in chat without claiming a run',async()=>{
  const saved={...employee,recordId:'employee-draft',flowId:null,status:'disabled'};
  const proposal={ok:true,conversation_id:'draft-chat',request_status:'succeeded',work_status:'awaiting_input',outcome_kind:'employee_draft',reply:'حُفظت المسودة.',employee:saved,approval:{required:true,kind:'tool_action',approval_id:'build-approval',summary:'تجهيز طريقة العمل',details:'{}'}};
  const linked={...saved,flowId:'F12345678901234567890'};
  const approved={ok:true,conversation_id:'draft-chat',request_status:'succeeded',work_status:'not_started',outcome_kind:'employee_draft',reply:'بُنيت طريقة العمل كمسودة.',employee:linked};
  const p=await page({hydrate:{...empty,team:[saved]},message:proposal,approve:approved});try{
    send(p,'جهّز الموظف');await flush();
    p.d.querySelector('[data-siy-approval="approve"]').click();await flush();
    assert.equal(p.w.EMPS.length,1);
    assert.equal(p.w.EMPS[0].id,saved.recordId);
    assert.equal(p.w.EMPS[0].flowId,linked.flowId);
    assert.match(thread(p),/بُنيت طريقة العمل كمسودة/);
    assert.doesNotMatch(thread(p),/آخر تشغيل ناجح|نتيجة الخدمة/);
  }finally{p.close();}
});
test('browser storage cannot supply company identity or suppress server hydration',async()=>{
  const p=await page({storage:{siyadah_company:'Untrusted',siyadah_token:'attacker-token'}});try{
    assert.equal(p.w.__SIY_REAL__,true);assert.equal(p.requests.length,2);assert.equal(p.requests[0].credentials,'include');
    assert.ok(!p.d.querySelector('#meBtn').textContent.includes('Untrusted'));
  }finally{p.close();}
});
test('returning after a connection resumes only the server-selected employee activation',async()=>{
  const draft={...employee,status:'disabled',tools:[]};
  const p=await page({hydrate:{...empty,team:[draft]},resume_employee_activation:{ok:true,activation_status:'active',employee}});try{
    assert.equal(p.activationRequests.length,1);
    assert.deepEqual(p.activationRequests[0].body,{op:'resume_employee_activation'});
    assert.equal(p.w.EMPS[0].on,true);
  }finally{p.close();}
});
test('opening an employee scopes activation retry to that employee',async()=>{
  const p=await page({hydrate:{...empty,team:[{...employee,status:'disabled'}]}});try{
    p.d.querySelector('#emps .emp').click();await flush();
    assert.deepEqual(p.activationRequests.at(-1).body,{op:'resume_employee_activation',employee_id:employee.recordId});
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
test('acceptance card shows proven gates and never labels a partial draft 10/10',async()=>{
  const acceptance={schema:'SiyadahFlowAcceptanceV2',score:'6/10',can_claim_10_of_10:false,claim:'Verified disabled draft; execution and commercial result remain unproved.',checks:[
    {key:'draft_readback',label:'Disabled Activepieces draft',passed:true},
    {key:'commercial_result',label:'Attributed commercial KPI result',passed:false},
  ]};
  const p=await page({message:{ok:true,conversation_id:'conversation-acceptance',reply:'جهزت المسودة.',acceptance}});try{
    send(p,'ابن الموظف');await flush();
    assert.match(thread(p),/حالة العمل: 6\/10/);
    assert.match(thread(p),/تم تجهيز طريقة العمل/);
    assert.match(thread(p),/ظهرت نتيجة أعمال مثبتة/);
    assert.doesNotMatch(thread(p),/Activepieces|MCP/);
    assert.ok(!thread(p).includes('موظف مثبت 10/10'));
  }finally{p.close();}
});
test('complete disconnected draft gets its own 10/10 without a production claim',async()=>{
  const acceptance={schema:'SiyadahFlowAcceptanceV2',score:'6/10',can_claim_10_of_10:false,claim:'Execution is not proved.',checks:[
    {key:'draft_readback',label:'Disabled Activepieces draft',passed:true},
    {key:'commercial_result',label:'Commercial result',passed:false},
  ],draft_readiness:{schema:'SiyadahDraftReadinessV1',score:'10/10',can_claim_draft_10_of_10:true,claim:'المسودة جاهزة 10/10 للربط؛ لم يتم اختبار التشغيل أو إثبات الأثر بعد.',checks:Array.from({length:10},(_,i)=>({key:'g'+i,label:'gate '+i,passed:true}))}};
  const p=await page({message:{ok:true,conversation_id:'conversation-draft-ready',reply:'جهزت المسودة.',acceptance}});try{
    send(p,'ابن المسودة');await flush();
    assert.match(thread(p),/الموظف جاهز للربط والاختبار/);
    assert.match(thread(p),/اربط الأدوات المطلوبة/);
    assert.match(thread(p),/حالة العمل: 6\/10/);
    assert.ok(!thread(p).includes('نتيجة تشغيل مثبتة 10/10'));
  }finally{p.close();}
});
test('accepted work appears pending, then proof readback upserts stable employee without clearing chat',async()=>{
  const p=await page({message:{ok:true,conversation_id:'conversation-1',work_id:'work-1',work_status:'queued'},work:{ok:true,conversation_id:'conversation-1',work_id:'work-1',work_status:'succeeded',reply:'سُجلت النتيجة.',employee,recent_work:[{...proof,conversation_id:'conversation-1'}]}});try{
    send(p,'أنشئ موظف الفرص');await flush();assert.match(thread(p),/بانتظار التنفيذ/);assert.ok(!thread(p).includes('✓'));
    assert.equal(p.w.EMPS.length,0);assert.equal(p.polls.length,1);await p.polls.shift()();await flush();
    assert.equal(p.d.querySelector('#emps .emp').dataset.emp,employee.recordId);assert.equal(p.w.EMPS[0].flowId,employee.flowId);
    assert.match(thread(p),/أنشئ موظف الفرص/);assert.match(thread(p),/سُجلت النتيجة/);assert.match(thread(p),/✓ مكتملة/);
    assert.equal(p.w.__SIY_DASH__.recent_work[0].runId,'run-1');assert.equal(p.polls.length,0);
  }finally{p.close();}
});
test('failed work with arbitrary proof text never renders success mark',async()=>{
  const p=await page({message:{ok:true,conversation_id:'c',work_id:'w',work_status:'failed',recent_work:[{...proof,status:'failed'}]}});try{
    send(p,'نفذ');await flush();assert.match(thread(p),/تعذّر إكمال/);assert.ok(!thread(p).includes('✓'));assert.equal(p.polls.length,0);
  }finally{p.close();}
});
test('ordinary reply readback accepts not_started and never shows run proof',async()=>{
  const answer={ok:true,conversation_id:'c',request_status:'succeeded',work_status:'not_started',outcome_kind:'conversation_reply',reply:'هذا جواب السؤال.',recent_work:[proof]};
  const p=await page({message:Error('offline'),work:answer});try{
    send(p,'سؤال');await flush();p.d.querySelector('[data-siy-retry]').click();await flush();
    assert.match(thread(p),/هذا جواب السؤال/);
    assert.doesNotMatch(thread(p),/اكتمل العمل حسب سجل التشغيل|آخر عمل فعلي|✓/);
    assert.equal(p.d.querySelectorAll('[data-siy-retry]').length,0);
    assert.equal(p.requests.filter(x=>x.body.op==='message').length,1);
    assert.equal(p.requests.filter(x=>x.body.op==='work').length,1);
  }finally{p.close();}
});
test('employee draft fallback describes a saved draft without claiming a run',async()=>{
  const draft={ok:true,conversation_id:'c',request_status:'succeeded',work_status:'not_started',outcome_kind:'employee_draft',employee:{...employee,status:'disabled',tools:[]},recent_work:[proof]};
  const p=await page({message:Error('offline'),work:draft});try{
    send(p,'أنشئ موظفًا');await flush();p.d.querySelector('[data-siy-retry]').click();await flush();
    assert.match(thread(p),/حُفظت مسودة الموظف. لم يبدأ تشغيل أدواته/);
    assert.doesNotMatch(thread(p),/اكتمل العمل حسب سجل التشغيل|✓/);
    assert.equal(p.polls.length,0);
    assert.equal(p.d.querySelectorAll('[data-siy-retry]').length,0);
    assert.equal(p.requests.filter(x=>x.body.op==='message').length,1);
    assert.equal(p.requests.filter(x=>x.body.op==='work').length,1);
  }finally{p.close();}
});
test('external run without a reply asks for tool verification instead of inventing provider success',async()=>{
  const run={ok:true,conversation_id:'c',request_status:'succeeded',work_status:'succeeded',outcome_kind:'external_run'};
  const p=await page({message:run});try{
    send(p,'شغّل المهمة');await flush();
    assert.match(thread(p),/سُجّل التشغيل؛ تحقّق من نتيجة الأداة/);
    assert.doesNotMatch(thread(p),/ردت الخدمة|✓/);
  }finally{p.close();}
});
test('terminal unknown request shows the actual tool account without claiming success',async()=>{
  const unknown={ok:true,conversation_id:'c',request_status:'not_observed',work_status:'unknown',outcome_kind:'unverified',work_id:'request_req_1',reply:'لم نؤكد نتيجة الطلب بعد. لم نعد تنفيذه.'};
  const p=await page({message:unknown,work:unknown});try{
    send(p,'أنشئ موظفًا');await flush();
    assert.ok(p.d.querySelector('[data-siy-retry]'));
    assert.match(thread(p),/لم نؤكد نتيجة الطلب بعد/);
    assert.doesNotMatch(thread(p),/لم يظهر سجل الطلب/);
    assert.ok(!thread(p).includes('✓'));
    p.d.querySelector('[data-siy-retry]').click();await flush();
    const messages=p.requests.filter(x=>x.body.op==='message'),checks=p.requests.filter(x=>x.body.op==='work');
    assert.equal(messages.length,1);
    assert.equal(checks.length,1);
    assert.equal(checks[0].body.request_id,messages[0].body.request_id);
  }finally{p.close();}
});
test('queued request with no ledger readback shows an explicit unknown result and stops polling',async()=>{
  const p=await page({message:{ok:true,conversation_id:'c',request_status:'queued',work_status:'queued',work_id:'request_req_1'},work:{ok:true,request_status:'not_observed',work_status:'unknown'}});try{
    send(p,'أنشئ موظفًا');await flush();
    assert.match(thread(p),/بانتظار التنفيذ/);
    assert.equal(p.polls.length,1);
    await p.polls.shift()();await flush();
    assert.match(thread(p),/لم نتأكد من نتيجة الطلب. لم نعد تنفيذه/);
    assert.doesNotMatch(thread(p),/وصل الرد دون تفاصيل إضافية/);
    assert.ok(!thread(p).includes('✓'));
    assert.equal(p.polls.length,0);
    assert.equal(p.requests.filter(x=>x.body.op==='message').length,1);
    assert.equal(p.requests.filter(x=>x.body.op==='work').length,1);
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
  const xss='"><img src=x onerror=alert(1)>';const p=await page({hydrate:{...empty,team:[{...employee,name:xss,role:xss,status:'inactive',tools:[]},{name:'missing ID'}]},employee_state:{httpStatus:403}});try{
    assert.equal(p.w.EMPS.length,1);assert.equal(p.w.EMPS[0].on,false);assert.equal(p.d.querySelectorAll('#emps img').length,0);
    p.d.querySelector('#emps .emp').click();await flush();const toggle=p.d.querySelector('#onSw');toggle.click();assert.equal(toggle.getAttribute('aria-checked'),'false');await flush();
    assert.equal(p.d.querySelector('#renameBtn').disabled,true);
    assert.match(source,/op:"connect"/);assert.match(source,/op:"revalidate"/);assert.match(source,/op:"disconnect"/);
    assert.equal(p.requests.length,3);
  }finally{p.close();}
});
test('an employee tool appears ready only with a project connection readback',async()=>{
  const connection={id:'C'.repeat(21),slug:'http',displayName:'طلب ويب',status:'ACTIVE',scope:'PROJECT'};
  const p=await page({hydrate:{...empty,team:[{...employee,tools:['اتصال ويب']}]},integrations:{list:{ok:true,connections:[connection]}},pieces:[['http','طلب ويب','تنفيذ','developer','https://example.test/http.png','إرسال طلب إلى خدمة خارجية',{pieceName:'@activepieces/piece-http'}]]});try{
    p.d.querySelector('#emps .emp').click();await flush();assert.ok(p.d.querySelector('.chip:not(.chip--off) .chip__n'));assert.match(p.d.querySelector('.chip:not(.chip--off)').textContent,/اتصال ويب/);assert.equal(p.d.querySelector('.chip:not(.chip--off) [data-c]'),null);
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
  p.d.querySelector('#emps .emp').click();await flush();assert.match(p.d.querySelector('.pin__s').textContent,/آخر تشغيل ناجح ونتيجته محفوظة/);
  const refs=[...p.d.querySelectorAll('.siyrefs code')].map(x=>x.textContent);
  for(const id of [employee.recordId,employee.flowId,proof.work_id,proof.runId,proof.recordId])assert.ok(refs.includes(id));
 }finally{p.close();}
});
test('employee header does not infer success from another employee, flow, or incomplete proof',async()=>{
 for(const candidate of [{...proof,employeeId:'other'},{...proof,flowId:'other'},{...proof,status:'failed'},{...proof,runId:''},{...proof,recordId:''}]){
  const p=await page({hydrate:{...empty,team:[employee],recent_work:[candidate]}});try{
   p.d.querySelector('#emps .emp').click();await flush();assert.match(p.d.querySelector('.pin__s').textContent,/لم يُتحقق منه/);
  }finally{p.close();}
 }
});

test('reload restores employee conversation and its independently persisted proof',async()=>{
 const saved={...empty,team:[employee],conversations:[{id:'central-1',title:'استشارة',messages:[{role:'assistant',content:'رأي تجاري'}]},{id:'central-2',title:'إنشاء الموظف',messages:[{role:'assistant',content:'أنشأت الموظف'}]},{id:'employee-chat',title:'سجل الطلب',employee_id:employee.recordId,messages:[{role:'user',content:'سجل الطلب',at:'2026-09-09T07:57:12.000Z'},{role:'assistant',content:'تم حفظ الطلب',at:'2026-09-09T07:57:14.000Z'}]}],recent_work:[proof]};
 const p=await page({hydrate:saved});try{
  p.d.querySelector('#emps .emp').click();await flush();assert.match(p.d.querySelector('#whoN').textContent,/سارة/);assert.match(thread(p),/تم حفظ الطلب/);assert.match(thread(p),/قراءة السجل مؤكدة/);
  p.d.querySelector('#newChat').click();p.d.querySelector('[data-chat="employee-chat"]').click();assert.match(p.d.querySelector('#whoN').textContent,/سارة/);assert.match(thread(p),/قراءة السجل مؤكدة/);
  assert.equal(thread(p).split('قراءة السجل مؤكدة').length-1,1);
  assert.ok(!thread(p).includes('2026-09-09T'));assert.match(p.d.querySelector('.m--me .m__t').textContent,/^\d{2}:\d{2}$/);
 }finally{p.close();}
});

test('employee toggle waits for matching verified server readback before changing displayed state',async()=>{
 let resolve;const response=new Promise(r=>resolve=r);const p=await page({hydrate:{...empty,team:[employee]},employee_state:()=>response});try{
  p.d.querySelector('#emps .emp').click();await flush();p.d.querySelector('#onSw').click();
  assert.equal(p.d.querySelector('#onSw').getAttribute('aria-checked'),'true');assert.equal(p.d.querySelector('#onSw').disabled,true);assert.match(p.d.querySelector('#onLbl').textContent,/جارٍ التحقق/);
  p.d.querySelector('#onSw').click();assert.equal(p.requests.filter(r=>r.body.op==='employee_state').length,1);
  assert.deepEqual(p.requests.at(-1).body,{op:'employee_state',employee_id:employee.recordId,status:'disabled'});
  assert.equal(p.requests.at(-1).credentials,'include');assert.equal(p.requests.at(-1).headers.Authorization,undefined);
  resolve({ok:true,state_verified:true,employee:{...employee,status:'disabled',flow_status_verified:false}});await flush();
  assert.equal(p.w.EMPS[0].on,false);assert.equal(p.d.querySelector('#onSw').getAttribute('aria-checked'),'false');assert.equal(p.d.querySelector('#onSw').disabled,false);
 }finally{p.close();}
});
test('failed or foreign employee toggle response preserves last confirmed state',async()=>{
 for(const response of [{httpStatus:403},{ok:true,state_verified:true,employee:{...employee,recordId:'other-owner-record',status:'disabled'}},{ok:true,state_verified:true,employee:{...employee,flowId:'other-flow',status:'disabled'}},{ok:true,employee:{...employee,status:'disabled'}}]){
  const p=await page({hydrate:{...empty,team:[employee]},employee_state:response});try{
   p.d.querySelector('#emps .emp').click();await flush();p.d.querySelector('#onSw').click();await flush();
   assert.equal(p.w.EMPS.length,1);assert.equal(p.w.EMPS[0].id,employee.recordId);assert.equal(p.w.EMPS[0].on,true);assert.equal(p.d.querySelector('#onSw').disabled,false);assert.match(p.alerts.at(-1),/آخر حالة مؤكدة/);
  }finally{p.close();}
 }
});
test('disabled employee can be re-enabled only after verified readback',async()=>{
 const p=await page({hydrate:{...empty,team:[{...employee,status:'disabled'}]},employee_state:{ok:true,state_verified:true,employee:{...employee,status:'active',flow_status_verified:true}}});try{
  p.d.querySelector('#emps .emp').click();await flush();p.d.querySelector('#onSw').click();await flush();assert.equal(p.requests.at(-1).body.status,'active');assert.equal(p.w.EMPS[0].on,true);
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
   assert.equal(instructions.querySelector('textarea').readOnly,false);assert.ok(!instructions.querySelector('img,script'));
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

test('older proof in the same conversation is not presented as the latest request result',async()=>{
 const older={...proof,conversation_id:'same',work_id:'old-request',subject:'نتيجة قديمة'};
 const p=await page({hydrate:{...empty,team:[employee],recent_work:[older],conversations:[{id:'same',employee_id:employee.recordId,title:'ريم',messages:[]}]},message:{ok:true,conversation_id:'same',work_id:'new-request',work_status:'succeeded',outcome_kind:'tool_result',reply:'وصلت نتيجة جديدة',recent_work:[older]}});try{
  p.d.querySelector('[data-chat="same"]').click();send(p,'قراءة جديدة');await flush();
  assert.equal(p.d.querySelectorAll('.m__c').length>0,true);
  assert.match(thread(p),/غير مربوط برسالة محددة/);
  assert.doesNotMatch(p.d.querySelector('.m__c').textContent,/old-request/);
 }finally{p.close();}
});

test('simple JSON array reply is shown as a readable escaped table',async()=>{
 const p=await page({message:{ok:true,conversation_id:'json',request_status:'succeeded',work_status:'not_started',outcome_kind:'conversation_reply',reply:'اكتملت القراءة.\n'+JSON.stringify({workspaces:[{name:'sondos-ai.com',gid:'123',is_organization:true},{name:'<script>',gid:'456',is_organization:false}]})}});try{
  send(p,'المساحات');await flush();
  const table=p.d.querySelector('.m__c .reply-table table');assert.ok(table);
  assert.match(thread(p),/اكتملت القراءة/);
  assert.equal(table.querySelectorAll('tbody tr').length,2);
  assert.match(table.textContent,/sondos-ai.com/);
  assert.equal(table.querySelector('script'),null);
 }finally{p.close();}
});

test('reconciled production run uses its own verified ID and ignores an older proof',async()=>{
 const run='AyDcS8RxKFU1u8L4Bggki',flow='wlyKFTxiAOHCMHWS1GIKd',older={...proof,conversation_id:'same',work_id:'old-request'};
 const p=await page({hydrate:{...empty,team:[employee],recent_work:[older],conversations:[{id:'same',employee_id:employee.recordId,title:'ريم',messages:[]}]},message:{ok:true,conversation_id:'same',work_id:'new-request',request_status:'succeeded',work_status:'succeeded',outcome_kind:'tool_result',run_id:run,flow_id:flow,reply:'اكتملت المهمة',recent_work:[older]}});try{
  p.d.querySelector('[data-chat="same"]').click();send(p,'اقرأ');await flush();
  const result=Array.from(p.d.querySelectorAll('.m__c')).find(x=>x.textContent.includes('اكتملت المهمة'));
  assert.ok(result);assert.match(result.textContent,/نتيجة تشغيل هذا الطلب مؤكدة/);
  assert.match(result.textContent,/AyDcS8RxKFU1u8L4Bggki/);
  assert.doesNotMatch(result.textContent,/old-request|run-1/);
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
  assert.equal(p.requests.at(-1).body.request_id,first.request_id);assert.match(thread(p),/لم نتأكد من نتيجة الطلب/);assert.ok(p.d.querySelector('[data-siy-retry]'));
 }finally{p.close();}
});

test('customer export downloads only valid server bundle using authenticated request and releases URL',async()=>{
 const bundle={schemaVersion:1,kind:'siyadah_customer_bundle',company:{name:'Server Company'},employees:[],manifest:{complete:false}};
 const p=await page({export:{ok:true,export:bundle,filename:'ملف-العميل.json'}});try{
  const blobs=[],revoked=[],links=[];p.w.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:test';};p.w.URL.revokeObjectURL=url=>revoked.push(url);
  p.w.HTMLAnchorElement.prototype.click=function(){links.push({href:this.href,download:this.download});};
  p.d.querySelector('#exportBtn').click();await flush();
  const request=p.requests.find(r=>r.body.op==='export');assert.deepEqual(request.body,{op:'export'});assert.equal(request.credentials,'include');assert.equal(request.headers.Authorization,undefined);
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

test('company voice settings load and save without browser-supplied company scope',async()=>{
 const initial={voice:'مباشر وهادئ',language:'auto',dialect:'سعودية بيضاء',preferredWords:['أبشر','تم'],forbiddenWords:['مستحيل'],version:2};
 const p=await page({hydrate:{...empty,company_settings:initial},update_company_settings:{ok:true,settings:{...initial,voice:'مختصر وواضح',preferredWords:['أبشر','واضح']},version:3}});try{
  assert.equal(p.d.querySelector('#companyVoice').value,'مباشر وهادئ');assert.equal(p.d.querySelector('#companyLanguage').value,'auto');assert.match(p.d.querySelector('#preferredWords').value,/أبشر/);
  p.d.querySelector('#companyVoice').value='مختصر وواضح';p.d.querySelector('#preferredWords').value='أبشر، واضح';p.d.querySelector('#settingsSave').click();await flush();
  const save=p.requests.find(r=>r.body.op==='update_company_settings');assert.deepEqual(save.body.preferredWords,['أبشر','واضح']);assert.equal(save.body.voice,'مختصر وواضح');
  for(const key of ['companyId','company_id','tenantId','projectId'])assert.equal(key in save.body,false);
  assert.match(p.d.querySelector('#settingsStatus').textContent,/الإصدار 3/);
 }finally{p.close();}
});

test('company knowledge panel shows owned facts with source time and partial coverage without demo data',async()=>{
 const p=await page({hydrate:{...empty,owned_knowledge:{schemaVersion:1,companyId:'owner-1',knowledgeVersion:3,coverage:'partial',coverageScore:40,lastSuccessAt:'2026-09-09T10:00:00Z',lastError:null,facts:[{key:'price',topic:'السعر',value:'1200 <img src=x>',sourceKind:'user',certainty:'user_confirmed',observedAt:'2026-09-09T09:00:00Z'},{key:'service',topic:'خدمة',value:'الصيانة',sourceKind:'company_website',sourceUrl:'https://company.test/service',certainty:'observed',observedAt:'2026-09-08T09:00:00Z'}]}}});try{
  p.d.querySelector('#memTgl').click();const panel=p.d.querySelector('#memList');assert.match(panel.textContent,/1200 <img src=x>/);assert.match(panel.textContent,/من رسائلك/);assert.match(panel.textContent,/https:\/\/company.test\/service/);assert.match(panel.textContent,/تغطية جزئية 40٪/);assert.match(panel.textContent,/الإصدار 3/);assert.match(panel.textContent,/آخر تحديث ناجح/);assert.ok(!panel.querySelector('img,script,[data-mdel]'));assert.equal(panel.querySelectorAll('[data-kedit]').length,2);assert.ok(panel.querySelector('#kbAdd'));assert.equal(p.requests.length,2);
 }finally{p.close();}
});
test('company owner can add knowledge without sending company identity from the browser',async()=>{
 const before={schemaVersion:1,companyId:'owner-1',knowledgeVersion:1,coverage:'partial',coverageScore:40,facts:[]};
 const after={schemaVersion:1,companyId:'owner-1',knowledgeVersion:2,coverage:'partial',coverageScore:50,facts:[{key:'server-key',topic:'faq',value:'نرد خلال ساعة',sourceKind:'user',certainty:'user_confirmed'}]};let hydrates=0;
 const p=await page({hydrate:()=>({...empty,owned_knowledge:++hydrates===1?before:after}),add_knowledge:{ok:true,knowledgeVersion:2,coverageScore:50}});try{
  p.d.querySelector('#memTgl').click();p.d.querySelector('#kbAdd').click();p.d.querySelector('#kbTopic').value='faq';p.d.querySelector('#kbValue').value='نرد خلال ساعة';p.d.querySelector('#kbSave').click();await flush();await flush();
  const save=p.requests.find(r=>r.body.op==='add_knowledge');assert.deepEqual(save.body,{op:'add_knowledge',topic:'faq',value:'نرد خلال ساعة'});assert.equal(save.credentials,'include');for(const key of ['companyId','company_id','tenantId','projectId'])assert.equal(key in save.body,false);
  assert.match(p.d.querySelector('#memList').textContent,/الإصدار 2/);assert.match(p.d.querySelector('#memList').textContent,/50٪/);assert.match(p.d.querySelector('#memList').textContent,/نرد خلال ساعة/);
  p.d.querySelector('[data-kedit]').click();assert.equal(p.d.querySelector('#kbTopic').value,'faq');assert.equal(p.d.querySelector('#kbValue').value,'نرد خلال ساعة');p.d.querySelector('#kbValue').value='نرد خلال ساعتين';p.d.querySelector('#kbSave').click();await flush();await flush();
  const saves=p.requests.filter(r=>r.body.op==='add_knowledge');assert.deepEqual(saves[1].body,{op:'add_knowledge',topic:'faq',key:'server-key',value:'نرد خلال ساعتين'});
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
  const plan=p.d.querySelector('#pane-plan');assert.match(plan.textContent,/بيانات الاشتراك والاستخدام غير متاحة/);assert.match(plan.textContent,/سارة.*نشط في السجل/);assert.match(plan.textContent,/2 موظف مسجل/);
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
  assert.equal(unavailable.length,2);for(const button of unavailable){assert.equal(button.disabled,true);button.click();}
  assert.match(p.d.querySelector('#attachBtn').getAttribute('aria-label'),/غير متاح/);assert.equal(p.requests.length,2);
  p.d.querySelector('#hireFromPlan').click();assert.equal(p.d.activeElement.id,'input');assert.match(p.d.querySelector('#input').placeholder,/مهمة الموظف/);assert.equal(p.requests.length,2);assert.equal(p.d.querySelector('#thread').classList.contains('thread--emp'),false);
  assert.equal(p.d.querySelector('#exportBtn').disabled,false);
 }finally{p.close();}
});
test('historical demo keeps its original plan and controls separate from real account restrictions',async()=>{
 const p=await page({storage:{},hash:'',real:false});try{
  assert.ok(!p.w.__SIY_REAL__);assert.equal(p.d.querySelector('#attachBtn').disabled,false);assert.equal(p.d.querySelector('#deleteAccountBtn').disabled,false);assert.ok(!p.d.querySelector('#pane-plan').textContent.includes('بيانات الاشتراك غير متاحة'));assert.equal(p.requests.length,0);
 }finally{p.close();}
});

test('real deep link say prefills central composer and cannot submit without explicit user send',async()=>{
 const text='أنشئ موظفًا ثم شغله';
 const p=await page({hash:'#e=employee-record-1&say='+encodeURIComponent(text),hydrate:{...empty,team:[employee]},message:{ok:true,conversation_id:'explicit',reply:'وصل طلبك'}});try{
  await new Promise(resolve=>setTimeout(resolve,240));assert.equal(p.requests.length,2);assert.equal(p.requests[0].body.op,'hydrate');assert.equal(p.d.querySelector('#input').value,text);assert.equal(p.d.activeElement.id,'input');assert.equal(p.d.querySelector('#thread').classList.contains('thread--emp'),false);
  p.d.querySelector('#send').click();await flush();const req=p.requests.find(r=>r.body.op==='message');assert.equal(req.body.message,text);assert.equal(req.body.employee_id,null);assert.equal(p.requests.filter(r=>r.body.op==='message').length,1);
 }finally{p.close();}
});

test('real notifications are unavailable without channel or scheduled delivery claims',async()=>{
 const p=await page();try{
  const control=p.d.querySelector('#notificationSwitch'),row=control.closest('.srow');
  assert.equal(control.disabled,true);assert.equal(control.getAttribute('aria-checked'),'false');assert.match(row.textContent,/الإشعارات غير متاحة/);
  for(const claim of ['واتساب + بريد','ملخص يومي','تنبيه عند'])assert.ok(!row.textContent.includes(claim));
  control.click();assert.equal(p.requests.length,2);assert.equal(control.getAttribute('aria-checked'),'false');
 }finally{p.close();}
 const demo=await page({storage:{},hash:'',real:false});try{assert.equal(demo.d.querySelector('#notificationSwitch').disabled,false);assert.equal(demo.d.querySelector('#notificationSwitch').getAttribute('aria-checked'),'true');}finally{demo.close();}
});


test('provider reply tables preserve subjects, whitespace and escape HTML in RTL and LTR',async()=>{
  const reply='آخر الرسائل\n\n| المرسل | الموضوع |\n| --- | --- |\n| **GitHub** | Activepieces MCP Flow — update |\n| Google | <img src=x onerror=alert(1)> & \"notice\" |\n| Name | left\\|right |\n\nنهاية  التقرير';
  for(const locale of ['ar','en']){
    const p=await page({locale,message:{ok:true,conversation_id:'table-reply',reply}});try{
      send(p,'آخر الإيميلات');await flush();
      const table=p.d.querySelector('.reply-table table');assert.ok(table);
      assert.equal(table.querySelectorAll('tbody tr').length,3);
      assert.equal(table.querySelector('th').getAttribute('scope'),'col');
      assert.equal(table.querySelector('td').getAttribute('dir'),'auto');
      assert.equal(table.querySelector('td strong').textContent,'GitHub');
      assert.equal(table.querySelectorAll('td')[1].textContent,'Activepieces MCP Flow — update');
      assert.equal(table.querySelectorAll('td')[3].textContent,'<img src=x onerror=alert(1)> & "notice"');
      assert.equal(table.querySelectorAll('td')[5].textContent,'left|right');
      assert.equal(table.querySelector('img'),null);assert.equal(table.querySelector('script'),null);
      assert.ok(thread(p).includes('نهاية  التقرير'));
      assert.equal(p.d.documentElement.dir,locale==='ar'?'rtl':'ltr');
    }finally{p.close();}
  }
});
test('malformed tables and raw HTML remain escaped reply text without active links',async()=>{
  const reply='| x | y |\n| invalid | --- |\n<script>alert(1)</script> **<svg onload=alert(1)>** [click](javascript:alert(1))';
  const p=await page({message:{ok:true,conversation_id:'unsafe-reply',reply}});try{
    send(p,'اقرأ');await flush();
    const body=p.d.querySelectorAll('.m__c');const last=body[body.length-1];
    assert.equal(last.querySelector('table,script,svg,a,img'),null);
    assert.ok(last.textContent.includes('<script>alert(1)</script>'));
    assert.ok(last.textContent.includes('| invalid | --- |'));
  }finally{p.close();}
});
test('saved message timestamps display Riyadh time independently of browser timezone',async()=>{
  const saved={id:'riyadh-time',title:'وقت',messages:[{role:'user',content:'متى',at:'2026-10-05T00:05:00.000Z'},{role:'assistant',content:'الآن',at:'2026-10-05T21:05:00.000Z'}]};
  const p=await page({hydrate:{...empty,conversations:[saved]}});try{
    p.d.querySelector('[data-chat="riyadh-time"]').click();
    assert.equal(p.d.querySelector('.m--me .m__t').textContent,'03:05');
    assert.match(p.d.querySelector('.m:not(.m--me) .m__t').textContent,/00:05/);
  }finally{p.close();}
});


test('real chat keeps composer focus and announces processing without invented explanation',async()=>{
  let resolve;const waiting=new Promise(r=>resolve=r);
  const p=await page({message:()=>waiting});try{
    assert.match(thread(p),/وش هدفك اليوم/);
    send(p,'اعرض المعلومات');await flush();
    assert.equal(p.d.activeElement,p.d.querySelector('#input'));
    assert.equal(p.d.querySelector('.think').getAttribute('role'),'status');
    assert.doesNotMatch(thread(p),/راجعت.*أداة|كل حركة.*سطر|\d+٪/);
    resolve({ok:true,conversation_id:'focus',request_status:'succeeded',work_status:'not_started',outcome_kind:'conversation_reply',reply:'جواب المصدر كما هو.'});await flush();
    assert.equal(p.d.activeElement,p.d.querySelector('#input'));
    assert.equal(p.d.querySelector('[data-why]'),null);
    assert.match(thread(p),/جواب المصدر كما هو/);
    assert.equal(p.d.querySelector('.request-state'),null);
  }finally{p.close();}
});
test('actual queued status changes to running then disappears with final answer in both languages',async()=>{
  for(const locale of ['ar','en']){
    let calls=0;const p=await page({locale,message:{ok:true,conversation_id:'state',work_id:'w',work_status:'queued',reply:'استلمنا الطلب'},work:()=>++calls===1?{ok:true,work_status:'running',reply:'يعمل الآن'}:{ok:true,request_status:'succeeded',work_status:'succeeded',reply:'نتيجة المصدر'}});try{
      send(p,'نفذ');await flush();assert.equal(p.d.querySelector('.request-state').dataset.state,'queued');
      await p.polls.shift()();assert.equal(p.d.querySelector('.request-state').dataset.state,'running');
      await p.polls.shift()();assert.equal(p.d.querySelector('.request-state'),null);assert.match(thread(p),/نتيجة المصدر/);
      assert.equal(p.d.activeElement,p.d.querySelector('#input'));
    }finally{p.close();}
  }
});
test('polling preserves reading position instead of pulling user away from earlier messages',async()=>{
  const p=await page({message:{ok:true,conversation_id:'scroll',work_id:'w',work_status:'running',reply:'جار العمل'},work:{ok:true,work_status:'succeeded',reply:'النتيجة'}});try{
    send(p,'نفذ');await flush();const scroller=p.d.querySelector('#thread');
    Object.defineProperties(scroller,{scrollHeight:{configurable:true,value:1800},clientHeight:{configurable:true,value:500}});scroller.scrollTop=200;
    await p.polls.shift()();assert.equal(scroller.scrollTop,200);
    send(p,'طلب جديد');await flush();assert.equal(scroller.scrollTop,1800);
  }finally{p.close();}
});
test('real response is fully visible with reduced motion and does not animate history on refresh',async()=>{
  const p=await page({message:{ok:true,conversation_id:'motion',reply:'النص الكامل بلا انتظار إضافي'}});try{
    send(p,'سؤال');await flush();
    assert.ok(p.d.body.classList.contains('chat-real'));
    assert.equal(p.d.querySelector('.m--rev .w'),null);
    assert.match(thread(p),/النص الكامل بلا انتظار إضافي/);
    assert.match(html,/\.chat-real \.m\{animation:none\}/);
    assert.match(html,/@media \(prefers-reduced-motion:reduce\)\{ \*\{animation:none !important;transition:none !important\}/);
  }finally{p.close();}
});


test('completed native action without text uses action wording and no provider or flow proof',async()=>{
  const p=await page({message:{ok:true,conversation_id:'native',request_status:'succeeded',work_status:'succeeded',outcome_kind:'tool_result'}});try{
    send(p,'اقرأ');await flush();
    assert.match(thread(p),/اكتمل استدعاء الأداة/);assert.doesNotMatch(thread(p),/سُجّل التشغيل|✓|نتيجة.*مثبتة/);
    assert.equal(p.d.querySelector('.request-state'),null);
  }finally{p.close();}
});
test('ActionRun metadata stays inside technical details without KPI proof or unsafe IDs',async()=>{
  const run='m1rtHgkyZhT0Mr3kWJwty';
  const p=await page({message:{ok:true,conversation_id:'native',request_status:'succeeded',work_status:'succeeded',outcome_kind:'tool_result',reply:'هذا رد المصدر.',tool_receipts:[{name:'ap_run_action',status:'returned',run_id:run,outcome:'action_completed'},{name:'ap_run_action',status:'error',run_id:'<img src=x onerror=alert(1)>',outcome:'unverified',effect_attempted:true}]}});try{
    send(p,'اقرأ');await flush();const details=p.d.querySelector('.m__c details');assert.ok(details);assert.equal(details.open,false);
    assert.match(details.textContent,/اكتمل استدعاء الإجراء/);assert.match(details.textContent,/تعذّر الاستدعاء/);
    assert.equal(details.querySelector('code').textContent,run);assert.equal(details.querySelectorAll('code').length,1);
    assert.equal(details.querySelector('img'),null);assert.doesNotMatch(thread(p),/✓|KPI|FlowRun/);
    assert.ok(thread(p).includes('هذا رد المصدر.'));
  }finally{p.close();}
});


test('team summary exposes recorded draft and pause states without fabricated billing controls',async()=>{
  const p=await page({hydrate:{...empty,team:[{...employee,recordId:'draft',name:'مسودة <img src=x>',status:'disabled',tools:[]},{...employee,recordId:'paused',name:'متوقف',status:'disabled',tools:['gmail']}]}});try{
    const panel=p.d.querySelector('#pane-plan');assert.match(panel.textContent,/مسودة محفوظة/);assert.match(panel.textContent,/متوقف في السجل/);
    assert.match(panel.textContent,/مسودة <img src=x>/);assert.equal(panel.querySelector('img'),null);
    assert.equal(panel.querySelectorAll('button[disabled]').length,0);assert.ok(panel.querySelector('#hireFromPlan'));
    assert.equal(panel.querySelectorAll('.srow').length,2);assert.doesNotMatch(panel.textContent,/ر.س|الرصيد المسبق|قيد العمل/);
  }finally{p.close();}
  const failed=await page({hydrate:Error('offline')});try{
    assert.match(failed.d.querySelector('#pane-plan').textContent,/تعذّر تحميل الفريق/);
    assert.doesNotMatch(failed.d.querySelector('#pane-plan').textContent,/0 موظف/);
  }finally{failed.close();}
});


test('limited native output notice accepts only true and escapes malicious receipt metadata',async()=>{
  for(const locale of ['ar','en']){
    const p=await page({locale,message:{ok:true,conversation_id:'limited',request_status:'succeeded',work_status:'succeeded',outcome_kind:'tool_result',reply:'نص المصدر الكامل كما عاد.',tool_receipts:[{name:'ap_run_action',status:'returned',output_limited:true},{name:'<img src=x onerror=alert(1)>',status:'returned',run_id:'<svg onload=alert(1)>',outcome:'<script>alert(1)</script>',output_limited:'true'},{name:'ap_run_action',status:'returned',output_limited:{value:true}}]}});try{
      send(p,'اقرأ');await flush();const details=p.d.querySelector('.m__c details');assert.ok(details);assert.equal(details.open,false);
      const notice=locale==='en'?'The service shortened some fields':'اختصرت الخدمة بعض الحقول';assert.equal(details.textContent.split(notice).length-1,1);
      assert.equal(details.querySelector('img,svg,script'),null);assert.ok(details.textContent.includes('<img src=x onerror=alert(1)>'));
      assert.ok(thread(p).includes('نص المصدر الكامل كما عاد.'));assert.doesNotMatch(details.textContent,/KPI|\d+٪/);
    }finally{p.close();}
  }
});

test('saved instructions handoff stays short, employee scoped, escaped and requires explicit chat send in RTL and LTR',async()=>{
  for(const locale of ['ar','en']){
    const instructions='x'.repeat(11000)+'</textarea><img src=x onerror=alert(1)>';
    const p=await page({locale,hydrate:{...empty,team:[{...employee,instructions}]},message:{ok:true,conversation_id:'instruction-chat',request_status:'succeeded',work_status:'not_started',outcome_kind:'conversation_reply',reply:'أراجع طريقة العمل.'}});try{
      p.d.querySelector('#emps .emp').click();p.d.querySelector('#instrTgl').click();
      assert.equal(p.d.querySelector('#instr').value,instructions);assert.equal(p.d.querySelector('#instrWrap img'),null);
      const before=p.requests.filter(x=>x.body?.op==='message').length;
      p.d.querySelector('#instrApply').click();const composer=p.d.querySelector('#input');
      assert.equal(p.d.activeElement,composer);assert.ok(composer.value.length<5000);assert.ok(!composer.value.includes(instructions));
      assert.match(composer.value,locale==='ar'?/التعليمات المحفوظة/:/saved instructions/);
      assert.equal(p.requests.filter(x=>x.body?.op==='message').length,before);
      p.d.querySelector('#send').click();await flush();const sent=p.requests.find(x=>x.body?.op==='message');assert.equal(sent.body.employee_id,employee.recordId);
      assert.ok(sent.body.message.length<5000);assert.equal(p.d.documentElement.dir,locale==='ar'?'rtl':'ltr');
      assert.doesNotMatch(thread(p),/أصبحت النسخة المعتمدة|is now current|تم التفعيل/);
    }finally{p.close();}
  }
});
test('unsaved edits block the workflow handoff and a DB readback never claims runtime adoption',async()=>{
  const changed='التعليمات الجديدة';
  const p=await page({hydrate:{...empty,team:[{...employee,instructions:'التعليمات السابقة'}]},employee_instructions:body=>({ok:true,instruction_scope:'conversation',instructions_verified:true,employee:{...employee,instructions:body.instructions,instructionVersion:2,instructionSource:'owner'}})});try{
    p.d.querySelector('#emps .emp').click();p.d.querySelector('#instrTgl').click();p.d.querySelector('#instr').value=changed;p.d.querySelector('#instrApply').click();
    assert.equal(p.d.querySelector('#input').value,'');assert.match(p.d.querySelector('#instrF').textContent,/احفظ تعديلك أولًا/);
    p.d.querySelector('#instrSave').click();await flush();assert.match(p.d.querySelector('#instrF').textContent,/حُفظت للمحادثة.*لم يُتحقق منه/);
    assert.doesNotMatch(p.d.querySelector('#instrF').textContent,/أصبحت النسخة المعتمدة|تم التفعيل/);
    assert.equal(p.requests.filter(x=>x.body?.op==='message').length,0);p.d.querySelector('#instrApply').click();assert.ok(p.d.querySelector('#input').value);
  }finally{p.close();}
});
test('instruction save rejects an incompatible scope and a missing workflow has no apply shortcut',async()=>{
  const p=await page({hydrate:{...empty,team:[{...employee,flowId:null,status:'disabled',tools:[],instructions:'الأصل'}]},employee_instructions:body=>({ok:true,instruction_scope:'workflow',instructions_verified:true,employee:{...employee,instructions:body.instructions}})});try{
    p.d.querySelector('#emps .emp').click();p.d.querySelector('#reviewStart').click();assert.equal(p.d.querySelector('#instrApply'),null);
    p.d.querySelector('#instr').value='جديد';p.d.querySelector('#instrSave').click();await flush();assert.equal(p.w.EMPS[0].instr,'الأصل');
    assert.match(p.d.querySelector('#instrF').textContent,/لم تتطابق قراءة التعليمات/);assert.doesNotMatch(p.d.querySelector('#instrF').textContent,/حُفظت للمحادثة/);
  }finally{p.close();}
});


test('instruction application does not overwrite the manager’s unsent message',async()=>{
  const p=await page({hydrate:{...empty,team:[{...employee,instructions:'تعليمات محفوظة'}]}});try{
    p.d.querySelector('#emps .emp').click();p.d.querySelector('#instrTgl').click();
    const composer=p.d.querySelector('#input');composer.value='سؤالي الذي لم أرسله';
    p.d.querySelector('#instrApply').click();
    assert.equal(composer.value,'سؤالي الذي لم أرسله');
    assert.equal(p.d.activeElement,composer);
    assert.match(p.d.querySelector('#instrF').textContent,/رسالة لم ترسلها/);
    assert.equal(p.requests.filter(x=>x.body?.op==='message').length,0);
  }finally{p.close();}
});

const readyEmployee={...employee,flowId:'f'.repeat(21)};
test('native draft receipt shows scoped TESTING proof without production claim',async()=>{
  for(const locale of ['ar','en']){
    const p=await page({locale,message:{ok:true,conversation_id:'draft-proof',request_status:'succeeded',work_status:'succeeded',outcome_kind:'flow_draft_saved',draft_receipt:{flow_id:'F'.repeat(21),version_id:'v1',status:'DRAFT',test_run_id:'R'.repeat(21),test_environment:'TESTING'}}});try{
      send(p,'جهز المسودة واختبرها');await flush();
      const details=p.d.querySelector('.m__c .siyrefs');assert.ok(details);
      assert.deepEqual([...details.querySelectorAll('code')].map(x=>x.textContent),['F'.repeat(21),'R'.repeat(21)]);
      assert.match(thread(p),locale==='ar'?/لم تُنشر أو تُشغّل إنتاجيًا/:/not published or run in production/);
      assert.equal(p.d.querySelector('.request-state'),null);
    }finally{p.close();}
  }
});
const readiness={employee_id:employee.recordId,flow_id:readyEmployee.flowId,published_version_id:'v'.repeat(21),test_run_id:'r'.repeat(21),test_environment:'TESTING',used_mock_trigger_data:true};
test('employee readiness uses collapsed TESTING evidence without claiming provider or KPI success in RTL and LTR',async()=>{
  for(const locale of ['ar','en']){
    const p=await page({locale,hydrate:{...empty,team:[readyEmployee]},message:{ok:true,conversation_id:'ready',request_status:'succeeded',work_status:'succeeded',outcome_kind:'employee_ready',employee:readyEmployee,readiness_receipt:readiness,recent_work:[{...proof,flowId:readyEmployee.flowId}]}});try{
      p.d.querySelector('#emps .emp').click();send(p,'جهّز الموظف');await flush();
      const details=p.d.querySelector('.m__c .siyrefs');assert.ok(details);assert.equal(details.open,false);
      assert.match(thread(p),locale==='ar'?/اختبرنا طريقة العمل وفعّلناها/:/tested and activated the workflow/);
      assert.match(details.textContent,/TESTING/);assert.match(details.textContent,locale==='ar'?/بيانات مشغّل تجريبية/:/mock trigger data/);
      assert.deepEqual([...details.querySelectorAll('code')].map(x=>x.textContent),[readiness.flow_id,readiness.published_version_id,readiness.test_run_id]);
      assert.doesNotMatch(thread(p),/✓|فرصة أ|سُجلت الفرصة|KPI/);assert.equal(p.d.querySelector('.request-state'),null);
      assert.equal(p.w.__SIY_DASH__.recent_work.length,0);
    }finally{p.close();}
  }
});
test('invalid readiness cannot claim preparation or display malicious IDs despite an old active employee',async()=>{
  const invalid=[undefined,{...readiness,employee_id:'other'},{...readiness,flow_id:'<img src=x>'},{...readiness,published_version_id:42},{...readiness,test_run_id:'<svg onload=alert(1)>'},{...readiness,test_environment:'PRODUCTION'},{...readiness,used_mock_trigger_data:1}];
  for(const receipt of invalid){
    const p=await page({message:{ok:true,conversation_id:'invalid',request_status:'succeeded',work_status:'succeeded',outcome_kind:'employee_ready',employee:readyEmployee,readiness_receipt:receipt}});try{
      send(p,'جهّز');await flush();assert.match(thread(p),/لم نتأكد من اختبار طريقة العمل/);assert.doesNotMatch(thread(p),/اختبرنا طريقة العمل وفعّلناها/);
      assert.equal(p.d.querySelector('.m__c .siyrefs'),null);assert.equal(p.d.querySelector('.request-state').dataset.state,'unknown');
      assert.equal(p.d.querySelector('.m__c img,.m__c svg'),null);
    }finally{p.close();}
  }
});
test('readiness preserves the model reply and does not complete an uncertain mixed request',async()=>{
  const reply='تعليمات الشركة كما وردت: Activepieces MCP Flow <img src=x>.';
  const p=await page({message:{ok:true,conversation_id:'mixed',request_status:'not_observed',work_status:'unknown',outcome_kind:'unverified',employee:readyEmployee,readiness_receipt:{...readiness,used_mock_trigger_data:false},reply,recent_work:[proof]}});try{
    send(p,'جهّز وأرسل');await flush();assert.ok(thread(p).includes(reply));assert.equal(p.d.querySelector('.request-state').dataset.state,'unknown');
    const details=p.d.querySelector('.m__c .siyrefs');assert.ok(details);assert.match(details.textContent,/TESTING/);assert.doesNotMatch(details.textContent,/بيانات مشغّل تجريبية/);
    assert.doesNotMatch(thread(p),/اختبرنا طريقة العمل وفعّلناها|✓|فرصة أ/);assert.equal(p.d.querySelector('.m__c img'),null);
  }finally{p.close();}
});

const publishedEmployee={...employee,flowId:'f'.repeat(21),instructions:'تعليمات المحادثة {{kept}}'};
const publishedProjection={flow_id:publishedEmployee.flowId,published_version_id:'v'.repeat(21),flow_status:'ENABLED',read_status:'verified',steps:[{step_name:'step_1',display_name:'التحليل',prompt:'<img src=x onerror=alert(1)> {{step_2.output}}\nMCP original'},{step_name:'step_2',display_name:'Agent task',prompt:'نفّذ المهمة',agent_instructions_unverified:true}]};
for(const locale of ['ar','en'])test('published instructions are lazy, literal, separate from conversation and honest about saved agent '+locale,async()=>{
  const p=await page({locale,hash:'#e='+publishedEmployee.recordId,hydrate:{...empty,team:[publishedEmployee]},employee_instructions:body=>({ok:true,published_instructions:publishedProjection})});try{
    assert.equal(p.requests.filter(r=>r.body?.read_published).length,0);
    p.d.querySelector('#instrTgl').click();p.d.querySelector('#instr').value='unsaved {{draft}}';await flush();await flush();
    const panel=p.d.querySelector('#publishedInstr');assert.equal(panel.querySelector('img'),null);assert.match(panel.textContent,/<img src=x onerror=alert\(1\)> \{\{step_2.output\}\}/);assert.match(panel.textContent,/MCP original/);assert.equal(panel.querySelectorAll('details.adv').length,2);
    assert.match(panel.textContent,locale==='en'?/task input; the saved agent’s own instructions are unverified/:/مدخل مهمة للوكيل؛ تعليمات الوكيل المحفوظ نفسه لم تُتحقق/);
    assert.equal(p.d.querySelector('#instr').value,'unsaved {{draft}}');assert.equal(p.requests.at(-1).body.employee_id,publishedEmployee.recordId);assert.equal(p.requests.at(-1).body.read_published,true);
  }finally{p.close();}
});

test('published projection states never infer runnable instructions or a provider result',async()=>{
  for(const projection of [{...publishedProjection,flow_status:'DISABLED',steps:[]},{flow_id:publishedEmployee.flowId,read_status:'not_published'},{flow_id:publishedEmployee.flowId,read_status:'unavailable'},{...publishedProjection,flow_id:'wrong'},{...publishedProjection,published_version_id:'<script>'}]){
    const p=await page({hash:'#e='+publishedEmployee.recordId,hydrate:{...empty,team:[publishedEmployee]},employee_instructions:{ok:true,published_instructions:projection}});try{
      p.d.querySelector('#instrTgl').click();await flush();await flush();const panel=p.d.querySelector('#publishedInstr');
      if(projection.flow_status==='DISABLED'){assert.match(panel.textContent,/طريقة العمل متوقفة/);assert.match(panel.textContent,/لا توجد تعليمات خطوات/);}
      else if(projection.read_status==='not_published')assert.match(panel.textContent,/لا توجد نسخة منشورة/);
      else assert.match(panel.textContent,/تعذّرت قراءة/);
      assert.equal(panel.querySelector('script'),null);assert.equal(p.requests.filter(r=>r.body?.op==='message').length,0);
    }finally{p.close();}
  }
});

test('late published response cannot overwrite another employee panel or unsaved edits',async()=>{
  let resolveRead;const other={...publishedEmployee,recordId:'other',name:'آخر',flowId:'o'.repeat(21),instructions:'other instructions'};
  const p=await page({hash:'#e='+publishedEmployee.recordId,hydrate:{...empty,team:[publishedEmployee,other]},employee_instructions:body=>body.employee_id===publishedEmployee.recordId?new Promise(resolve=>{resolveRead=resolve;}):{ok:true,published_instructions:{...publishedProjection,flow_id:other.flowId,steps:[]}}});try{
    p.d.querySelector('#instrTgl').click();await flush();
    p.d.querySelectorAll('#emps .emp')[1].click();p.d.querySelector('#instrTgl').click();p.d.querySelector('#instr').value='other unsaved';await flush();await flush();
    resolveRead({ok:true,published_instructions:publishedProjection});await flush();await flush();
    assert.equal(p.d.querySelector('#instr').value,'other unsaved');assert.doesNotMatch(p.d.querySelector('#publishedInstr').textContent,/MCP original/);assert.match(p.d.querySelector('#publishedInstr').textContent,/لا توجد تعليمات خطوات/);
  }finally{p.close();}
});

test('reopening instructions refreshes publication and ignores an older response',async()=>{
  let firstResolve,count=0;const p=await page({hash:'#e='+publishedEmployee.recordId,hydrate:{...empty,team:[publishedEmployee]},employee_instructions:()=>++count===1?new Promise(resolve=>{firstResolve=resolve;}):{ok:true,published_instructions:{...publishedProjection,steps:[{prompt:'latest published'}]}}});try{
    p.d.querySelector('#instrTgl').click();await flush();p.d.querySelector('#instr').value='still unsaved';p.d.querySelector('#instrTgl').click();p.d.querySelector('#instrTgl').click();await flush();await flush();
    firstResolve({ok:true,published_instructions:publishedProjection});await flush();await flush();
    assert.match(p.d.querySelector('#publishedInstr').textContent,/latest published/);assert.doesNotMatch(p.d.querySelector('#publishedInstr').textContent,/MCP original/);assert.equal(p.d.querySelector('#instr').value,'still unsaved');assert.equal(count,2);
  }finally{p.close();}
});


test('published steps display server name when no display label exists',async()=>{
  const p=await page({hash:'#e='+publishedEmployee.recordId,hydrate:{...empty,team:[publishedEmployee]},employee_instructions:{ok:true,published_instructions:{...publishedProjection,steps:[{name:'analysis_1',prompt:'first'},{name:'<img src=x>',prompt:'second'}]}}});try{
    p.d.querySelector('#instrTgl').click();await flush();await flush();
    assert.deepEqual(Array.from(p.d.querySelectorAll('#publishedInstr details.adv > summary'),el=>el.textContent),['analysis_1','<img src=x>']);assert.equal(p.d.querySelector('#publishedInstr img'),null);
  }finally{p.close();}
});

for(const locale of ['ar','en'])test('late activation redraw preserves the instruction panel, edit, focus and selection '+locale,async()=>{
  let resolveResume;const p=await page({locale,hydrate:{...empty,team:[publishedEmployee]},resume_employee_activation:body=>body.employee_id?new Promise(resolve=>{resolveResume=resolve;}):{ok:true,activation_status:'none'},employee_instructions:{ok:true,published_instructions:publishedProjection}});try{
    p.d.querySelector('#emps .emp').click();await flush();assert.equal(p.d.querySelector('#onSw').disabled,true);assert.equal(p.d.querySelector('#onSw').getAttribute('aria-busy'),'true');
    p.d.querySelector('#instrTgl').click();await flush();await flush();const editor=p.d.querySelector('#instr'),panel=p.d.querySelector('#instrWrap');editor.value='unsaved {{keep}}';editor.focus();editor.setSelectionRange(2,8,'backward');
    resolveResume({ok:true,activation_status:'pending',employee_id:publishedEmployee.recordId,message:'<img src=x> connection missing'});await flush();await flush();
    assert.equal(p.d.querySelector('#instrWrap'),panel);assert.equal(panel.hidden,false);assert.equal(editor.value,'unsaved {{keep}}');assert.equal(p.d.activeElement,editor);assert.deepEqual([editor.selectionStart,editor.selectionEnd,editor.selectionDirection],[2,8,'backward']);assert.equal(p.d.querySelector('#instrTgl').getAttribute('aria-expanded'),'true');assert.match(p.d.querySelector('.pin__s').textContent,/connection missing/);assert.equal(p.d.querySelector('.pin__s img'),null);assert.equal(p.d.querySelector('#onSw').disabled,false);
  }finally{p.close();}
});

test('activation errors and multiple pending choice are visible without pretending success',async()=>{
  for(const response of [new Error('activation read failed'),{ok:true,activation_status:'pending',message:'افتح الموظف المقصود'}]){
    const p=await page({hydrate:{...empty,team:[publishedEmployee]},resume_employee_activation:body=>body.employee_id?response:{ok:true,activation_status:'none'}});try{
      p.d.querySelector('#emps .emp').click();await flush();await flush();
      assert.match(p.d.querySelector('#builderConnectState').textContent,response instanceof Error?/activation read failed/:/افتح الموظف المقصود/);assert.equal(p.d.querySelector('#onSw').getAttribute('aria-checked'),'true');assert.equal(p.d.querySelector('#onSw').disabled,false);assert.equal(p.d.querySelector('#onSw').hasAttribute('aria-busy'),false);
    }finally{p.close();}
  }
});

test('late activation response preserves the newly selected employee and never imports the old panel',async()=>{
  let resolveResume;const other={...publishedEmployee,recordId:'other',flowId:'o'.repeat(21),name:'آخر',instructions:'other saved'};
  const p=await page({hydrate:{...empty,team:[publishedEmployee,other]},resume_employee_activation:body=>body.employee_id?new Promise(resolve=>{resolveResume=resolve;}):{ok:true,activation_status:'none'},employee_instructions:body=>({ok:true,published_instructions:{...publishedProjection,flow_id:body.employee_id==='other'?other.flowId:publishedEmployee.flowId}})});try{
    p.d.querySelectorAll('#emps .emp')[0].click();await flush();p.d.querySelector('#instrTgl').click();p.d.querySelector('#instr').value='old unsaved';
    p.d.querySelectorAll('#emps .emp')[1].click();p.d.querySelector('#instrTgl').click();const editor=p.d.querySelector('#instr');editor.value='other unsaved';editor.focus();editor.setSelectionRange(1,5);
    resolveResume({ok:true,activation_status:'active',employee:publishedEmployee});await flush();await flush();
    assert.match(p.d.querySelector('#whoN').textContent,/آخر/);assert.equal(p.d.querySelector('#instr'),editor);assert.equal(editor.value,'other unsaved');assert.equal(p.d.activeElement,editor);assert.equal(p.d.querySelector('#onSw').getAttribute('aria-checked'),'true');
  }finally{p.close();}
});

test('automatic activation rejects a mismatched flow instead of changing the switch',async()=>{
  const paused={...publishedEmployee,status:'disabled'};const p=await page({hydrate:{...empty,team:[paused]},resume_employee_activation:body=>body.employee_id?{ok:true,activation_status:'active',employee:{...paused,status:'active',flowId:'x'.repeat(21)}}:{ok:true,activation_status:'none'}});try{
    p.d.querySelector('#emps .emp').click();await flush();await flush();assert.equal(p.d.querySelector('#onSw').getAttribute('aria-checked'),'false');assert.match(p.d.querySelector('#builderConnectState').textContent,/لم نتأكد من نتيجة التفعيل/);
  }finally{p.close();}
});

test('activation refreshes only published readback while a pending instruction save updates the current employee',async()=>{
  let resolveResume,resolveSave,reads=0;const p=await page({hydrate:{...empty,team:[publishedEmployee]},resume_employee_activation:body=>body.employee_id?new Promise(resolve=>{resolveResume=resolve;}):{ok:true,activation_status:'none'},employee_instructions:body=>body.read_published?{ok:true,published_instructions:{...publishedProjection,published_version_id:(++reads===1?'v':'n').repeat(21)}}:new Promise(resolve=>{resolveSave=resolve;})});try{
    p.d.querySelector('#emps .emp').click();await flush();p.d.querySelector('#instrTgl').click();await flush();await flush();const editor=p.d.querySelector('#instr');editor.value='new saved instructions';p.d.querySelector('#instrSave').click();await flush();
    resolveResume({ok:true,activation_status:'active',employee:publishedEmployee});await flush();await flush();assert.equal(p.d.querySelector('#instr'),editor);assert.equal(editor.value,'new saved instructions');assert.equal(reads,2);assert.match(p.d.querySelector('#publishedInstr').textContent,new RegExp('n'.repeat(21)));
    resolveSave({ok:true,instruction_scope:'conversation',instructions_verified:true,employee:{...publishedEmployee,instructions:'new saved instructions',instructionSource:'owner',instructionVersion:2}});await flush();await flush();
    assert.equal(p.w.EMPS[0].instr,'new saved instructions');assert.equal(p.d.querySelector('#instrSave').disabled,false);p.d.querySelector('#instrApply').click();assert.match(p.d.querySelector('#input').value,/التعليمات المحفوظة/);assert.equal(p.requests.filter(r=>r.body?.op==='message').length,0);
  }finally{p.close();}
});

test('an older activation response cannot downgrade newer saved conversation instructions',async()=>{
  let resolveResume;const p=await page({hydrate:{...empty,team:[publishedEmployee]},resume_employee_activation:body=>body.employee_id?new Promise(resolve=>{resolveResume=resolve;}):{ok:true,activation_status:'none'},employee_instructions:body=>body.read_published?{ok:true,published_instructions:publishedProjection}:{ok:true,instruction_scope:'conversation',instructions_verified:true,employee:{...publishedEmployee,instructions:body.instructions,instructionVersion:2,instructionSource:'owner'}}});try{
    p.d.querySelector('#emps .emp').click();await flush();p.d.querySelector('#instrTgl').click();const editor=p.d.querySelector('#instr');editor.value='newer saved';p.d.querySelector('#instrSave').click();await flush();await flush();
    resolveResume({ok:true,activation_status:'active',employee:{...publishedEmployee,instructionVersion:1}});await flush();await flush();assert.equal(p.w.EMPS[0].instr,'newer saved');assert.equal(p.w.EMPS[0].instrVersion,2);assert.equal(editor.value,'newer saved');p.d.querySelector('#instrApply').click();assert.match(p.d.querySelector('#input').value,/التعليمات المحفوظة/);
  }finally{p.close();}
});

test('automatic activation rejects unknown employees and foreign pending notices',async()=>{
  for(const response of [{ok:true,activation_status:'active',employee:{recordId:'foreign',name:'Foreign',status:'active'}},{ok:true,activation_status:'pending',employee_id:'foreign',message:'foreign tenant note'}]){
    const p=await page({hydrate:{...empty,team:[publishedEmployee]},resume_employee_activation:body=>body.employee_id?response:{ok:true,activation_status:'none'}});try{
      p.d.querySelector('#emps .emp').click();await flush();await flush();assert.equal(p.w.EMPS.length,1);assert.match(p.d.querySelector('#builderConnectState').textContent,/لم نتأكد من نتيجة التفعيل/);assert.doesNotMatch(thread(p),/foreign tenant note|Foreign/);
    }finally{p.close();}
  }
});

test('logout resets activation ownership and a late prior response cannot replace the new check',async()=>{
  let oldResolve,newResolve,count=0;const p=await page({hydrate:{...empty,team:[publishedEmployee]},resume_employee_activation:body=>body.employee_id?new Promise(resolve=>{if(++count===1)oldResolve=resolve;else newResolve=resolve;}):{ok:true,activation_status:'none'}});try{
    p.dom.virtualConsole.removeAllListeners('jsdomError');const originalFetch=p.w.fetch;p.w.fetch=(url,options)=>String(url).endsWith('/auth/logout')?Promise.resolve({ok:true}):originalFetch(url,options);
    p.d.querySelector('#emps .emp').click();await flush();p.d.querySelector('#instrTgl').click();const oldPanel=p.d.querySelector('#instrWrap');p.d.querySelector('#instr').value='old session draft';p.d.querySelector('#logoutBtn').click();await flush();p.d.querySelector('#emps .emp').click();await flush();assert.equal(count,2);assert.notEqual(p.d.querySelector('#instrWrap'),oldPanel);assert.notEqual(p.d.querySelector('#instr').value,'old session draft');
    oldResolve({ok:true,activation_status:'active',employee:publishedEmployee});await flush();await flush();assert.equal(p.d.querySelector('#onSw').getAttribute('aria-busy'),'true');
    newResolve({ok:true,activation_status:'pending',employee_id:publishedEmployee.recordId,message:'new check missing connection'});await flush();await flush();assert.match(p.d.querySelector('.pin__s').textContent,/new check missing connection/);assert.equal(p.d.querySelector('#onSw').disabled,false);
  }finally{p.close();}
});

test('a newly linked workflow adds the instruction apply shortcut without losing the open draft edit',async()=>{
  const draft={...publishedEmployee,flowId:null,status:'disabled',tools:[],instructions:'draft saved'};let resolveMessage;
  const p=await page({hash:'#e='+draft.recordId,hydrate:{...empty,team:[draft]},message:()=>new Promise(resolve=>{resolveMessage=resolve;}),employee_instructions:{ok:true,published_instructions:{flow_id:null,read_status:'not_published'}}});try{
    p.d.querySelector('#reviewStart').click();await flush();assert.equal(p.d.querySelector('#instrApply'),null);const editor=p.d.querySelector('#instr'),save=p.d.querySelector('#instrSave');editor.value='unsaved newly linked draft';editor.focus();editor.setSelectionRange(2,6);send(p,'جهز طريقة العمل');await flush();editor.focus();editor.setSelectionRange(2,6);
    resolveMessage({ok:true,request_status:'succeeded',work_status:'not_started',outcome_kind:'employee_draft',reply:'حفظت طريقة العمل.',employee:{...draft,flowId:publishedEmployee.flowId}});await flush();await flush();
    assert.ok(p.d.querySelector('#instrApply'));assert.equal(p.d.querySelector('#instr'),editor);assert.equal(p.d.querySelector('#instrSave'),save);assert.equal(editor.value,'unsaved newly linked draft');assert.equal(p.d.querySelector('#instrWrap').hidden,false);assert.equal(p.d.activeElement,editor);assert.deepEqual([editor.selectionStart,editor.selectionEnd],[2,6]);p.d.querySelector('#instrApply').click();assert.match(p.d.querySelector('#instrF').textContent,/احفظ تعديلك أولًا/);
  }finally{p.close();}
});

for(const locale of ['ar','en'])test('global activation notice is visible with the account popup closed and restores the composer footer '+locale,async()=>{
  let resolveResume;const p=await page({locale,hydrate:{...empty,team:[publishedEmployee]},resume_employee_activation:()=>new Promise(resolve=>{resolveResume=resolve;})});try{
    assert.equal(p.d.querySelector('#pop').classList.contains('on'),false);assert.match(p.d.querySelector('.comp__f').textContent,locale==='ar'?/نتحقق من جاهزية/:/Checking employee readiness/);
    resolveResume({ok:true,activation_status:'pending',message:'<img src=x> اختر الموظف للتجربة'});await flush();await flush();assert.match(p.d.querySelector('.comp__f').textContent,/اختر الموظف للتجربة/);assert.equal(p.d.querySelector('.comp__f img'),null);assert.equal(p.d.querySelector('.comp__f').closest('#pop,[hidden]'),null);
    p.d.querySelector('#emps .emp').click();await flush();resolveResume({ok:true,activation_status:'none'});await flush();await flush();assert.match(p.d.querySelector('.comp__f').textContent,locale==='ar'?/تظهر حالة كل طلب/:/Request status and results/);
  }finally{p.close();}
});

test('global activation error appears in the visible footer while a scoped notice does not leak to another chat',async()=>{
  let calls=0;const p=await page({hydrate:{...empty,team:[publishedEmployee]},resume_employee_activation:()=>++calls===1?new Error('global activation failed'):{ok:true,activation_status:'pending',employee_id:publishedEmployee.recordId,message:'employee connection missing'}});try{
    assert.equal(p.d.querySelector('#pop').classList.contains('on'),false);assert.match(p.d.querySelector('.comp__f').textContent,/global activation failed/);
    p.d.querySelector('#emps .emp').click();await flush();await flush();assert.match(p.d.querySelector('.comp__f').textContent,/employee connection missing/);p.d.querySelector('#newChat').click();assert.match(p.d.querySelector('.comp__f').textContent,/تظهر حالة كل طلب/);
  }finally{p.close();}
});

test('connection UI preserves exact method, multi-select defaults and excludes instruction markdown',async()=>{
  const fields=[{name:'algorithms',label:'Algorithms',type:'multiselect',required:true,defaultValue:['b'],options:[{label:'A',value:'a'},{label:'B',value:'b'}]},{name:'info',label:'Instructions',type:'markdown',description:'<b>Safe instructions</b>'}];
  const connection={id:'C'.repeat(21),slug:'gmail',status:'ACTIVE',scope:'PROJECT'};
  const p=await page({integrations:{list:{ok:true,connections:[]},methods:{ok:true,methods:[{id:'CUSTOM_AUTH:0',type:'CUSTOM_AUTH',available:true,fields:[]},{id:'CUSTOM_AUTH:1',type:'CUSTOM_AUTH',available:true,fields}]},connect:{ok:true,connection}},hash:''});
  try{
    p.d.querySelector('#toolsLink').click();await flush();p.d.querySelector('#allTgl').click();await flush();p.d.querySelector('[data-c="gmail"]').click();await flush();
    p.d.querySelector('[data-method="1"]').click();
    const select=p.d.querySelector('#mf0');assert.equal(select.multiple,true);assert.deepEqual(Array.from(select.selectedOptions).map(option=>option.value),['1']);assert.equal(p.d.querySelector('#mf1'),null);assert.equal(p.d.querySelector('#mF b'),null);
    select.options[1].selected=true;
    p.d.querySelector('#mF form').dispatchEvent(new p.w.Event('submit',{bubbles:true,cancelable:true}));await flush();
    const request=p.requests.find(request=>request.body?.op==='connect').body;
    assert.equal(request.methodId,'CUSTOM_AUTH:1');assert.deepEqual(request.values,{algorithms:['a','b']});
  }finally{p.close();}
});

test('blocked REST field discovery displays its unavailable state without inventing a connection form',async()=>{
  const message='حقول الربط تحتاج اكتشافًا أصليًا عبر أدوات الشركة؛ مسار REST متوقف.';
  const p=await page({integrations:{list:{ok:true,connections:[]},methods:new Error(message)},hash:''});
  try{
    p.d.querySelector('#toolsLink').click();await flush();p.d.querySelector('#allTgl').click();await flush();p.d.querySelector('[data-c="gmail"]').click();await flush();
    assert.match(p.d.querySelector('#mF').textContent,/مسار REST متوقف/);assert.equal(p.d.querySelector('#mF form'),null);
    assert.equal(p.requests.some(request=>['connect','oauth_start'].includes(request.body?.op)),false);
  }finally{p.close();}
});

test('workspace consent opens only after a customer click and saved authorization never claims tool readiness',async()=>{
  let reads=0,opened=0;
  const popup={closed:false,close(){this.closed=true;},location:{replace(url){this.url=url;}}};
  const p=await page({mcpStatus:()=>({ok:true,state:++reads===1?'authorization_required':'authorization_stored',grantRevision:reads===1?null:'a'.repeat(64),liveVerified:false}),mcpConnect:{ok:true,state:'authorization_required',authorizationRevision:'a'.repeat(64),authorizationUrl:'https://activepieces.example/authorize?state=sealed'},integrations:{list:{ok:true,connections:[]},methods:new Error('تجهيز حقول الربط غير متاح حاليًا.')},hash:''});
  try{
    p.w.open=()=>{opened++;return popup;};
    p.d.querySelector('#toolsLink').click();await flush();p.d.querySelector('#allTgl').click();await flush();p.d.querySelector('[data-c="gmail"]').click();await flush();
    assert.equal(opened,0);assert.equal(p.requests.some(r=>r.url.endsWith('/mcp/connect')),false);assert.equal(p.requests.some(r=>r.body?.op==='methods'),false);
    p.d.querySelector('[data-workspace-connect]').click();assert.equal(opened,1);await flush();
    const start=p.requests.find(r=>r.url.endsWith('/mcp/connect'));assert.deepEqual(start.body,{});assert.equal(start.credentials,'include');assert.equal(start.method,'POST');
    await p.polls.at(-1)();await flush();
    assert.equal(popup.closed,true);assert.match(p.d.querySelector('#mF').textContent,/تفويض مساحة الشركة محفوظ/);assert.match(p.d.querySelector('#mF').textContent,/جاهزية الأدوات تحتاج تحقق/);
    assert.equal(p.requests.filter(r=>r.body?.op==='methods').length,1);assert.equal(p.requests.some(r=>['message','connect','oauth_start'].includes(r.body?.op)),false);
    assert.ok(p.requests.filter(r=>r.url.endsWith('/mcp/status')).every(r=>r.method==='GET'&&r.credentials==='include'));
  }finally{p.close();}
});

test('closed workspace popup stops polling without replaying the customer request',async()=>{
  const popup={closed:false,close(){this.closed=true;},location:{replace(){}}};
  const p=await page({mcpStatus:{ok:true,state:'project_required',liveVerified:false},mcpConnect:{ok:true,state:'authorization_required',authorizationRevision:'a'.repeat(64),authorizationUrl:'https://activepieces.example/authorize'},hash:''});
  try{
    p.w.open=()=>popup;p.d.querySelector('#toolsLink').click();await flush();p.d.querySelector('#allTgl').click();await flush();p.d.querySelector('[data-c="gmail"]').click();await flush();p.d.querySelector('[data-workspace-connect]').click();await flush();
    const before=p.requests.length;popup.closed=true;await p.polls.at(-1)();await flush();assert.equal(p.requests.length,before);assert.match(p.d.querySelector('#mF').textContent,/لم يتم تأكيد حفظ التفويض/);assert.ok(p.d.querySelector('[data-workspace-connect]'));
  }finally{p.close();}
});

test('modal close cancels pending workspace status polling and closes its popup',async()=>{
  const popup={closed:false,close(){this.closed=true;},location:{replace(){}}};
  const p=await page({mcpStatus:{ok:true,state:'authorization_required',liveVerified:false},mcpConnect:{ok:true,state:'authorization_required',authorizationRevision:'a'.repeat(64),authorizationUrl:'https://activepieces.example/authorize'},hash:''});
  try{
    p.w.open=()=>popup;p.d.querySelector('#toolsLink').click();await flush();p.d.querySelector('#allTgl').click();await flush();p.d.querySelector('[data-c="gmail"]').click();await flush();p.d.querySelector('[data-workspace-connect]').click();await flush();
    const poll=p.polls.at(-1),before=p.requests.length;p.d.querySelector('#mX').click();await poll();await flush();assert.equal(p.requests.length,before);assert.equal(popup.closed,true);
  }finally{p.close();}
});

test('workspace reconnect accepts only its fresh OAuth client grant and ignores an unrelated saved grant',async()=>{
  let revision='b'.repeat(64);
  const popup={closed:false,close(){this.closed=true;},location:{replace(){}}};
  const p=await page({mcpStatus:()=>({ok:true,state:'authorization_stored',grantRevision:revision,liveVerified:false}),mcpConnect:{ok:true,state:'authorization_required',authorizationRevision:'a'.repeat(64),authorizationUrl:'https://activepieces.example/authorize'},integrations:{list:{ok:true,connections:[]},methods:new Error('fields unavailable')},hash:''});
  try{
    p.w.open=()=>popup;p.d.querySelector('#toolsLink').click();await flush();p.d.querySelector('#allTgl').click();await flush();p.d.querySelector('[data-c="gmail"]').click();await flush();p.d.querySelector('[data-workspace-connect]').click();await flush();
    const methodsBefore=p.requests.filter(r=>r.body?.op==='methods').length;
    await p.polls.at(-1)();await flush();assert.equal(popup.closed,false);assert.equal(p.requests.filter(r=>r.body?.op==='methods').length,methodsBefore);assert.match(p.d.querySelector('#mF').textContent,/لم نتأكد من جاهزية الأدوات/);
    revision='c'.repeat(64);await p.polls.at(-1)();await flush();assert.equal(popup.closed,false);assert.equal(p.requests.filter(r=>r.body?.op==='methods').length,methodsBefore);
    revision='a'.repeat(64);await p.polls.at(-1)();await flush();assert.equal(popup.closed,true);assert.equal(p.requests.filter(r=>r.body?.op==='methods').length,methodsBefore+1);
    assert.equal(p.requests.filter(r=>r.url.endsWith('/mcp/connect')).length,1);
  }finally{p.close();}
});


test('mixed action receipts explain completed action without upgrading unknown request in either language',async()=>{
 for(const locale of ['ar','en']){
  const p=await page({locale,message:{ok:true,conversation_id:'mixed',request_status:'not_observed',work_status:'unknown',outcome_kind:'unverified',reply:'رد المصدر',tool_receipts:[{name:'ap_run_action',status:'returned',run_id:'R'.repeat(21),outcome:'unverified',effect_attempted:true},{name:'ap_run_action',status:'returned',run_id:'S'.repeat(21),outcome:'action_completed',effect_attempted:true}]}});try{
   send(p,'اقرأ');await flush();const state=p.d.querySelector('.request-state');assert.equal(state.dataset.state,'unknown');assert.match(state.textContent,locale==='en'?/An action completed; the full request outcome is unverified/:/اكتمل إجراء؛ نتيجة الطلب كاملة غير مؤكدة/);assert.equal(p.d.querySelectorAll('.request-state[data-state="succeeded"]').length,0);
  }finally{p.close();}
 }
});

test('invalid or absent completed-action identity cannot change unknown request wording',async()=>{
 for(const run of ['', '<img src=x>', 1e20, null]){
  const p=await page({message:{ok:true,conversation_id:'mixed',request_status:'not_observed',work_status:'unknown',outcome_kind:'unverified',reply:'رد المصدر',tool_receipts:[{name:'ap_run_action',status:'error',effect_attempted:true},{name:'ap_run_action',status:'returned',run_id:run,outcome:'action_completed',effect_attempted:true}]}});try{send(p,'اقرأ');await flush();assert.equal(p.d.querySelector('.request-state').textContent,'النتيجة غير مؤكدة');}finally{p.close();}
 }
});

test('workspace navigation reads saved team and results without dispatching work',async()=>{
 const p=await page({hydrate:{...empty,team:[employee],recent_work:[proof]}});try{
  p.d.querySelector('[data-workspace-view="results"]').click();assert.match(thread(p),/فرصة أ/);assert.match(thread(p),/run-1/);assert.equal(p.d.querySelector('.comp').style.display,'none');
  p.d.querySelector('[data-workspace-view="team"]').click();assert.match(thread(p),/سارة/);p.d.querySelector('[data-open-employee]').click();assert.match(p.d.querySelector('#whoN').textContent,/سارة/);assert.equal(p.d.querySelector('.comp').style.display,'');
  p.d.querySelector('[data-workspace-view="siyadah"]').click();assert.equal(p.d.querySelector('[data-workspace-view="siyadah"]').getAttribute('aria-current'),'page');
  assert.equal(p.requests.filter(r=>['message','approve','employee_state'].includes(r.body?.op)).length,0);
 }finally{p.close();}
});
test('results page empty state and failed records never fabricate provider success',async()=>{
 for(const records of [[],[{...proof,status:'failed',runId:null}]]){const p=await page({hydrate:{...empty,recent_work:records}});try{
  p.d.querySelector('[data-workspace-view="results"]').click();assert.doesNotMatch(thread(p),/✓/);assert.match(thread(p),records.length?/تعذّرت/:/ما فيه عمل مسجّل/);
 }finally{p.close();}}
});
test('published workflow structure displays branches and escapes labels without promoting proof',async()=>{
 const p=await page({hash:'#e='+publishedEmployee.recordId,hydrate:{...empty,team:[publishedEmployee]},employee_instructions:{ok:true,published_instructions:{...publishedProjection,work_structure_complete:false,work_steps:[{name:'trigger',display_name:'البداية',kind:'trigger',path:[]},{name:'send',display_name:'<img src=x>',kind:'action',path:[{kind:'branch',index:1},{kind:'loop'}],skipped:true,valid:false}]}}});try{
  p.d.querySelector('#instrTgl').click();await flush();await flush();const panel=p.d.querySelector('.published-work');assert.equal(panel.querySelector('img'),null);assert.match(panel.textContent,/<img src=x>/);assert.match(panel.textContent,/فرع 2.*داخل تكرار/);assert.match(panel.textContent,/متخطاة.*إعداد غير صالح/);assert.match(panel.textContent,/القراءة جزئية/);assert.match(panel.textContent,/لا يثبت تنفيذها/);assert.equal(p.requests.filter(r=>r.body?.op==='message').length,0);
 }finally{p.close();}
});

test('workspace pages focus their heading and offer a non-dispatching empty-state return',async()=>{
 const p=await page({hydrate:empty});try{
  p.d.querySelector('#openSide').click();p.d.querySelector('[data-workspace-view="team"]').click();assert.equal(p.d.activeElement,p.d.querySelector('#thread h1'));assert.equal(p.d.querySelector('#app').classList.contains('open'),false);
  p.d.querySelector('#thread [data-workspace-view="siyadah"]').click();assert.equal(p.d.activeElement,p.d.querySelector('#input'));assert.equal(p.requests.filter(r=>r.body?.op==='message').length,0);
 }finally{p.close();}
});
test('unavailable company data is never shown as an empty team or results record',async()=>{
 const p=await page({hydrate:Error('offline')});try{
  for(const view of ['team','results']){p.d.querySelector('[data-workspace-view="'+view+'"]').click();assert.match(thread(p),/تعذّر تحميل بيانات حسابك/);assert.doesNotMatch(thread(p),/لا يوجد موظفون محفوظون|ما فيه عمل مسجّل/);assert.equal(p.d.querySelector('#thread [data-workspace-view="siyadah"]'),null);}
 }finally{p.close();}
});

test('employee entry restores the latest server-ordered conversation while older history remains selectable',async()=>{
 const p=await page({hydrate:{...empty,team:[employee],conversations:[{id:'latest',title:'آخر نتيجة',employee_id:employee.recordId,messages:[{role:'assistant',content:'النتيجة الحديثة'}]},{id:'older',title:'طلب قديم',employee_id:employee.recordId,messages:[{role:'assistant',content:'رد قديم'}]}]}});try{
  p.d.querySelector('#emps .emp').click();assert.match(thread(p),/النتيجة الحديثة/);assert.doesNotMatch(thread(p),/رد قديم/);p.d.querySelector('[data-chat="older"]').click();assert.match(thread(p),/رد قديم/);
 }finally{p.close();}
});

test('saving a non-active connection retains its form values and focus without activation',async()=>{
 for(const status of ['ERROR','EXPIRED','MISSING']){const p=await page({hash:'',integrations:{list:{ok:true,connections:[]},methods:{ok:true,methods:[{id:'secret',type:'SECRET_TEXT',available:true,fields:[{name:'token',label:'Token',type:'password',required:true}]}]},connect:{ok:true,connection:{id:'C'.repeat(21),slug:'gmail',status,scope:'PROJECT'}}}});try{
  p.d.querySelector('#toolsLink').click();await flush();p.d.querySelector('#allTgl').click();p.d.querySelector('[data-c="gmail"]').click();await flush();const field=p.d.querySelector('#mf0');field.value='private-test-value';field.focus();p.d.querySelector('#mF form').dispatchEvent(new p.w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  assert.equal(p.d.querySelector('#modal').classList.contains('on'),true);assert.equal(p.d.querySelector('#mf0'),field);assert.equal(field.value,'private-test-value');assert.equal(p.d.activeElement,field);assert.equal(p.d.querySelector('#mOk').disabled,false);assert.match(p.d.querySelector('#mF').textContent,/غير جاهز/);assert.doesNotMatch(p.d.querySelector('#mF').textContent,/private-test-value/);assert.equal(p.activationRequests.filter(r=>r.body.employee_id).length,0);
 }finally{p.close();}}
});
test('revalidation only describes an ACTIVE saved connection as verified',async()=>{
 for(const status of ['ACTIVE','ERROR','EXPIRED','MISSING']){const connection={id:'C'.repeat(21),slug:'gmail',status:'ACTIVE',scope:'PROJECT'};const p=await page({integrations:{list:{ok:true,connections:[connection]},revalidate:{ok:true,connection:{...connection,status}}}});try{
  p.d.querySelector('#toolsLink').click();await flush();p.d.querySelector('[data-tool-details="gmail"]').click();p.d.querySelector('[data-revalidate]').click();await flush();assert.match(p.d.querySelector('#mD').textContent,status==='ACTIVE'?/تم التحقق من بيانات الربط/:/يحتاج إعادة ربط/);if(status!=='ACTIVE')assert.doesNotMatch(p.d.querySelector('#mD').textContent,/تم التحقق/);
 }finally{p.close();}}
});

test('results card puts technical provider proof in details and avoids repeated employee and status labels',async()=>{
 const p=await page({hydrate:{...empty,team:[employee],recent_work:[{...proof,subject:'آخر مهمة لـ '+employee.name,proof:'نتيجة الخدمة 200'}]}});try{
  p.d.querySelector('[data-workspace-view="results"]').click();const card=p.d.querySelector('.work-record');assert.equal(card.querySelectorAll('.work-record__status').length,1);assert.equal(card.querySelector('small.msrc'),null);assert.match(card.querySelector('details').textContent,/200/);assert.doesNotMatch([...card.children].filter(el=>el.tagName!=='DETAILS').map(el=>el.textContent).join(' '),/200/);
 }finally{p.close();}
});

test('right column orders real return contexts before employee management and hides empty team',async()=>{
 const fresh=await page({hydrate:empty});try{assert.equal(fresh.d.querySelector('#teamSection').hidden,true);assert.equal(fresh.d.querySelector('#awaitingSection').hidden,true);assert.match(fresh.d.querySelector('#newChat').textContent,/طلب جديد/);assert.doesNotMatch(fresh.d.querySelector('.side').textContent,/مهمة واحدة|موظف دائم|4 مربوطة/);}finally{fresh.close();}
 const p=await page({hydrate:{...empty,team:[employee],conversations:[{id:'newest',title:'العقد الجديد',messages:[]},{id:'older',title:'عرض سعر',messages:[]}]}});try{
  const order=[...p.d.querySelector('.side__scroll').children].map(el=>el.id||el.className);assert.ok(order.indexOf('hgToday')<order.indexOf('teamSection'));assert.equal(p.d.querySelector('#teamSection').hidden,false);assert.deepEqual([...p.d.querySelectorAll('#histToday [data-chat]')].map(el=>el.dataset.chat),['newest','older']);assert.match(p.d.querySelector('#hgToday .lbl').textContent,/محادثاتك/);
 }finally{p.close();}
});
test('right column highlights a real waiting request and opens it without resubmitting',async()=>{
 const p=await page({message:{ok:true,conversation_id:'waiting',work_id:'w',work_status:'awaiting_input',reply:'أحتاج عدد النسخ'}});try{
  send(p,'جهز العقد');await flush();assert.equal(p.d.querySelector('#awaitingSection').hidden,false);const pending=p.d.querySelector('#awaitingChats [data-chat="waiting"]');assert.ok(pending);p.d.querySelector('#newChat').click();p.d.querySelector('#awaitingChats [data-chat="waiting"]').click();assert.match(thread(p),/أحتاج عدد النسخ/);assert.equal(p.requests.filter(r=>r.body?.op==='message').length,1);
 }finally{p.close();}
});


test('onboarding request arrives in the composer without creating an employee or sending',async()=>{
 const text='راجع عقد اليوم وأعطني الملاحظات';
 const p=await page({hash:'',session:{siyadah_request_draft_v1:JSON.stringify({text,createdAt:Date.now()})}});try{
  assert.equal(p.d.querySelector('#input').value,text);assert.equal(p.w.sessionStorage.getItem('siyadah_request_draft_v1'),null);assert.equal(p.requests.filter(r=>r.body&&['message','approve','select_employee'].includes(r.body.op)).length,0);assert.equal(p.d.activeElement.id,'input');
 }finally{p.close();}
});

test('onboarding request survives failed account load and expired drafts do not enter the composer',async()=>{
 const key='siyadah_request_draft_v1',raw=JSON.stringify({text:'راجع العقد',createdAt:Date.now()});
 const failed=await page({hash:'',hydrate:Error('offline'),session:{[key]:raw}});try{assert.equal(failed.w.sessionStorage.getItem(key),raw);assert.equal(failed.d.querySelector('#input').value,'');assert.equal(failed.requests.filter(r=>r.body&&r.body.op==='message').length,0);}finally{failed.close();}
 const old=await page({hash:'',session:{[key]:JSON.stringify({text:'طلب قديم',createdAt:Date.now()-31*60*1000})}});try{assert.equal(old.d.querySelector('#input').value,'');assert.equal(old.w.sessionStorage.getItem(key),null);assert.equal(old.requests.filter(r=>r.body&&r.body.op==='message').length,0);}finally{old.close();}
});

test('chat titles shorten only visually and search the complete source including fallback user request',async()=>{
 const full='جهّز عقد العميل بحسب الشروط التي كتبتها بالكامل مع إضافة الملحق الخاص بالمواعيد النهائية';const fallback='طلب مختلف طويل فيه عبارة للبحث في نهاية النص مثل بند الضمان';
 const p=await page({hydrate:{...empty,conversations:[{id:'valid',title:full,messages:[]},{id:'fallback',title:' ',messages:[{role:'user',content:fallback}]}]}});try{
  const button=p.d.querySelector('[data-chat="valid"]');assert.equal(button.title,full);assert.equal(button.getAttribute('aria-label'),full);assert.ok(button.textContent.length<full.length);assert.match(button.textContent,/…$/);const other=p.d.querySelector('[data-chat="fallback"]');assert.equal(other.title,fallback);
  const search=p.d.querySelector('#hq');search.value='بند الضمان';search.dispatchEvent(new p.w.Event('input',{bubbles:true}));assert.equal(other.hidden,false);assert.equal(button.hidden,true);other.click();assert.match(thread(p),/بند الضمان/);
 }finally{p.close();}
});
test('compact chat history keeps all saved chats reachable by search and expansion',async()=>{
 const conversations=Array.from({length:12},(_,i)=>({id:'history-'+i,title:'طلب '+i,messages:[{role:'user',content:'طلب '+i}]}));const p=await page({hydrate:{...empty,conversations}});try{
  assert.equal(p.d.querySelectorAll('#histToday .hist:not([hidden])').length,8);const search=p.d.querySelector('#hq');search.value='طلب 11';search.dispatchEvent(new p.w.Event('input',{bubbles:true}));assert.equal(p.d.querySelector('[data-chat="history-11"]').hidden,false);search.value='';search.dispatchEvent(new p.w.Event('input',{bubbles:true}));p.d.querySelector('#historyMore').click();assert.equal(p.d.querySelectorAll('#histToday .hist:not([hidden])').length,12);p.d.querySelector('[data-chat="history-11"]').click();p.d.querySelector('#historyMore').click();assert.equal(p.d.querySelector('[data-chat="history-11"]').hidden,false);assert.equal(p.requests.filter(r=>r.body?.op==='message').length,0);
 }finally{p.close();}
});

test('a saved result opens only its own loaded conversation without resending',async()=>{
 const p=await page({hydrate:{...empty,team:[employee],recent_work:[{...proof,conversation_id:'result-chat'}],conversations:[{id:'result-chat',employee_id:employee.recordId,title:'تقرير العميل',messages:[{role:'assistant',content:'هذه النتيجة المحفوظة'}]}]}});try{
  p.d.querySelector('[data-workspace-view="results"]').click();const result=p.d.querySelector('[data-result-chat="result-chat"]');assert.ok(result);result.click();assert.match(thread(p),/هذه النتيجة المحفوظة/);assert.equal(p.requests.filter(r=>r.body&&r.body.op==='message').length,0);
 }finally{p.close();}
 const missing=await page({hydrate:{...empty,recent_work:[{...proof,conversation_id:'not-loaded'}]}});try{missing.d.querySelector('[data-workspace-view="results"]').click();assert.equal(missing.d.querySelector('[data-result-chat]'),null);}finally{missing.close();}
});

test('reload restores a live pending decision without dispatching or polling its action',async()=>{
 const p=await page({hash:'',hydrate:{...empty,conversations:[{id:'waiting',title:'عرض السعر',messages:[]}],pending_work:[{ok:true,work_id:'request_saved',approval_expires_at:new Date(Date.now()+60000).toISOString(),conversation_id:'waiting',request_status:'succeeded',work_status:'awaiting_input',reply:'راجع عرض السعر',approval:{required:true,kind:'tool_action',approval_id:'11111111-1111-1111-1111-111111111111',summary:'حفظ عرض السعر',details:'العميل: مثال'}}]}});try{
  assert.equal(p.d.querySelector('#awaitingSection').hidden,false);p.d.querySelector('#awaitingChats [data-chat="waiting"]').click();assert.match(thread(p),/راجع عرض السعر/);assert.ok(p.d.querySelector('[data-siy-approval="approve"]'));assert.equal(p.requests.filter(r=>r.body&&['approve','message','work'].includes(r.body.op)).length,0);assert.equal(p.polls.length,0);
 }finally{p.close();}
});

test('an expired restored decision is not offered as an available action',async()=>{
 const p=await page({hash:'',hydrate:{...empty,conversations:[{id:'expired',title:'قرار قديم',messages:[]}],pending_work:[{work_id:'request_expired',conversation_id:'expired',work_status:'awaiting_input',approval_expires_at:new Date(Date.now()-1000).toISOString(),approval:{required:true,kind:'tool_action',approval_id:'expired'}}]}});try{assert.equal(p.d.querySelector('#awaitingSection').hidden,true);assert.equal(p.d.querySelector('[data-siy-approval]'),null);assert.equal(p.requests.filter(r=>r.body&&r.body.op==='approve').length,0);}finally{p.close();}
});

test('results show the saved flow reply body safely instead of a status-only card',async()=>{
 const p=await page({hydrate:{...empty,recent_work:[{...proof,message:'',result:{schemaVersion:1,source:'flow_reply',content:'[{"النتيجة":"تقرير اليوم <script>bad()</script>"}]'}}]}});try{p.d.querySelector('[data-workspace-view="results"]').click();assert.match(thread(p),/تقرير اليوم/);assert.ok(p.d.querySelector('.work-record__result table'));assert.equal(p.d.querySelector('.work-record__result script'),null);}finally{p.close();}
});

test('structured results keep fields beyond the twelfth column',async()=>{
 const data=Object.fromEntries(Array.from({length:13},(_,i)=>['field'+i,'value'+i]));const p=await page({hydrate:{...empty,recent_work:[{...proof,result:{schemaVersion:1,source:'flow_reply',content:JSON.stringify([data])}}]}});try{p.d.querySelector('[data-workspace-view="results"]').click();assert.equal(p.d.querySelectorAll('.work-record__result th').length,13);assert.match(thread(p),/value12/);}finally{p.close();}
});

test('live activity renders backend calls and returned responses without claiming provider success',async()=>{
 const p=await page({message:{ok:true,conversation_id:'activity',work_id:'w',work_status:'running',activity:[{id:1,name:'ap_search_actions',state:'returned'},{id:2,name:'ap_get_flow',state:'started'}]},work:{ok:true,conversation_id:'activity',work_id:'w',work_status:'running',activity:[{id:1,name:'ap_search_actions',state:'returned'},{id:2,name:'ap_get_flow',state:'returned'}]}});try{
  send(p,'راجع طريقة العمل');await flush();const block=p.d.querySelector('.siy-activity');assert.match(block.querySelector('summary').textContent,/قراءة طريقة العمل.*جارٍ العمل/);assert.match(block.textContent,/البحث في الأدوات.*وصل الرد/);assert.doesNotMatch(block.textContent,/اكتمل|مُثبت|✓/);assert.equal(block.querySelectorAll('li').length,2);
  await p.polls.shift()();await flush();assert.equal(p.d.querySelectorAll('[data-activity-id="2"]').length,1);assert.equal(p.d.querySelector('[data-activity-id="2"]').dataset.activityState,'returned');assert.doesNotMatch(p.d.querySelector('.siy-activity').textContent,/جارٍ العمل|نجح/);
 }finally{p.close();}
});
test('live activity ignores malformed events limits snapshots and never exposes unknown raw tool names',async()=>{
 const activity=Array.from({length:85},(_,i)=>({id:i,name:'<img src=x onerror=alert(1)>',state:'returned'}));activity.push({id:99,name:'secret',state:'succeeded'},{id:-1,name:'secret',state:'started'},{id:100,name:'__proto__',state:'started'},{id:100,name:'__proto__',state:'returned'});
 const p=await page({message:{ok:true,conversation_id:'activity',work_id:'w',work_status:'failed',activity}});try{send(p,'راجع');await flush();const block=p.d.querySelector('.siy-activity');assert.ok(block);assert.ok(block.querySelectorAll('li').length<=80);assert.equal(block.querySelector('img'),null);assert.doesNotMatch(block.textContent,/secret|onerror|<img|succeeded|Object|__proto__/);assert.equal(block.querySelectorAll('[data-activity-id="100"]').length,1);assert.match(block.textContent,/أداة العمل/);}finally{p.close();}
 const absent=await page({message:{ok:true,conversation_id:'plain',reply:'رد عادي'}});try{send(absent,'سؤال');await flush();assert.equal(absent.d.querySelector('.siy-activity'),null);}finally{absent.close();}
});

test('activity timeline keeps its open state and keyboard focus during same-request polling',async()=>{
 const p=await page({message:{ok:true,conversation_id:'timeline',work_id:'timeline-work',work_status:'running',activity:[{id:1,name:'ap_get_flow',state:'started'}]},work:{ok:true,conversation_id:'timeline',work_id:'timeline-work',work_status:'running',activity:[{id:1,name:'ap_get_flow',state:'returned'},{id:2,name:'ap_test_flow',state:'started'}]}});try{
  send(p,'راجع');await flush();let block=p.d.querySelector('.siy-activity');block.open=true;block.querySelector('summary').focus();await p.polls.shift()();await flush();block=p.d.querySelector('.siy-activity');assert.equal(block.open,true);assert.equal(p.d.activeElement,block.querySelector('summary'));assert.equal(block.querySelectorAll('li').length,2);assert.equal(block.querySelectorAll('.activity-node svg').length,2);assert.match(block.querySelector('summary').textContent,/اختبار طريقة العمل.*جارٍ العمل/);assert.equal(block.querySelectorAll('svg:not([aria-hidden="true"])').length,0);assert.doesNotMatch(block.textContent,/✓|نجح|نتيجة مثبتة/);
 }finally{p.close();}
});
for(const locale of ['ar','en'])test('activity UI direction follows the interface rather than the provider reply '+locale,async()=>{
 const p=await page({locale,message:{ok:true,conversation_id:'direction',work_id:'direction-work',work_status:'failed',reply:locale==='en'?'رد عربي من الأداة':'An English provider response',activity:[{id:1,name:'ap_test_flow',state:'error'}]}});try{
  send(p,'راجع');await flush();const block=p.d.querySelector('.siy-activity');assert.equal(block.getAttribute('dir'),locale==='en'?'ltr':'rtl');assert.match(block.textContent,locale==='en'?/Test workflow.*Call failed/:/اختبار طريقة العمل.*تعثّرت الخطوة/);assert.equal(block.querySelector('svg').getAttribute('aria-hidden'),'true');
 }finally{p.close();}
});
