import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('onboarding uses live company enrichment and prepares one employee safely',async()=>{
  const [html,js,server]=await Promise.all([readFile(new URL('../app/onboard.html',import.meta.url),'utf8'),readFile(new URL('../app/onboard.js',import.meta.url),'utf8'),readFile(new URL('../server.mjs',import.meta.url),'utf8')]);
  assert.match(js,/op:'enrich_company'/);
  assert.match(js,/op:'check_company_enrichment'/);
  assert.match(js,/op:'recommend_employees'/);
  assert.match(js,/op:'select_employee'/);
  assert.match(js,/SUGGESTIONS\.slice\(0,3\)/);
  assert.ok(!js.includes('pages:14'));
  assert.ok(!html.includes('وافق وشغّل'));
  assert.match(html,/مسودة موظفك جاهزة/);
  assert.match(html,/أدواته غير متصلة/);
  assert.match(html,/هذه شركتك كما فهمناها/);
  assert.match(html,/حالة الموظف/);
  assert.match(html,/circle cx="12" cy="12" r="8"\/\><path d="M12 8v4"/);
  assert.match(js,/chat\.html'\+\(CREATED&&CREATED\.recordId\?'#e='\+encodeURIComponent\(CREATED\.recordId\)/);
  assert.match(js,/أفضل بداية/);
  assert.match(js,/معلومات محفوظة/);
  assert.match(server,/factCount:Array\.isArray\(profile\.facts\)/);
  assert.match(server,/knowledgeAreas:Array\.from/);
});

test('onboarding restores an existing company profile instead of restarting website research',async()=>{
  const [html,js]=await Promise.all([
    readFile(new URL('../app/onboard.html',import.meta.url),'utf8'),
    readFile(new URL('../app/onboard.js',import.meta.url),'utf8'),
  ]);
  const dom=new JSDOM(html,{url:'https://siyadah.test/app/onboard.html',runScripts:'outside-only'}),w=dom.window,requests=[];
  w.scrollTo=()=>{};
  w.fetch=async(_url,options)=>{
    requests.push(JSON.parse(options.body).op);
    return {ok:true,json:async()=>({ok:true,status:'ready',profile:{companyName:'شركة اختبار',coverageScore:70,pagesRead:4,factCount:0,knowledgeVersion:2},suggestions:[]})};
  };
  w.eval(js);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(requests,['check_company_enrichment']);
  assert.equal(w.document.querySelector('#stepLbl').textContent,'2 من 4');
  assert.match(w.document.querySelector('#companyRead').textContent,/شركة اختبار/);
  assert.equal(w.document.querySelectorAll('#companyRead .kb__v')[1].textContent,'0');
  assert.match(w.document.querySelector('#companyRead').textContent,/لم نجد معلومات كافية/);
  assert.equal(w.document.querySelector('#companyRead .coverage strong').textContent,'—');
  dom.window.close();
});

test('onboarding keeps logout available when the server request fails',async()=>{
  const [html,js]=await Promise.all([
    readFile(new URL('../app/onboard.html',import.meta.url),'utf8'),
    readFile(new URL('../app/onboard.js',import.meta.url),'utf8'),
  ]);
  const dom=new JSDOM(html,{url:'https://siyadah.test/app/onboard.html',runScripts:'outside-only'}),w=dom.window,requests=[];
  w.scrollTo=()=>{};
  w.fetch=async(url,options)=>{
    requests.push({url,options});
    if(url.endsWith('/auth/logout'))return {ok:false};
    return {ok:true,json:async()=>({ok:true,status:'ready',profile:{companyName:'Example',coverageScore:30,pagesRead:1,factCount:1,knowledgeVersion:1},suggestions:[]})};
  };
  w.eval(js);await new Promise(resolve=>setImmediate(resolve));
  w.document.querySelector('#logoutBtn').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.at(-1).url,'/siyadah-api/v1/auth/logout');
  assert.equal(requests.at(-1).options.credentials,'same-origin');
  assert.equal(w.document.querySelector('#logoutBtn').disabled,false);
  assert.match(w.document.querySelector('#logoutStatus').textContent,/تعذّر تسجيل الخروج/);
  dom.window.close();
});

