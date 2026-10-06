import {TenantProjectError} from './tenant-projects.mjs';

export async function provisionVerifiedTenant({tenantId,query,ensureProject}){
  const account=(await query(`SELECT a.company_id,a.company_name,a.status,
    EXISTS (SELECT 1 FROM siyadah_users u WHERE u.company_id=a.company_id AND u.email_verified_at IS NOT NULL) AS email_verified
    FROM siyadah_accounts a WHERE a.company_id=$1`,[tenantId])).rows?.[0];
  if(!account)throw new TenantProjectError('account_not_found','حساب الشركة غير موجود.',404);
  if(account.status==='pending_verification'||account.email_verified!==true)throw new TenantProjectError('email_not_verified','أكد بريد الشركة قبل تجهيز مشروعها.',403);
  return ensureProject({tenantId:account.company_id,displayName:account.company_name});
}
