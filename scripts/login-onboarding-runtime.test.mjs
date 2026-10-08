import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const start=source.indexOf('async function authRoute('),end=source.indexOf('async function buildOwnedDraftFlow(',start);
for(const profile of [null,{company_id:'company-a',profile_json:{facts:[]}}])test(profile?'returning customer without employees goes to chat':'new customer without a company profile gets onboarding',async()=>{
 let answer;const fn=runInNewContext(source.slice(start,end)+';authRoute',{
  accountAuth:async()=>({login:async()=>({company_id:'company-a',company_name:'الشركة',email:'owner@example.test',status:'active',session_version:1})}),
  companyProfiles:async()=>({read:async id=>{assert.equal(id,'company-a');return profile;},listEmployees:async()=>{throw new Error('employee count must not decide customer onboarding');}}),
  body:async()=>({}),authCookie:()=> 'cookie',json:(_res,status,data)=>{assert.equal(status,200);answer=data;},
  AccountAuthError:class extends Error{},TenantProjectError:class extends Error{},MailerError:class extends Error{},console,
 });await fn({headers:{}},{},'login');assert.equal(answer.onboardingRequired,!profile);assert.equal(answer.account.companyId,'company-a');
});