test('without a website, onboarding asks for company name and description before continuing',async()=>{
  const [html,js]=await Promise.all([
    readFile(new URL('../app/onboard.html',import.meta.url),'utf8'),
    readFile(new URL('../app/onboard.js',import.meta.url),'utf8'),
  ]);
  const dom=new JSDOM(html,{url:'https://siyadah.test/app/onboard.html',runScripts:'outside-only'}),w=dom.window;
  w.scrollTo=()=>{};
  w.fetch=async()=>{throw new Error('no saved company')};
  w.eval(js);await new Promise(resolve=>setImmediate(resolve));
  w.document.querySelector('#noSite').click();
  assert.equal(w.document.querySelector('#siteEntry').hidden,true);
  assert.equal(w.document.querySelector('#startTitle').textContent,'عرّفنا بشركتك.');
  w.document.querySelector('#lines3').value='نقدم خدمة توصيل للمطاعم';
  w.document.querySelector('#lines3').dispatchEvent(new w.Event('input'));
  assert.equal(w.document.querySelector('#next').disabled,true);
  w.document.querySelector('#co').value='شركة مثال';
  w.document.querySelector('#co').dispatchEvent(new w.Event('input'));
  assert.equal(w.document.querySelector('#next').disabled,false);
  assert.equal(w.document.querySelector('#live').textContent,'');
  dom.window.close();
});

test('company description failure stays in the step and restores the next action',async()=>{
  const [html,js]=await Promise.all([readFile(new URL('../app/onboard.html',import.meta.url),'utf8'),readFile(new URL('../app/onboard.js',import.meta.url),'utf8')]);
  const dom=new JSDOM(html,{url:'https://siyadah.test/app/onboard.html',runScripts:'outside-only'}),w=dom.window;
  let alerts=0;w.alert=()=>{alerts++};w.scrollTo=()=>{};
  w.fetch=async(_url,options)=>{
    const {op}=JSON.parse(options.body);
    if(op==='check_company_enrichment')throw new Error('no profile');
    return {ok:false,json:async()=>({ok:false,message:'تعذّر حفظ الوصف.'})};
  };
  w.eval(js);await new Promise(resolve=>setImmediate(resolve));
  w.document.querySelector('#noSite').click();
  w.document.querySelector('#co').value='شركة مثال';w.document.querySelector('#lines3').value='نخدم المطاعم';
  w.document.querySelector('#co').dispatchEvent(new w.Event('input'));
  w.document.querySelector('#next').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.querySelector('#stepLbl').textContent,'1 من 4');
  assert.equal(w.document.querySelector('#stepError').hidden,false);
  assert.match(w.document.querySelector('#stepError').textContent,/تعذّر حفظ الوصف/);
  assert.equal(w.document.querySelector('#next').disabled,false);
  assert.match(w.document.querySelector('#next').textContent,/التالي/);
  assert.equal(alerts,0);
  dom.window.close();
});

