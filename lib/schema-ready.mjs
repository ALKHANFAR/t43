const requiredQueries=[
  'SELECT company_id,session_version FROM siyadah_accounts LIMIT 0',
  'SELECT tenant_id,activepieces_project_id,provision_status FROM siyadah_tenant_projects LIMIT 0',
  'SELECT company_id,settings_json FROM siyadah_company_profiles LIMIT 0',
  'SELECT company_id,activepieces_flow_id,status FROM siyadah_digital_employees LIMIT 0',
  'SELECT company_id,id FROM siyadah_conversations LIMIT 0',
  'SELECT company_id,conversation_id,request_id FROM siyadah_conversation_messages LIMIT 0',
  'SELECT company_id,request_id,request_hash,claim_token,status FROM siyadah_chat_requests LIMIT 0',
];

export async function assertSchemaReady(query){
  if(typeof query!=='function')throw new TypeError('query is required');
  for(const sql of requiredQueries)await query(sql);
  const primaryKey=await query(`SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='siyadah_chat_requests'::regclass
      AND contype='p'
      AND pg_get_constraintdef(oid)='PRIMARY KEY (company_id, request_id)'
  ) AS ledger_pk_ok`);
  if(primaryKey.rows?.[0]?.ledger_pk_ok!==true)throw new Error('chat request ledger primary key is missing');
}
