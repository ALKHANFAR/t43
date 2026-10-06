import test from 'node:test';
import assert from 'node:assert/strict';
import {provisionVerifiedTenant} from '../lib/tenant-provisioning.mjs';

const tenantId='company_test';
async function rejected(account,code,status){
  let calls=0;
  await assert.rejects(provisionVerifiedTenant({tenantId,query:async(sql,values)=>{
    assert.deepEqual(values,[tenantId]);
    return {rows:account?[account]:[]};
  },ensureProject:async()=>{calls++;}}),error=>error.code===code&&error.status===status);
  assert.equal(calls,0,'rejected accounts must not reach project provisioning');
}
test('internal provisioning rejects an absent company before provider access',async()=>{
  await rejected(null,'account_not_found',404);
});
test('internal provisioning rejects pending verification and missing verified email',async()=>{
  await rejected({company_id:tenantId,status:'pending_verification',email_verified:true},'email_not_verified',403);
  await rejected({company_id:tenantId,status:'pending_link',email_verified:false},'email_not_verified',403);
});
test('internal provisioning uses the confirmed company identity and stored name',async()=>{
  const expected={tenant_id:tenantId,created:false};
  let calls=0;
  const result=await provisionVerifiedTenant({tenantId,displayName:'اسم من الطلب',query:async()=>({rows:[{
    company_id:tenantId,company_name:'الاسم المسجل',status:'pending_link',email_verified:true,
  }]}),ensureProject:async input=>{
    calls++;
    assert.deepEqual(input,{tenantId,displayName:'الاسم المسجل'});
    return expected;
  }});
  assert.equal(calls,1);
  assert.equal(result,expected);
});
