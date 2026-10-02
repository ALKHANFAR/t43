import pg from 'pg';
import {createAccountAuthService} from '../lib/account-auth.mjs';
import {createTenantProjectService} from '../lib/tenant-projects.mjs';
import {createCompanyProfileService} from '../lib/company-profile.mjs';
import {assertSchemaReady} from '../lib/schema-ready.mjs';
import {createGoogleOAuthAttemptStore} from '../lib/google-oauth-attempts.mjs';
import {createPublicWaitlist} from '../lib/public-waitlist.mjs';

const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('DATABASE_URL is required for schema migration');
const host=new URL(connectionString).hostname;
const ssl=host.endsWith('.railway.internal')?false:process.env.NODE_ENV==='production'?{rejectUnauthorized:true}:undefined;
const client=new pg.Client({connectionString,ssl,connectionTimeoutMillis:10_000});
const deadline=setTimeout(()=>{
  console.error('schema migration exceeded 120 seconds');
  process.exit(1);
},120_000);
try{
  await client.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout = '2s'");
  await client.query("SET LOCAL statement_timeout = '20s'");
  await client.query('SELECT pg_advisory_xact_lock(77201601,1)');
  const query=(sql,values)=>client.query(sql,values);
  await createAccountAuthService({query}).init();
  await createTenantProjectService({query}).init();
  await createCompanyProfileService({query}).init();
  await createGoogleOAuthAttemptStore({query}).init();
  await createPublicWaitlist({query}).init();
  await assertSchemaReady(query);
  await client.query('COMMIT');
  console.log('Siyadah schema migration complete');
}catch(error){
  try{await client.query('ROLLBACK');}catch{}
  console.error('Siyadah schema migration failed',error?.code||error?.name||'unknown_error');
  process.exitCode=1;
}finally{
  clearTimeout(deadline);
  await client.end().catch(()=>{});
}
