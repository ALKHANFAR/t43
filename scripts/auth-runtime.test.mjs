import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const auth=readFileSync(new URL('../auth.html',import.meta.url),'utf8');
const chat=readFileSync(new URL('../app/chat.js',import.meta.url),'utf8');
const chatPage=readFileSync(new URL('../app/chat.html',import.meta.url),'utf8');
const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const inlineScript=auth.match(/<script>([\s\S]+)<\/script>/)[1];
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('authentication uses Siyadah HttpOnly session endpoints through same-origin proxy',()=>{
  assert.match(auth,/\/v1\/auth\/login/);
  assert.match(auth,/\/v1\/auth\/signup/);
  assert.match(auth,/\/v1\/auth\/verify-email/);
  assert.match(auth,/\/v1\/auth\/forgot-password/);
  assert.match(auth,/\/v1\/auth\/reset-password/);
  assert.match(auth,/credentials:"include"/);
  assert.ok(!auth.includes('/api/v1/webhooks/'));
  assert.ok(!auth.includes('localStorage.setItem("siyadah_token"'));
});

test('chat sends cookies and never reads or sends a browser bearer token',()=>{
  assert.match(chat,/credentials:"include"/);
  assert.ok(!chat.includes('localStorage.getItem("siyadah_token")'));
  assert.ok(!chatPage.includes('localStorage.getItem("siyadah_token")'));
  assert.ok(!chat.includes('"Authorization":"Bearer "+'));
});

test('the current server owns the same-origin auth routes',()=>{
  assert.match(server,/siyadah-api\/v1\/auth\/signup/);
  assert.match(server,/siyadah-api\/v1\/auth\/verify-email/);
  assert.match(server,/siyadah-api\/v1\/auth\/login/);
  assert.match(server,/siyadah-api\/v1\/auth\/logout/);
  assert.match(server,/siyadah-api\/v1\/auth\/session/);
  assert.match(server,/siyadah-api\/v1\/auth\/forgot-password/);
  assert.match(server,/siyadah-api\/v1\/auth\/reset-password/);
});

test('signup waits for email confirmation instead of entering onboarding',async()=>{
  const dom=new JSDOM(auth,{url:'https://siyadah.test/auth.html',runScripts:'outside-only'}),w=dom.window,requests=[];
  w.fetch=async(url,options)=>{requests.push({url,options});return {json:async()=>({ok:true,message:'أرسلنا رابط التأكيد.'})};};
  w.eval(inlineScript);w.document.querySelector('#sw').click();
  w.document.querySelector('#company').value='شركة اختبار';w.document.querySelector('#email').value='qa@example.com';w.document.querySelector('#password').value='strong-password';
  w.document.querySelector('#go').click();await flush();await flush();
  assert.equal(requests[0].url,'/siyadah-api/v1/auth/signup');assert.equal(requests[0].options.credentials,'include');
  assert.deepEqual(JSON.parse(requests[0].options.body),{email:'qa@example.com',password:'strong-password',company_name:'شركة اختبار',locale:'ar'});
  assert.match(w.document.querySelector('#msg').textContent,/أرسلنا رابط التأكيد/);assert.equal(w.location.pathname,'/auth.html');
  dom.window.close();
});

test('account creation works in English with RTL/LTR and field feedback',async()=>{
  const dom=new JSDOM(auth,{url:'https://siyadah.test/auth.html',runScripts:'outside-only'}),w=dom.window,requests=[];
  w.fetch=async(url,options)=>{requests.push({url,options});return {json:async()=>({ok:true,message:'أرسلنا رابط التأكيد.'})};};
  w.eval(inlineScript);
  w.document.querySelector('#langEn').click();w.document.querySelector('#sw').click();
  assert.equal(w.document.documentElement.lang,'en');assert.equal(w.document.documentElement.dir,'ltr');
  assert.equal(w.document.querySelector('#mobileHome').getAttribute('href'),'index.html');
  assert.equal(w.document.querySelector('#ttl').textContent,'Create an account');
  assert.equal(w.document.querySelector('#sub').classList.contains('hide'),true);
  w.document.querySelector('#go').click();
  assert.equal(requests.length,0);
  for(const id of ['company','email','password'])assert.equal(w.document.querySelector(`#${id}`).getAttribute('aria-invalid'),'true');
  w.document.querySelector('#company').value='Example Co';w.document.querySelector('#email').value='qa@example.com';w.document.querySelector('#password').value='strong-password';
  w.document.querySelector('#showPassword').click();assert.equal(w.document.querySelector('#password').type,'text');
  w.document.querySelector('#go').click();await flush();await flush();
  assert.equal(JSON.parse(requests[0].options.body).locale,'en');
  assert.match(w.document.querySelector('#msg').textContent,/confirmation link/);
  dom.window.close();
});

