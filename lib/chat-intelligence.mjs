function clean(value,limit=500){return String(value||'').replace(/\s+/g,' ').trim().slice(0,limit);}

export function flowName(message){
  const compact=clean(message,90),quoted=compact.match(/[«"]([^»"]{2,60})[»"]/);
  return (quoted?.[1]||compact||'موظف جديد').replace(/[.؟?!]+$/,'').slice(0,80);
}

export function employeeRequestMode(message){
  const text=clean(message,500);
  if(!/(?:موظف(?:\s+رقمي)?|فلو|تدفق)/i.test(text))return 'none';
  return /(?:أنشئ|انشئ|إنشاء|انشاء|جه[ّ]?ز|ابنِ?|ابدأ|اعتمد|سو[ِّ]?(?:ي)?)/i.test(text)?'create':'explore';
}

export function wantsEmployeeExecution(message){
  const value=clean(message,500);
  if(/[؟?]/.test(value)||/(?:^|\s)(?:وش|ماذا|ما|هل|كم|متى|كيف|وين|أين)(?:\s|$)/.test(value)||/^(?:لا|بدون|ممنوع)(?:\s|$)/.test(value))return false;
  return /(?:أرسل|ارسل|انشر|نف[ّ]?ذ|شغ[ّ]?ل|حد[ّ]?ث|سج[ّ]?ل|احجز|ألغ|الغ|اربط|افصل|أنشئ|انشئ|راسل|اتصل)/i.test(value);
}

export function conversationMemory(history){
  const signals=/(?:^|\s)(?:لا|بدون|ممنوع|فقط|أريد|اريد|أبغى|ابغى|هدفي|الهدف|اختصر|فصّل|فصل|انتظر|لازم|يجب)(?:\s|$)/i;
  const remembered=[];
  for(const item of history||[]){
    if(item?.role!=='user'||typeof item.content!=='string')continue;
    for(const part of item.content.split(/[\n.!؟!]+/)){
      const value=clean(part,400);
      if(value&&signals.test(value)&&!remembered.includes(value))remembered.push(value);
    }
  }
  return remembered.slice(-16).join('\n').slice(0,3500);
}
