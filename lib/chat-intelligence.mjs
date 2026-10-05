function clean(value,limit=500){return String(value||'').replace(/\s+/g,' ').trim().slice(0,limit);}

export function flowName(message){
  const compact=clean(message,90),quoted=compact.match(/[«"]([^»"]{2,60})[»"]/);
  return (quoted?.[1]||compact||'موظف جديد').replace(/[.؟?!]+$/,'').slice(0,80);
}

export function builtFlowResult(result){
  if(result?.isError===true)return null;
  const candidates=[result?.structuredContent];
  for(const item of result?.content||[])if(item?.type==='text'&&typeof item.text==='string'){
    try{candidates.push(JSON.parse(item.text));}catch{}
  }
  const ids=[...new Set(candidates.map(item=>item?.flowId).filter(id=>/^[0-9A-Za-z]{21}$/.test(String(id||''))))];
  if(ids.length!==1)return null;
  const details=candidates.find(item=>item?.flowId===ids[0])||{};
  return {flowId:ids[0],incomplete:['invalidSteps','skippedSteps','unknownProps'].some(key=>!Array.isArray(details[key])||details[key].length>0)};
}

export function hasActiveFlowConnections(required,result){
  if(!Array.isArray(required)||required.some(id=>typeof id!=='string'||!id))return false;
  if(!required.length)return true;
  const inventory=result?.structuredContent;
  if(result?.isError===true||!Array.isArray(inventory?.connections)||inventory.count!==inventory.connections.length||inventory.count>=200)return false;
  const active=new Set(inventory.connections.filter(item=>item?.scope==='PROJECT'&&item.status==='ACTIVE'&&typeof item.externalId==='string').map(item=>item.externalId));
  return required.every(id=>active.has(id));
}

export function employeeRequestMode(message){
  const text=clean(message,500);
  if(!/(?:موظف(?:\s+رقمي)?|فلو|تدفق)/i.test(text))return 'none';
  return /(?:أنشئ|انشئ|إنشاء|انشاء|جه[ّ]?ز|ابنِ?|ابدأ|اعتمد|سو[ِّ]?(?:ي)?)/i.test(text)?'create':'explore';
}

export function explicitNewEmployee(message){
  return /(?:أنشئ|انشئ|إنشاء|انشاء)\s+(?:لي\s+)?موظف(?:\s+رقمي)?(?:\s|$)/i.test(clean(message,500))||/موظف(?:\s+رقمي)?\s+جديد/i.test(clean(message,500));
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
