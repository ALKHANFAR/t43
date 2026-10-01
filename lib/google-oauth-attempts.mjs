import {createHash} from 'node:crypto';

const digest=value=>createHash('sha256').update(value).digest('hex');

export function createGoogleOAuthAttemptStore({query}){
  if(typeof query!=='function')throw new TypeError('query is required');
  return {
    async init(){
      await query(`CREATE TABLE IF NOT EXISTS siyadah_google_oauth_attempts (
        state_hash text PRIMARY KEY,
        company_id text NOT NULL,
        session_hash text NOT NULL,
        expires_at timestamptz NOT NULL
      )`);
      await query('CREATE INDEX IF NOT EXISTS siyadah_google_oauth_attempts_expiry_idx ON siyadah_google_oauth_attempts (expires_at)');
    },
    async save({state,companyId,sessionBinding,expiresAt}){
      await query('DELETE FROM siyadah_google_oauth_attempts WHERE expires_at < now()');
      await query('INSERT INTO siyadah_google_oauth_attempts (state_hash,company_id,session_hash,expires_at) VALUES ($1,$2,$3,$4)',[digest(state),companyId,digest(sessionBinding),new Date(expiresAt)]);
    },
    async consume({state,companyId,sessionBinding}){
      const result=await query(`DELETE FROM siyadah_google_oauth_attempts
        WHERE state_hash=$1 AND company_id=$2 AND session_hash=$3 AND expires_at>now()
        RETURNING state_hash`,[digest(state),companyId,digest(sessionBinding)]);
      return result.rows?.length===1;
    }
  };
}
