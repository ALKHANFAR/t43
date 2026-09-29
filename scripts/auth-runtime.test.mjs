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
  assert.deepEqual(JSON.parse(requests[0].options.body),{email:'qa@example.com',password:'strong-password',company_name:'شركة اختبار'});
  assert.match(w.document.querySelector('#msg').textContent,/أرسلنا رابط التأكيد/);assert.equal(w.location.pathname,'/auth.html');
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
