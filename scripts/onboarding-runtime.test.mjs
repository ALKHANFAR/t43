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
  assert.match(html,/هذه شركتك كما فهمناها/);
  assert.equal(new JSDOM(html).window.document.querySelectorAll('section.step[data-step]').length,2);
  assert.match(js,/chat\.html#e=/);
  assert.match(js,/أفضل بداية/);
  assert.match(js,/معلومات محفوظة/);
  assert.doesNotMatch(js,/item\.confidence/);
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
  assert.equal(w.document.querySelector('#stepLbl').textContent,'2 من 2');
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
  assert.equal(w.document.querySelector('#stepLbl').textContent,'1 من 2');
  assert.equal(w.document.querySelector('#stepError').hidden,false);
  assert.match(w.document.querySelector('#stepError').textContent,/تعذّر حفظ الوصف/);
  assert.equal(w.document.querySelector('#next').disabled,false);
  assert.match(w.document.querySelector('#next').textContent,/التالي/);
  assert.equal(alerts,0);
  dom.window.close();
});


test('step two shows sourced company details and role reasons without invented fit percentages',async()=>{
  const [html,js]=await Promise.all([readFile(new URL('../app/onboard.html',import.meta.url),'utf8'),readFile(new URL('../app/onboard.js',import.meta.url),'utf8')]);
  const dom=new JSDOM(html,{url:'https://siyadah.test/app/onboard.html',runScripts:'outside-only'}),w=dom.window;
  w.scrollTo=()=>{};
  w.__SIY_ACCOUNT_NAME__='عشر أبعاد';
  const profile={companyName:'مكتب آخر',summary:'خدمات قانونية',pagesRead:2,factCount:2,coverageScore:20,knowledgeVersion:1,highlights:[{topic:'services',value:'استشارات قانونية',sourceUrl:'https://example.com/services'}]};
  const suggestion={id:'sales_leads',roleKey:'sales_leads',name:'سعد',title:'مسؤول العملاء المحتملين',goal:'يتابع العملاء',reason:'وجدنا خدمات الشركة.',knowledgeTopics:['services']};
  w.fetch=async()=>({ok:true,json:async()=>({ok:true,status:'ready',profile,suggestions:[suggestion]})});
  w.eval(js);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.querySelector('#stepLbl').textContent,'2 من 2');
  assert.match(w.document.querySelector('#companyInsights').textContent,/استشارات قانونية/);
  assert.equal(w.document.querySelector('#companyInsights a').getAttribute('href'),'https://example.com/services');
  assert.match(w.document.querySelector('#identityNote').textContent,/عشر أبعاد/);
  assert.match(w.document.querySelector('#identityNote').textContent,/مكتب آخر/);
  assert.match(w.document.querySelector('#plan').textContent,/وجدنا خدمات الشركة/);
  assert.doesNotMatch(w.document.querySelector('#plan').textContent,/95%/);
  w.document.querySelector('[data-suggestion="sales_leads"]').click();
  assert.match(w.document.querySelector('#next').textContent,/احفظ مسودة سعد/);
  dom.window.close();
});

test('failed save remains on step two and reuses its request ID',async()=>{
  const [html,js]=await Promise.all([readFile(new URL('../app/onboard.html',import.meta.url),'utf8'),readFile(new URL('../app/onboard.js',import.meta.url),'utf8')]);
  const dom=new JSDOM(html,{url:'https://siyadah.test/app/onboard.html',runScripts:'outside-only'}),w=dom.window,ids=[];
  w.scrollTo=()=>{};
  const profile={companyName:'شركة مثال',pagesRead:1,factCount:1,coverageScore:30,knowledgeVersion:1};
  const suggestion={id:'marketing',roleKey:'marketing',name:'ريم',title:'التسويق',goal:'المحتوى',reason:'من وصف الشركة',knowledgeTopics:[]};
  w.fetch=async(_url,options)=>{
    const payload=JSON.parse(options.body);
    if(payload.op==='check_company_enrichment')return {ok:true,json:async()=>({ok:true,status:'ready',profile,suggestions:[suggestion]})};
    if(payload.op==='select_employee'){ids.push(payload.request_id);return {ok:false,json:async()=>({ok:false,message:'تعذّر تجهيز الموظف.'})};}
    throw new Error(payload.op);
  };
  w.eval(js);await new Promise(resolve=>setImmediate(resolve));
  w.document.querySelector('[data-suggestion="marketing"]').click();
  w.document.querySelector('#next').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.querySelector('#stepLbl').textContent,'2 من 2');
  assert.match(w.document.querySelector('#stepError').textContent,/تعذّر تجهيز الموظف/);
  assert.equal(w.document.querySelector('#next').disabled,false);
  w.document.querySelector('#next').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);
  dom.window.close();
});

test('English step two keeps role selection and company source in LTR',async()=>{
  const [html,js]=await Promise.all([readFile(new URL('../app/onboard.html',import.meta.url),'utf8'),readFile(new URL('../app/onboard.js',import.meta.url),'utf8')]);
  const dom=new JSDOM(html,{url:'https://siyadah.test/app/onboard.html?lang=en',runScripts:'outside-only'}),w=dom.window;
  w.scrollTo=()=>{};
  const profile={companyName:'Example',pagesRead:2,factCount:1,coverageScore:30,knowledgeVersion:2,knowledgeAreas:['services']};
  const suggestion={id:'marketing',roleKey:'marketing',name:'ريم',title:'موظف التسويق',goal:'يجهز محتوى',reason:'السبب',knowledgeTopics:['services','brand']};
  w.fetch=async()=>({ok:true,json:async()=>({ok:true,status:'ready',profile,suggestions:[suggestion]})});
  w.eval(js);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.document.documentElement.dir,'ltr');
  assert.equal(w.document.querySelector('#stepLbl').textContent,'2 of 2');
  assert.match(w.document.querySelector('#plan').textContent,/Reem · Marketing employee/);
  w.document.querySelector('[data-suggestion="marketing"]').click();
  assert.match(w.document.querySelector('#next').textContent,/Save draft Reem/);
  dom.window.close();
});
