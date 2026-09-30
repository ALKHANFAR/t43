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
