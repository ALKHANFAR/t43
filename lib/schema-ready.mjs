import {existsSync} from 'node:fs';

const localDraftMigration=new URL('../migrations/0002-local-employee-drafts.sql',import.meta.url);
const googleOAuthMigration=new URL('../migrations/0003-google-oauth-attempts.sql',import.meta.url);
const publicWaitlistMigration=new URL('../migrations/0004-public-waitlist.sql',import.meta.url);
const mcpMigration=new URL('../migrations/0005-activepieces-mcp.sql',import.meta.url);
const requiredQueries=[
  'SELECT company_id,session_version FROM siyadah_accounts LIMIT 0',
  'SELECT tenant_id,activepieces_project_id,provision_status FROM siyadah_tenant_projects LIMIT 0',
  'SELECT company_id,settings_json FROM siyadah_company_profiles LIMIT 0',
  'SELECT company_id,activepieces_flow_id,status FROM siyadah_digital_employees LIMIT 0',
  'SELECT company_id,id FROM siyadah_conversations LIMIT 0',
  'SELECT company_id,conversation_id,request_id FROM siyadah_conversation_messages LIMIT 0',
  'SELECT company_id,request_id,request_hash,claim_token,status,execution_identity_json FROM siyadah_chat_requests LIMIT 0',
];

export async function assertSchemaReady(query,{localDrafts=existsSync(localDraftMigration)}={}){
  if(typeof query!=='function')throw new TypeError('query is required');
  for(const sql of requiredQueries)await query(sql);
  if(existsSync(googleOAuthMigration))await query('SELECT state_hash,company_id,session_hash,expires_at FROM siyadah_google_oauth_attempts LIMIT 0');
  if(existsSync(publicWaitlistMigration))await query('SELECT email,name,country_code,phone,company,role FROM siyadah_public_waitlist LIMIT 0');
  if(existsSync(mcpMigration)){
    await query('SELECT tenant_id,project_id,client_id,refresh_token_cipher FROM siyadah_mcp_grants LIMIT 0');
    await query('SELECT id,tenant_id,conversation_id,tool_name,expires_at FROM siyadah_mcp_approvals LIMIT 0');
  }
  const primaryKey=await query(`SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='siyadah_chat_requests'::regclass
      AND contype='p'
      AND pg_get_constraintdef(oid)='PRIMARY KEY (company_id, request_id)'
  ) AS ledger_pk_ok`);
  if(primaryKey.rows?.[0]?.ledger_pk_ok!==true)throw new Error('chat request ledger primary key is missing');
  if(!localDrafts)return;
  await query('SELECT creation_request_id,creation_payload_key FROM siyadah_digital_employees LIMIT 0');
  const draftSchema=await query(`SELECT
    EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid='siyadah_digital_employees'::regclass
        AND attname='activepieces_flow_id' AND NOT attnotnull
    ) AS flow_nullable_ok,
    EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_class idx ON idx.oid=i.indexrelid
      JOIN pg_attribute company ON company.attrelid=i.indrelid AND company.attname='company_id'
      JOIN pg_attribute request ON request.attrelid=i.indrelid AND request.attname='creation_request_id'
      WHERE i.indrelid='siyadah_digital_employees'::regclass
        AND idx.relname='siyadah_employees_creation_request_idx'
        AND i.indisunique AND i.indisvalid AND i.indpred IS NULL AND i.indnkeyatts=2
        AND i.indkey[0]=company.attnum AND i.indkey[1]=request.attnum
    ) AS draft_unique_ok`);
  if(draftSchema.rows?.[0]?.flow_nullable_ok!==true||draftSchema.rows?.[0]?.draft_unique_ok!==true){
    throw new Error('local employee draft schema is incomplete');
  }
}
