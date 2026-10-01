export class WaitlistError extends Error{
  constructor(code,status){super(code);this.code=code;this.status=status;}
}

const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const emailPattern=/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function createWaitlistProxy({webhookUrl,fetchImpl=fetch}){
  return async function submit(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new WaitlistError('invalid_request',400);
    const name=text(input.name,120),email=text(input.email,254),phone=text(input.phone,40);
    if(name.length<3||!emailPattern.test(email)||phone.replace(/\D/g,'').length<7)throw new WaitlistError('invalid_request',400);
    let destination;
    try{destination=new URL(webhookUrl);}catch{throw new WaitlistError('waitlist_unavailable',503);}
    if(destination.protocol!=='https:'||destination.username||destination.password)throw new WaitlistError('waitlist_unavailable',503);
    const payload={
      name,email,country_code:text(input.country_code,8)||'+966',phone,
      company:text(input.company,160),page:text(input.page,500),ref:text(input.ref,500),
      ts:text(input.ts,40)||new Date().toISOString(),
    };
    let response;
    try{
      response=await fetchImpl(destination.href,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
    }catch{throw new WaitlistError('waitlist_unavailable',502);}
    if(!response?.ok)throw new WaitlistError('waitlist_unavailable',502);
    return {ok:true,status:'accepted'};
  };
}
