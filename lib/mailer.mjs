export class MailerError extends Error{
  constructor(code,message,status=502){super(message);this.name='MailerError';this.code=code;this.status=status;}
}

function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}

export function createMailer({apiKey,from,fetchImpl=fetch}={}){
  const configured=()=>Boolean(String(apiKey||'').trim()&&String(from||'').trim());
  async function send({to,url,subject,text,html,category}){
    if(!configured())throw new MailerError('email_not_configured','إرسال البريد غير مهيأ.',503);
    const safeUrl=escapeHtml(url);
    const response=await fetchImpl('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({from,to:[to],subject,text:text(url),html:html(safeUrl),tags:[{name:'category',value:category}]}),
    });
    let payload={};try{payload=await response.json();}catch{}
    if(!response.ok||!payload?.id)throw new MailerError('email_send_failed','تعذّر إرسال البريد الآن.',502);
    return {id:payload.id};
  }
  const sendPasswordReset=({to,url})=>send({to,url,subject:'استعادة كلمة مرور سيادة',category:'password_reset',text:link=>`استخدم هذا الرابط خلال 30 دقيقة:\n${link}\n\nإذا لم تطلب ذلك فتجاهل الرسالة.`,html:link=>`<div dir="rtl"><p>طلبت استعادة كلمة مرور حسابك في سيادة.</p><p><a href="${link}">أنشئ كلمة مرور جديدة</a></p><p>الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة.</p></div>`});
  const sendEmailVerification=({to,url})=>send({to,url,subject:'أكد بريدك في سيادة',category:'email_verification',text:link=>`أكد بريدك خلال 30 دقيقة:\n${link}\n\nإذا لم تنشئ هذا الحساب فتجاهل الرسالة.`,html:link=>`<div dir="rtl"><p>بقيت خطوة واحدة لبدء حسابك في سيادة.</p><p><a href="${link}">تأكيد البريد وفتح الحساب</a></p><p>الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة.</p></div>`});
  return {configured,sendPasswordReset,sendEmailVerification};
}