test('suggestion and employee preparation failures remain visible and retryable',async()=>{
  const [html,js]=await Promise.all([readFile(new URL('../app/onboard.html',import.meta.url),'utf8'),readFile(new URL('../app/onboard.js',import.meta.url),'utf8')]);
  const dom=new JSDOM(html,{url:'https://siyadah.test/app/onboard.html',runScripts:'outside-only'}),w=dom.window;
  const profile={companyName:'شركة مثال',pagesRead:1,factCount:1,coverageScore:30,knowledgeVersion:1};
  const suggestion={id:'marketing',roleKey:'marketing',name:'ريم',title:'التسويق',goal:'المحتوى',confidence:80,knowledgeTopics:[]};
  let alerts=0,recommendAttempts=0,selectAttempts=0;const selectionRequests=[];w.alert=()=>{alerts++};w.scrollTo=()=>{};
  w.fetch=async(_url,options)=>{
    const payload=JSON.parse(options.body),{op}=payload;
    if(op==='check_company_enrichment')return {ok:true,json:async()=>({ok:true,status:'ready',profile})};
    if(op==='recommend_employees'&&++recommendAttempts===1)return {ok:false,json:async()=>({ok:false,message:'تعذّر جلب الاقتراحات.'})};
    if(op==='recommend_employees')return {ok:true,json:async()=>({ok:true,suggestions:[suggestion]})};
    if(op==='select_employee'){selectionRequests.push(payload);if(++selectAttempts===1)return {ok:false,json:async()=>({ok:false,message:'تعذّر تجهيز الموظف.'})};}
    return {ok:true,json:async()=>({ok:true,employee:{initial:'ر',knowledgeVersion:1}})};
  };
  w.eval(js);await new Promise(resolve=>setImmediate(resolve));
  w.document.querySelector('#next').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.querySelector('#stepLbl').textContent,'2 من 4');
  assert.match(w.document.querySelector('#stepError').textContent,/تعذّر جلب الاقتراحات/);
  assert.equal(w.document.querySelector('#next').disabled,false);
  w.document.querySelector('#next').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.querySelector('#stepLbl').textContent,'3 من 4');
  w.document.querySelector('[data-suggestion="marketing"]').click();
  assert.match(w.document.querySelector('#next').textContent,/احفظ مسودة ريم/);
  w.document.querySelector('#next').click();assert.match(w.document.querySelector('#live').textContent,/نحفظ المسودة/);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.querySelector('#stepLbl').textContent,'3 من 4');
  assert.match(w.document.querySelector('#stepError').textContent,/تعذّر تجهيز الموظف/);
  assert.equal(w.document.querySelector('#next').disabled,false);
  assert.equal(alerts,0);
  w.document.querySelector('#next').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.querySelector('#stepLbl').textContent,'4 من 4');
  assert.equal(selectionRequests.length,2);
  assert.match(selectionRequests[0].request_id,/^[A-Za-z0-9_-]{1,80}$/);
  assert.equal(selectionRequests[0].request_id,selectionRequests[1].request_id);
  dom.window.close();
});

test('reload after an uncertain employee save reuses the original request ID',async()=>{
  const [html,js]=await Promise.all([readFile(new URL('../app/onboard.html',import.meta.url),'utf8'),readFile(new URL('../app/onboard.js',import.meta.url),'utf8')]);
  const suggestion={id:'marketing',roleKey:'marketing',name:'ريم',title:'التسويق',goal:'المحتوى',confidence:80,knowledgeTopics:[]};
  const first=new JSDOM(html,{url:'https://siyadah.test/app/onboard.html',runScripts:'outside-only'}).window;
  first.scrollTo=()=>{};let originalId;
  first.fetch=async(_url,options)=>{
    const input=JSON.parse(options.body);
    if(input.op==='select_employee'){originalId=input.request_id;throw new Error('connection lost');}
    return {ok:true,json:async()=>input.op==='recommend_employees'?{ok:true,suggestions:[suggestion]}:{ok:true,status:'ready',profile:{companyName:'شركة مثال',coverageScore:30,pagesRead:1,factCount:1,knowledgeVersion:1},suggestions:[suggestion]}};
  };
  first.eval(js);await new Promise(resolve=>setImmediate(resolve));
  first.document.querySelector('#next').click();await new Promise(resolve=>setImmediate(resolve));
  first.document.querySelector('[data-suggestion="marketing"]').click();first.document.querySelector('#next').click();await new Promise(resolve=>setImmediate(resolve));
  const savedAttempt=first.sessionStorage.getItem('siyadah_employee_selection_attempt');
  assert.ok(savedAttempt);assert.equal(JSON.parse(savedAttempt).requestId,originalId);assert.equal(JSON.parse(savedAttempt).profileKey,'شركة مثال');first.close();

  const second=new JSDOM(html,{url:'https://siyadah.test/app/onboard.html',runScripts:'outside-only'}).window;
  second.scrollTo=()=>{};second.sessionStorage.setItem('siyadah_employee_selection_attempt',savedAttempt);let retriedId;
  second.fetch=async(_url,options)=>{
    const input=JSON.parse(options.body);
    if(input.op==='select_employee'){retriedId=input.request_id;return {ok:true,json:async()=>({ok:true,employee:{recordId:'employee-1',initial:'ر',status:'disabled',flowId:null}})};}
    return {ok:true,json:async()=>input.op==='recommend_employees'?{ok:true,suggestions:[suggestion]}:{ok:true,status:'ready',profile:{companyName:'شركة مثال',coverageScore:30,pagesRead:1,factCount:1,knowledgeVersion:1},suggestions:[suggestion]}};
  };
  second.eval(js);await new Promise(resolve=>setImmediate(resolve));
  second.document.querySelector('#next').click();await new Promise(resolve=>setImmediate(resolve));
  second.document.querySelector('[data-suggestion="marketing"]').click();second.document.querySelector('#next').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(retriedId,originalId);
  assert.equal(second.sessionStorage.getItem('siyadah_employee_selection_attempt'),null);
  second.close();
});

