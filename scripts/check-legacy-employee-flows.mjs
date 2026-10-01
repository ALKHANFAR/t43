// Read-only release gate: every flow in an account/profile-owned project needs an employee row.
import pg from 'pg';
import {inventoryLegacyFlows} from '../lib/legacy-flow-inventory.mjs';

const databaseUrl=process.env.DATABASE_URL,base=String(process.env.ACTIVEPIECES_URL||'').replace(/\/$/,''),key=process.env.ACTIVEPIECES_PLATFORM_API_KEY;
if(!databaseUrl||!base||!key){console.error('Set DATABASE_URL, ACTIVEPIECES_URL and ACTIVEPIECES_PLATFORM_API_KEY.');process.exit(2);}
const url=new URL(databaseUrl),ssl=url.hostname.endsWith('.railway.internal')?false:true;
const pool=new pg.Pool({connectionString:databaseUrl,ssl,max:1,connectionTimeoutMillis:5000});
try{
  const client=await pool.connect();
  let projects,employees,accounts,profiles,associatedCompanies;
  try{
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout='5s'");
    projects=(await client.query("SELECT tenant_id,activepieces_project_id,provision_status FROM siyadah_tenant_projects WHERE activepieces_project_id IS NOT NULL OR provision_status='ready'")).rows;
    employees=(await client.query('SELECT company_id,activepieces_flow_id FROM siyadah_digital_employees')).rows;
    accounts=(await client.query('SELECT company_id FROM siyadah_accounts')).rows;
    profiles=(await client.query('SELECT company_id,activepieces_project_id FROM siyadah_company_profiles')).rows;
    associatedCompanies=(await client.query(`SELECT company_id FROM siyadah_users
      UNION SELECT company_id FROM siyadah_conversations
      UNION SELECT company_id FROM siyadah_conversation_messages
      UNION SELECT company_id FROM siyadah_company_knowledge_items`)).rows;
    const requestTable=(await client.query("SELECT to_regclass('siyadah_chat_requests') AS table_name")).rows?.[0]?.table_name;
    if(requestTable)associatedCompanies.push(...(await client.query('SELECT DISTINCT company_id FROM siyadah_chat_requests')).rows);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
  const result=await inventoryLegacyFlows({projects,employees,accounts,profiles,associatedCompanies,listFlows:async projectId=>{
    const response=await fetch(`${base}/api/v1/flows?projectId=${encodeURIComponent(projectId)}&limit=100`,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error(`provider_read_failed_${response.status}`);
    return (await response.json()).data;
  }});
  console.log(JSON.stringify({projects:result.projects,customerProjects:result.customerProjects,orphanProjects:result.orphanProjects,scannedFlows:result.scannedFlows,orphanProjectFlows:result.orphanProjectFlows,unadoptedCount:result.unadopted.length}));
  if(result.unadopted.length)process.exitCode=2;
}catch(error){
  const safeCodes=new Set(['legacy_flow_inventory_incomplete','legacy_flow_project_mismatch','legacy_flow_project_profile_mismatch','legacy_flow_ownership_incomplete','legacy_flow_orphan_status_unverified','legacy_flow_project_not_ready','legacy_flow_project_mapping_incomplete']);
  console.error(safeCodes.has(error?.message)?error.message:'inventory_read_failed');process.exitCode=2;
}
finally{await pool.end();}
