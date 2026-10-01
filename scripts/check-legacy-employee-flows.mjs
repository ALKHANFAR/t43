// Read-only release gate: every existing provider flow must have a company-owned employee row.
import pg from 'pg';
import {inventoryLegacyFlows} from '../lib/legacy-flow-inventory.mjs';

const databaseUrl=process.env.DATABASE_URL,base=String(process.env.ACTIVEPIECES_URL||'').replace(/\/$/,''),key=process.env.ACTIVEPIECES_PLATFORM_API_KEY;
if(!databaseUrl||!base||!key){console.error('Set DATABASE_URL, ACTIVEPIECES_URL and ACTIVEPIECES_PLATFORM_API_KEY.');process.exit(2);}
const url=new URL(databaseUrl),ssl=url.hostname.endsWith('.railway.internal')?false:true;
const pool=new pg.Pool({connectionString:databaseUrl,ssl,max:1,connectionTimeoutMillis:5000});
try{
  const client=await pool.connect();
  let projects,employees;
  try{
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout='5s'");
    projects=(await client.query("SELECT tenant_id,activepieces_project_id FROM siyadah_tenant_projects WHERE provision_status='ready' AND activepieces_project_id IS NOT NULL")).rows;
    employees=(await client.query('SELECT company_id,activepieces_flow_id FROM siyadah_digital_employees WHERE activepieces_flow_id IS NOT NULL')).rows;
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
  const result=await inventoryLegacyFlows({projects,employees,listFlows:async projectId=>{
    const response=await fetch(`${base}/api/v1/flows?projectId=${encodeURIComponent(projectId)}&limit=100`,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error(`provider_read_failed_${response.status}`);
    return (await response.json()).data;
  }});
  console.log(JSON.stringify({projects:result.projects,scannedFlows:result.scannedFlows,unadoptedCount:result.unadopted.length}));
  if(result.unadopted.length)process.exitCode=2;
}catch(error){
  const safeCodes=new Set(['legacy_flow_inventory_incomplete','legacy_flow_project_mismatch']);
  console.error(safeCodes.has(error?.message)?error.message:'inventory_read_failed');process.exitCode=2;
}
finally{await pool.end();}
