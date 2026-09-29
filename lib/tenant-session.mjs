import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

export const SESSION_COOKIE='siyadah_session';

function encode(value){return Buffer.from(value).toString('base64url');}
function sign(payload,secret){return createHmac('sha256',secret).update(payload).digest('base64url');}

export function createTenantSession(secret,companyId=`company_${randomBytes(18).toString('base64url')}`){
  if(String(secret||'').length<32)throw new Error('SIYADAH_SESSION_SECRET must be at least 32 characters');
  const payload=encode(JSON.stringify({v:1,companyId,createdAt:Date.now()}));
  return `${payload}.${sign(payload,secret)}`;
}

export function readTenantSession(token,secret){
  if(String(secret||'').length<32||typeof token!=='string')return null;
  const [payload,signature,...extra]=token.split('.');
  if(!payload||!signature||extra.length)return null;
  const expected=sign(payload,secret),actual=Buffer.from(signature),wanted=Buffer.from(expected);
  if(actual.length!==wanted.length||!timingSafeEqual(actual,wanted))return null;
  try{
    const session=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    if(session?.v!==1||!/^company_[A-Za-z0-9_-]{20,80}$/.test(String(session.companyId||'')))return null;
    return session;
  }catch{return null;}
}

export function cookieValue(header,name=SESSION_COOKIE){
  for(const part of String(header||'').split(';')){
    const index=part.indexOf('=');
    if(index<0)continue;
    if(part.slice(0,index).trim()===name)return decodeURIComponent(part.slice(index+1).trim());
  }
  return '';
}

export function sessionCookie(token,{secure=true,maxAge=60*60*24*365}={}){
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;
}