test('English onboarding keeps its labels, role choices, and draft status in LTR',async()=>{
  const [html,js]=await Promise.all([
    readFile(new URL('../app/onboard.html',import.meta.url),'utf8'),
    readFile(new URL('../app/onboard.js',import.meta.url),'utf8'),
  ]);
  const suggestion={id:'marketing',roleKey:'marketing',name:'ريم',title:'موظف التسويق',goal:'يجهز محتوى',reason:'السبب',confidence:80,knowledgeTopics:['services','brand']};
  const profile={companyName:'Example',pagesRead:2,factCount:1,coverageScore:30,knowledgeVersion:2,knowledgeAreas:['services']};
  const dom=new JSDOM(html,{url:'https://siyadah.test/app/onboard.html?lang=en',runScripts:'outside-only'}),w=dom.window;
  w.scrollTo=()=>{};
  w.fetch=async(_url,options)=>{
    const {op}=JSON.parse(options.body);
    if(op==='check_company_enrichment')return {ok:true,json:async()=>({ok:true,status:'ready',profile,suggestions:[suggestion]})};
    if(op==='recommend_employees')return {ok:true,json:async()=>({ok:true,suggestions:[suggestion]})};
    if(op==='select_employee')return {ok:true,json:async()=>({ok:true,employee:{initial:'ر',knowledgeVersion:2}})};
    throw new Error(op);
  };
  w.eval(js);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.documentElement.lang,'en');
  assert.equal(w.document.documentElement.dir,'ltr');
  assert.equal(w.document.querySelector('#stepLbl').textContent,'2 of 4');
  assert.match(w.document.querySelector('#companyRead').textContent,/From your website/);
  assert.match(w.document.querySelector('#companyRead').textContent,/Saved facts/);
  w.document.querySelector('#next').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.querySelector('#stepLbl').textContent,'3 of 4');
  assert.match(w.document.querySelector('#plan').textContent,/Reem · Marketing employee/);
  w.document.querySelector('[data-suggestion="marketing"]').click();
  assert.match(w.document.querySelector('#plan').textContent,/Suggested because your company covers Services/);
  assert.match(w.document.querySelector('#next').textContent,/Save draft Reem/);
  w.document.querySelector('#next').click();assert.match(w.document.querySelector('#live').textContent,/Saving draft/);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.querySelector('#stepLbl').textContent,'4 of 4');
  assert.match(w.document.querySelector('[data-step="4"]').textContent,/Tools are not connected/);
  assert.match(w.document.querySelector('[data-step="4"]').textContent,/Not connected/);
  w.document.querySelector('#langAr').click();
  assert.equal(w.document.documentElement.dir,'rtl');
  assert.match(w.document.querySelector('[data-step="4"]').textContent,/أدواته غير متصلة/);
  dom.window.close();
});
