import {TenantProjectError} from './tenant-projects.mjs';

// One session-bound lock per request, acquired lazily before its first external effect.
export function createCompanyEffectLock({database,companyId}){
  let client=null;
  const keys=[companyId,'siyadah:project-effects'];
  async function acquire(){
    if(client)return;
    const connection=await (await database()).connect();
    try{
      const result=await connection.query('SELECT pg_try_advisory_lock(hashtext($1),hashtext($2)) AS locked',keys);
      if(result.rows?.[0]?.locked!==true){
        connection.release();
        throw new TenantProjectError('company_effect_busy','يوجد إجراء آخر قيد التنفيذ لشركتك. يمكنك متابعة القراءة؛ أعد طلب التنفيذ بعد اكتماله.',409);
      }
      client=connection;
    }catch(error){
      if(error.code!=='company_effect_busy')connection.release(true);
      throw error;
    }
  }
  async function release(){
    if(!client)return;
    const connection=client;client=null;
    try{
      const result=await connection.query('SELECT pg_advisory_unlock(hashtext($1),hashtext($2)) AS unlocked',keys);
      if(result.rows?.[0]?.unlocked!==true)throw new Error('company effect lock release unverified');
      connection.release();
    }catch(error){connection.release(true);throw error;}
  }
  return {acquire,release};
}
