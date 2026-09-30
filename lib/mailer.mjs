export class MailerError extends Error{
  constructor(code,message,status=502){super(message);this.name='MailerError';this.code=code;this.status=status;}
}

function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}

const brand={
  mark:'https://lh3.googleusercontent.com/d/1zC9B3G3XCXaosM5Tn8uyxzwlf7L89b-2',
  wordmark:'https://lh3.googleusercontent.com/d/1GzruymXmBrHYh5GhGof8gWw3_Mp6mP3J',
};

function language(locale){return String(locale||'').toLowerCase().startsWith('en')?'en':'ar';}

function emailHtml({locale,title,lead,action,url,expiry,ignore}){
  const en=language(locale)==='en',dir=en?'ltr':'rtl',align=en?'left':'right';
  return `<!doctype html><html lang="${en?'en':'ar'}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#F7F7FB;color:#0A0A0A;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(lead)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F7FB;border-collapse:collapse"><tr><td align="center" style="padding:36px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E0E1E8;border-radius:18px;border-collapse:separate;overflow:hidden">
        <tr><td style="padding:34px 36px 10px;text-align:${align}">
          <a href="https://siyadah-ai.com" style="text-decoration:none"><img src="${brand.wordmark}" width="128" height="19" alt="Siyadah AI" style="display:block;width:128px;height:19px;border:0"></a>
        </td></tr>
        <tr><td style="padding:22px 36px 36px;text-align:${align}">
          <h1 style="margin:0 0 14px;font-size:25px;line-height:1.35;color:#0A0A0A;font-weight:700">${escapeHtml(title)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#55555A">${escapeHtml(lead)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#0A0A0A" style="border-radius:10px">
            <a href="${url}" style="display:inline-block;padding:13px 22px;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;line-height:20px">${escapeHtml(action)}</a>
          </td></tr></table>
          <p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:#77777C">${escapeHtml(expiry)}</p>
          <p style="margin:8px 0 0;font-size:12px;line-height:1.7;color:#77777C">${escapeHtml(ignore)}</p>
          <p style="margin:20px 0 6px;font-size:11px;line-height:1.6;color:#9A9AA0">${en?'If the button does not work, copy this link:':'إذا لم يعمل الزر، انسخ هذا الرابط:'}</p>
          <p style="margin:0;direction:ltr;text-align:left;word-break:break-all;font-size:11px;line-height:1.6;color:#0A0A0A">${url}</p>
        </td></tr>
        <tr><td style="border-top:1px solid #ECECF1;padding:20px 36px;text-align:${align}">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="padding-${en?'right':'left'}:12px;line-height:0"><img src="${brand.mark}" width="31" height="19" alt="" style="display:block;width:31px;height:19px;border:0"></td>
            <td style="border-${en?'left':'right'}:1px solid #DADADA;padding-${en?'left':'right'}:12px;font-size:11px;line-height:1.55;color:#8A8A8A">Write one sentence. Your operations run themselves.<br><a href="https://siyadah-ai.com" style="color:#0A0A0A;text-decoration:none">siyadah-ai.com</a></td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

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
  const sendPasswordReset=({to,url,locale})=>{
    const en=language(locale)==='en',copy=en?{
      subject:'Reset your Siyadah password',title:'Create a new password',lead:'We received a request to reset your Siyadah account password.',action:'Create new password',expiry:'This link expires in 30 minutes and can only be used once.',ignore:'If you did not request this, you can safely ignore this email.',
    }:{subject:'استعادة كلمة مرور سيادة',title:'أنشئ كلمة مرور جديدة',lead:'وصلنا طلب لاستعادة كلمة مرور حسابك في سيادة.',action:'إنشاء كلمة مرور جديدة',expiry:'الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة.',ignore:'إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان.'};
    return send({to,url,subject:copy.subject,category:'password_reset',text:link=>`${copy.lead}\n\n${copy.action}:\n${link}\n\n${copy.expiry}\n${copy.ignore}`,html:link=>emailHtml({...copy,locale,url:link})});
  };
  const sendEmailVerification=({to,url,locale})=>{
    const en=language(locale)==='en',copy=en?{
      subject:'Confirm your email for Siyadah',title:'Confirm your email',lead:'One last step before your Siyadah account is ready.',action:'Confirm email and open account',expiry:'This link expires in 30 minutes and can only be used once.',ignore:'If you did not create this account, you can safely ignore this email.',
    }:{subject:'أكد بريدك في سيادة',title:'أكد بريدك',lead:'بقيت خطوة واحدة ليصبح حسابك في سيادة جاهزًا.',action:'تأكيد البريد وفتح الحساب',expiry:'الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة.',ignore:'إذا لم تنشئ هذا الحساب، يمكنك تجاهل هذه الرسالة بأمان.'};
    return send({to,url,subject:copy.subject,category:'email_verification',text:link=>`${copy.lead}\n\n${copy.action}:\n${link}\n\n${copy.expiry}\n${copy.ignore}`,html:link=>emailHtml({...copy,locale,url:link})});
  };
  return {configured,sendPasswordReset,sendEmailVerification};
}