test('the account story reveals three concise stages in both languages',()=>{
  const dom=new JSDOM(auth,{url:'https://siyadah.test/auth.html',runScripts:'outside-only'}),w=dom.window;
  w.eval(inlineScript);
  const step=w.document.querySelector('[data-story-step="1"]');step.click();
  assert.equal(step.getAttribute('aria-pressed'),'true');
  assert.equal(w.document.querySelector('#exampleIndex').textContent,'02 / 03');
  assert.match(w.document.querySelector('#exampleRequest').textContent,/خطة العمل/);
  w.document.querySelector('#langEn').click();
  assert.match(w.document.querySelector('#exampleRequest').textContent,/A plan/);
  w.document.querySelector('[data-story-step="2"]').click();
  assert.match(w.document.querySelector('#exampleDetail').textContent,/source/);
  dom.window.close();
});

test('recovery keeps its necessary guidance when the account form omits repeated copy',()=>{
  const dom=new JSDOM(auth,{url:'https://siyadah.test/auth.html',runScripts:'outside-only'}),w=dom.window;
  w.eval(inlineScript);
  assert.equal(w.document.querySelector('#sub').classList.contains('hide'),true);
  w.document.querySelector('#forgot').click();
  assert.equal(w.document.querySelector('#sub').classList.contains('hide'),false);
  assert.match(w.document.querySelector('#sub').textContent,/رابط الاستعادة/);
  dom.window.close();
});

test('signup gives a quiet, accessible cue for the password length requirement',()=>{
  const dom=new JSDOM(auth,{url:'https://siyadah.test/auth.html',runScripts:'outside-only'}),w=dom.window;
  w.eval(inlineScript);w.document.querySelector('#sw').click();
  const meter=w.document.querySelector('#passwordProgress'),password=w.document.querySelector('#password');
  assert.equal(meter.classList.contains('hide'),false);
  password.value='12345';password.dispatchEvent(new w.Event('input'));
  assert.equal(meter.value,5);
  password.value='1234567890';password.dispatchEvent(new w.Event('input'));
  assert.equal(meter.classList.contains('complete'),true);
  w.document.querySelector('#langEn').click();
  assert.match(meter.getAttribute('aria-label'),/minimum password length/);
  dom.window.close();
});

test('verification link is exchanged once then returns to login',async()=>{
  const dom=new JSDOM(auth,{url:'https://siyadah.test/auth.html?verify=one-time-token-value-that-is-long-enough',runScripts:'outside-only'}),w=dom.window,requests=[];
  w.fetch=async(url,options)=>{requests.push({url,options});return {json:async()=>({ok:true,message:'تم تأكيد بريدك. سجّل الدخول للمتابعة.'})};};
  w.eval(inlineScript);await flush();await flush();
  assert.equal(requests[0].url,'/siyadah-api/v1/auth/verify-email');
  assert.equal(JSON.parse(requests[0].options.body).token,'one-time-token-value-that-is-long-enough');
  assert.equal(w.location.search,'');assert.equal(w.document.querySelector('#ttl').textContent,'تسجيل الدخول');
  assert.match(w.document.querySelector('#msg').textContent,/تم تأكيد بريدك/);
  dom.window.close();
});

test('confirmation can be retried after a connection failure without losing its token',async()=>{
  const dom=new JSDOM(auth,{url:'https://siyadah.test/auth.html?verify=retry-token',runScripts:'outside-only'}),w=dom.window,requests=[];
  w.fetch=async(url,options)=>{
    requests.push({url,options});
    if(requests.length===1)throw new Error('offline');
    return {json:async()=>({ok:true})};
  };
  w.eval(inlineScript);await flush();await flush();
  assert.equal(w.location.search,'?verify=retry-token');
  assert.equal(w.document.querySelector('#ttl').textContent,'تأكيد البريد');
  assert.match(w.document.querySelector('#msg').textContent,/تعذر الاتصال/);
  w.document.querySelector('#go').click();await flush();await flush();
  assert.equal(requests.length,2);
  assert.equal(JSON.parse(requests[1].options.body).token,'retry-token');
  assert.equal(w.location.search,'');
  assert.equal(w.document.querySelector('#ttl').textContent,'تسجيل الدخول');
  dom.window.close();
});

test('login sends companies without an employee through the existing onboarding journey',()=>{
  const dom=new JSDOM(auth,{url:'https://siyadah.test/auth.html',runScripts:'outside-only'}),w=dom.window;
  w.eval(inlineScript);
  assert.equal(w.nextAfterLogin({onboardingRequired:true}),'app/onboard.html');
  assert.equal(w.nextAfterLogin({onboardingRequired:false}),'app/chat.html');
  assert.match(server,/const onboardingRequired=[^\n]*listEmployees/);
  dom.window.close();
});

test('empty company chat links to website onboarding instead of promising chat enrichment',()=>{
  assert.match(chat,/<a href=/);
  assert.match(chat,/onboard\.html/);
  assert.doesNotMatch(chat,/عطني موقع شركتك أو وصف قصير/);
});
