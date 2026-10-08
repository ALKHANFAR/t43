import {createHash,randomBytes,randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';

const EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FAKE_HASH=bcrypt.hashSync('siyadah-invalid-password',12);

export class AccountAuthError extends Error{
  constructor(code,message,status=500){super(message);this.name='AccountAuthError';this.code=code;this.status=status;}
}

function email(value){
  const clean=String(value||'').trim().toLowerCase();
  if(clean.length>320||!EMAIL.test(clean))throw new AccountAuthError('invalid_credentials','أدخل بريدًا صحيحًا وكلمة مرور من 10 أحرف على الأقل.',400);
  return clean;
}

function signupInput(input){
  const mail=email(input?.email),password=String(input?.password||''),companyName=String(input?.company_name||'').trim().slice(0,120);
  if(password.length<10||password.length>128||!companyName)throw new AccountAuthError('invalid_credentials','أدخل اسم الشركة وبريدًا صحيحًا وكلمة مرور من 10 أحرف على الأقل.',400);
  return {mail,password,companyName};
}

function password(value){
  const clean=String(value||'');
  if(clean.length<10||clean.length>128)throw new AccountAuthError('invalid_password','استخدم كلمة مرور من 10 أحرف على الأقل.',400);
  return clean;
}
function resetHash(token){return createHash('sha256').update(String(token||'')).digest('hex');}

export function createAccountAuthService({query}={}){
  if(typeof query!=='function')throw new TypeError('query is required');

  async function init(){
    await query(`CREATE TABLE IF NOT EXISTS siyadah_accounts (
      company_id varchar(128) PRIMARY KEY,
      company_name varchar(120) NOT NULL,
      status varchar(24) NOT NULL DEFAULT 'pending_link',
      session_version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await query('ALTER TABLE siyadah_accounts ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1');
    await query(`CREATE TABLE IF NOT EXISTS siyadah_users (
      id uuid PRIMARY KEY,
      company_id varchar(128) NOT NULL REFERENCES siyadah_accounts(company_id),
      email varchar(320) UNIQUE NOT NULL,
      password_hash varchar(100) NOT NULL,
      email_verified_at timestamptz DEFAULT now(),
      verification_token_hash char(64),
      verification_expires_at timestamptz,
      verification_provider_message_id varchar(160),
      failed_attempts integer NOT NULL DEFAULT 0,
      locked_until timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await query('ALTER TABLE siyadah_users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz DEFAULT now()');
    await query('ALTER TABLE siyadah_users ADD COLUMN IF NOT EXISTS verification_token_hash char(64)');
    await query('ALTER TABLE siyadah_users ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz');
    await query('ALTER TABLE siyadah_users ADD COLUMN IF NOT EXISTS verification_provider_message_id varchar(160)');
    await query(`CREATE TABLE IF NOT EXISTS siyadah_password_resets (
      token_hash char(64) PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES siyadah_users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      provider_message_id varchar(160),
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async function signup(input){
    const {mail,password,companyName}=signupInput(input),companyId=`company_${randomBytes(18).toString('base64url')}`,userId=randomUUID(),passwordHash=await bcrypt.hash(password,12),verificationToken=randomBytes(32).toString('base64url');
    try{
      const result=await query(`WITH account AS (
        INSERT INTO siyadah_accounts(company_id,company_name,status) VALUES ($1,$2,'pending_verification')
        RETURNING company_id,company_name,status,session_version
      ), member AS (
        INSERT INTO siyadah_users(id,company_id,email,password_hash,email_verified_at,verification_token_hash,verification_expires_at)
        SELECT $3,company_id,$4,$5,null,$6,now()+interval '30 minutes' FROM account
        RETURNING company_id,email
      )
      SELECT account.company_id,account.company_name,account.status,account.session_version,member.email FROM account JOIN member USING (company_id)`,[companyId,companyName,userId,mail,passwordHash,resetHash(verificationToken)]);
      return {...result.rows[0],verificationToken};
    }catch(error){
      if(error?.code==='23505')throw new AccountAuthError('email_exists','هذا البريد مسجّل من قبل.',409);
      throw error;
    }
  }

  async function login(input){
    const mail=email(input?.email),password=String(input?.password||'');
    const result=await query(`SELECT u.company_id,u.email,u.password_hash,u.email_verified_at,u.failed_attempts,u.locked_until,a.company_name,a.status,a.session_version
      FROM siyadah_users u JOIN siyadah_accounts a USING (company_id) WHERE u.email=$1`,[mail]);
    const account=result.rows?.[0]||null;
    if(account?.locked_until&&new Date(account.locked_until)>new Date())throw new AccountAuthError('login_rate_limited','محاولات كثيرة. حاول بعد 15 دقيقة.',429);
    const valid=await bcrypt.compare(password,account?.password_hash||FAKE_HASH);
    if(!account||!valid){
      if(account)await query(`UPDATE siyadah_users SET failed_attempts=failed_attempts+1,
        locked_until=CASE WHEN failed_attempts+1>=5 THEN now()+interval '15 minutes' ELSE locked_until END,updated_at=now() WHERE email=$1`,[mail]);
      throw new AccountAuthError('invalid_login','البريد أو كلمة المرور غير صحيحة.',401);
    }
    if(!account.email_verified_at)throw new AccountAuthError('email_not_verified','أكد بريدك الإلكتروني أولًا.',403);
    await query('UPDATE siyadah_users SET failed_attempts=0,locked_until=null,updated_at=now() WHERE email=$1',[mail]);
    delete account.password_hash;delete account.email_verified_at;delete account.failed_attempts;delete account.locked_until;
    return account;
  }

  async function createEmailVerification(value){
    const mail=email(value),token=randomBytes(32).toString('base64url');
    const result=await query(`UPDATE siyadah_users SET verification_token_hash=$2,verification_expires_at=now()+interval '30 minutes',verification_provider_message_id=null,updated_at=now()
      WHERE email=$1 AND email_verified_at IS NULL RETURNING email`,[mail,resetHash(token)]);
    return result.rowCount?{email:mail,token}:null;
  }

  async function markEmailVerificationSent(token,messageId){
    await query('UPDATE siyadah_users SET verification_provider_message_id=$2 WHERE verification_token_hash=$1',[resetHash(token),String(messageId||'').slice(0,160)]);
  }

  async function verifyEmail(token){
    const clean=String(token||'');
    if(clean.length<32||clean.length>256)throw new AccountAuthError('invalid_verification','رابط التأكيد غير صالح أو منتهي.',400);
    const result=await query(`WITH verified AS (
        UPDATE siyadah_users SET email_verified_at=now(),verification_token_hash=null,verification_expires_at=null,updated_at=now()
        WHERE verification_token_hash=$1 AND email_verified_at IS NULL AND verification_expires_at>now()
        RETURNING company_id
      ), activated AS (
        UPDATE siyadah_accounts a SET status=CASE WHEN status='pending_verification' THEN 'pending_link' ELSE status END,updated_at=now()
        FROM verified WHERE a.company_id=verified.company_id RETURNING a.company_id
      ) SELECT company_id FROM activated`,[resetHash(clean)]);
    if(!result.rowCount)throw new AccountAuthError('invalid_verification','رابط التأكيد غير صالح أو منتهي.',400);
    return {companyId:result.rows[0].company_id};
  }

  async function read(companyId){
    const result=await query('SELECT company_id,company_name,status,session_version FROM siyadah_accounts WHERE company_id=$1',[companyId]);
    return result.rows?.[0]||null;
  }
  async function verifiedEmail(companyId){
    const result=await query('SELECT email FROM siyadah_users WHERE company_id=$1 AND email_verified_at IS NOT NULL',[companyId]);
    if(result.rows?.length!==1)throw new AccountAuthError('verified_identity_required','تعذّر تأكيد بريد صاحب الحساب لتهيئة الوصول.',409);
    return email(result.rows[0].email);
  }

  async function invalidateSessions(companyId){
    await query('UPDATE siyadah_accounts SET session_version=session_version+1,updated_at=now() WHERE company_id=$1',[companyId]);
  }

  async function createPasswordReset(value){
    const mail=email(value),token=randomBytes(32).toString('base64url'),tokenHash=resetHash(token);
    const result=await query(`INSERT INTO siyadah_password_resets(token_hash,user_id,expires_at)
      SELECT $2,id,now()+interval '30 minutes' FROM siyadah_users WHERE email=$1 AND email_verified_at IS NOT NULL
      RETURNING token_hash`,[mail,tokenHash]);
    return result.rowCount?{email:mail,token}:null;
  }

  async function markPasswordResetSent(token,messageId){
    await query('UPDATE siyadah_password_resets SET provider_message_id=$2 WHERE token_hash=$1',[resetHash(token),String(messageId||'').slice(0,160)]);
  }

  async function cancelPasswordReset(token){
    await query('DELETE FROM siyadah_password_resets WHERE token_hash=$1',[resetHash(token)]);
  }

  async function resetPassword(input){
    const token=String(input?.token||''),passwordHash=await bcrypt.hash(password(input?.password),12);
    if(token.length<32||token.length>256)throw new AccountAuthError('invalid_reset','رابط الاستعادة غير صالح أو منتهي.',400);
    const result=await query(`WITH claimed AS (
        UPDATE siyadah_password_resets SET used_at=now()
        WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now()
        RETURNING user_id
      ), changed AS (
        UPDATE siyadah_users u SET password_hash=$2,failed_attempts=0,locked_until=null,updated_at=now()
        FROM claimed WHERE u.id=claimed.user_id RETURNING u.company_id
      ), invalidated AS (
        UPDATE siyadah_accounts a SET session_version=session_version+1,updated_at=now()
        FROM changed WHERE a.company_id=changed.company_id RETURNING a.company_id
      ) SELECT company_id FROM invalidated`,[resetHash(token),passwordHash]);
    if(!result.rowCount)throw new AccountAuthError('invalid_reset','رابط الاستعادة غير صالح أو منتهي.',400);
    return {companyId:result.rows[0].company_id};
  }

  return {init,signup,login,read,verifiedEmail,invalidateSessions,createEmailVerification,markEmailVerificationSent,verifyEmail,createPasswordReset,markPasswordResetSent,cancelPasswordReset,resetPassword};
}
