import test from 'node:test';
import assert from 'node:assert/strict';
import {createMailer,MailerError} from '../lib/mailer.mjs';

test('mailer fails closed without credentials',async()=>{
  const mailer=createMailer({});
  assert.equal(mailer.configured(),false);
  await assert.rejects(()=>mailer.sendPasswordReset({to:'user@example.com',url:'https://example.com/reset'}),error=>error instanceof MailerError&&error.status===503);
});

test('mailer sends the one-time link through Resend HTTPS API',async()=>{
  let request;
  const mailer=createMailer({apiKey:'re_test',from:'سيادة <support@example.com>',fetchImpl:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({id:'email_123'})};}});
  const result=await mailer.sendPasswordReset({to:'user@example.com',url:'https://siyadah.example/auth.html?reset=a%26b'});
  assert.equal(result.id,'email_123');assert.equal(request.url,'https://api.resend.com/emails');
  assert.equal(request.options.headers.Authorization,'Bearer re_test');
  const payload=JSON.parse(request.options.body);
  assert.deepEqual(payload.to,['user@example.com']);
  assert.match(payload.html,/a%26b/);assert.doesNotMatch(payload.html,/a&b/);
});

test('mailer sends an email verification link through the same guarded channel',async()=>{
  let request;
  const mailer=createMailer({apiKey:'re_test',from:'سيادة <support@example.com>',fetchImpl:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({id:'email_verify_123'})};}});
  const result=await mailer.sendEmailVerification({to:'new@example.com',url:'https://siyadah.example/auth.html?verify=one%26two'});
  assert.equal(result.id,'email_verify_123');assert.equal(request.url,'https://api.resend.com/emails');
  const payload=JSON.parse(request.options.body);
  assert.deepEqual(payload.to,['new@example.com']);assert.equal(payload.subject,'أكد بريدك في سيادة');
  assert.deepEqual(payload.tags,[{name:'category',value:'email_verification'}]);
  assert.match(payload.html,/one%26two/);assert.doesNotMatch(payload.html,/one&two/);
});

test('mailer follows the requested interface language with one shared branded layout',async()=>{
  const requests=[];
  const mailer=createMailer({apiKey:'re_test',from:'Siyadah <support@example.com>',fetchImpl:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({id:'email_localized'})};}});
  await mailer.sendPasswordReset({to:'user@example.com',url:'https://siyadah.example/reset',locale:'en-US'});
  await mailer.sendEmailVerification({to:'user@example.com',url:'https://siyadah.example/verify',locale:'ar-SA'});
  assert.equal(requests[0].subject,'Reset your Siyadah password');assert.match(requests[0].html,/dir="ltr"/);assert.match(requests[0].html,/SIYADAH|Siyadah/i);
  assert.match(requests[0].html,/width="160" height="24" alt="Siyadah AI"/);
  assert.match(requests[0].html,/#0A0A0A/);assert.doesNotMatch(requests[0].html,/#(?:0B844B|1029CF)/);
  assert.equal(requests[1].subject,'أكد بريدك في سيادة');assert.match(requests[1].html,/dir="rtl"/);assert.match(requests[1].html,/siyadah-ai\.com/);
});
