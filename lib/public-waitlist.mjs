import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../migrations/0004-public-waitlist.sql',import.meta.url),'utf8');
const emailPattern=/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';

export class PublicWaitlistError extends Error{
  constructor(code,status){super(code);this.code=code;this.status=status;}
}

export function createPublicWaitlist({query}){
  if(typeof query!=='function')throw new TypeError('query is required');
  return {
    async init(){await query(migration);},
    async purgeExpired(){
      const result=await query(`DELETE FROM siyadah_public_waitlist
        WHERE created_at < now() - interval '90 days'`);
      return result.rowCount||0;
    },
    async submit(input){
      if(!input||typeof input!=='object'||Array.isArray(input))throw new PublicWaitlistError('invalid_request',400);
      const name=text(input.name,120),email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
      const countryCode=text(input.country_code,8)||'+966',phone=text(input.phone,40);
      const company=text(input.company,160),role=text(input.role,80);
      if(name.length<3||email.length>254||!emailPattern.test(email)||phone.replace(/\D/g,'').length<7||phone.replace(/\D/g,'').length>20){
        throw new PublicWaitlistError('invalid_request',400);
      }
      await query(`INSERT INTO siyadah_public_waitlist (email,name,country_code,phone,company,role)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (email) DO NOTHING`,
        [email,name,countryCode,phone,company,role]);
      return {ok:true,status:'accepted'};
    },
  };
}
