function clean(value,limit=500){return String(value||'').replace(/\s+/g,' ').trim().slice(0,limit);}

const REQUEST_LEAD=/^(?:(?:لو سمحت|من فضلك|رجاء[ًا]?|أريد|اريد|أبغى|ابغى|أبي|ابي|أنشئ|انشئ|إنشاء|انشاء|جه[ّ]?ز|ابنِ?|ابدأ|اعتمد|سو[ِّ]?ي?|لي|الآن|الان)\s+)+/i;

// The employee's name: the quoted one when the user gave it, otherwise the request without its
// command words. The whole sentence is never used as a name.
export function flowName(message){
  const quoted=clean(message,200).match(/[«"]([^»"]{2,60})[»"]/)?.[1]?.trim();
  if(quoted)return quoted.replace(/[.؟?!]+$/,'').slice(0,80);
  const stripped=clean(message,90).replace(REQUEST_LEAD,'').replace(/[.؟?!]+$/,'').trim();
  return (stripped||'موظف جديد').slice(0,80);
}

export function draftOnlyIntent(message){
  const request=String(message||'').normalize('NFKC').replace(/[\u064B-\u065F]/g,'');
  return /(?:مسودة\s*فقط|بدون\s+(?:تشغيل|تفعيل|نشر)|(?:لا|ولا)\s+(?:تنشر|تنشروه|تفعل|تشغل)|غير\s+منشور|draft\s+only|do\s+not\s+(?:activate|publish|run)|leave\s+(?:it\s+)?(?:draft|disabled))/i.test(request)
    || /\bDRAFT\b/i.test(request)&&/\bDISABLED\b/i.test(request);
}

export function doNotRunIntent(message){
  const request=String(message||'').normalize('NFKC').replace(/[\u064B-\u065F]/g,'')
    .replace(/(?:لا|ولا)\s+(?:تشغل(?:ه|ها)?|تنفذ(?:ه|ها)?)\s+(?:أكثر|اكثر)\s+من\s+(?:مرة(?:\s+واحدة)?|مره(?:\s+واحده)?)/g,'');
  return /(?:بدون\s+(?:تشغيل|تنفيذ)|(?:لا|ولا)\s+(?:تشغل|تشغله|تنفذ|تنفذه)|(?:لا|ولا)[^.!؟\n]{0,60}(?:أو|و)\s+تشغل|do\s+not\s+(?:run|execute)|without\s+(?:running|executing))/i.test(request);
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

export function createdTableReadback(created,listed){
  if(created?.isError===true||listed?.isError===true)return null;
  const table=created?.structuredContent,inventory=listed?.structuredContent;
  if(!/^[0-9A-Za-z]{21}$/.test(String(table?.id||''))||!/^[0-9A-Za-z]{21}$/.test(String(table?.externalId||''))||typeof table?.name!=='string'||!table.name.trim())return null;
  if(!Array.isArray(inventory?.tables)||!Number.isInteger(inventory.count)||inventory.count!==inventory.tables.length||inventory.count>=100)return null;
  const matches=inventory.tables.filter(item=>item?.id===table.id&&item.externalId===table.externalId&&item.name===table.name);
  return matches.length===1?{id:table.id,externalId:table.externalId,name:table.name}:null;
}

export function hasActiveFlowConnections(required,result){
  if(!Array.isArray(required)||required.some(id=>typeof id!=='string'||!id))return false;
  if(!required.length)return true;
  const inventory=result?.structuredContent;
  if(result?.isError===true||!Array.isArray(inventory?.connections)||inventory.count!==inventory.connections.length||inventory.count>=200)return false;
  const active=new Set(inventory.connections.filter(item=>item?.scope==='PROJECT'&&item.status==='ACTIVE'&&typeof item.externalId==='string').map(item=>item.externalId));
  return required.every(id=>active.has(id));
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


// Project only literal AI task text from the native published graph, never full settings/auth.
export function publishedAIInstructionSteps(version){
  const steps=[],seen=new Set();
  const walk=step=>{
    if(!step||typeof step!=='object'||seen.has(step))return;
    seen.add(step);
    const settings=step.settings,input=settings?.input,action=settings?.actionName;
    if(step.type==='PIECE'&&settings?.pieceName==='@activepieces/piece-ai'&&['askAi','run_agent'].includes(action)&&typeof input?.prompt==='string')steps.push({name:step.name,piece_name:settings.pieceName,action_name:action,prompt:input.prompt,...(action==='run_agent'?{prompt_scope:'task_input',...(input.agentId?{agent_instructions_unverified:true}:{})}:{})});
    walk(step.firstLoopAction);for(const child of step.children||[])walk(child);
    for(const branch of ['onSuccess','onFailure'])walk(step.continueOnFailureBranches?.[branch]);
    walk(step.nextAction);
  };
  walk(version?.trigger);
  return steps;
}

// Structural readback of the owned native snapshot, not an execution plan or run proof.
// Never copy input, conditions, connection references, source code or sample data.
export function publishedFlowWorkSteps(version){
  const steps=[],seen=new Set(),names=new Set(),pending=version?.trigger?[{step:version.trigger,parent:null,path:[]}]:[];
  let complete=Boolean(version?.trigger);
  while(pending.length){
    const {step,parent,path}=pending.pop();
    if(!step||typeof step!=='object'||Array.isArray(step)){complete=false;continue;}
    if(seen.has(step)||steps.length>=500){complete=false;continue;}
    seen.add(step);
    const type=typeof step.type==='string'?step.type:'UNKNOWN';
    const kind=({PIECE_TRIGGER:'trigger',EMPTY:'trigger',PIECE:'action',ROUTER:'decision',AI_ROUTER:'decision',LOOP_ON_ITEMS:'loop',CODE:'code'})[type]||'unknown';
    const name=typeof step.name==='string'?step.name:'';
    if(!name||names.has(name)||kind==='unknown')complete=false;
    names.add(name);
    const row={name,display_name:typeof step.displayName==='string'?step.displayName:name,type,kind,parent_name:parent,path};
    if(typeof step.valid==='boolean')row.valid=step.valid;
    if(typeof step.skip==='boolean')row.skipped=step.skip;
    if(type==='PIECE'||type==='PIECE_TRIGGER'){
      for(const [source,target] of [['pieceName','piece_name'],['actionName','action_name'],['triggerName','trigger_name']]){
        if(typeof step.settings?.[source]==='string')row[target]=step.settings[source];
      }
    }
    steps.push(row);
    if(step.nextAction)pending.push({step:step.nextAction,parent:name,path});
    if(type==='PIECE'||type==='CODE')for(const branch of ['onFailure','onSuccess']){
      if(step.continueOnFailureBranches?.[branch])pending.push({step:step.continueOnFailureBranches[branch],parent:name,path:[...path,{parent_name:name,kind:branch==='onSuccess'?'success':'failure'}]});
    }
    if(type==='ROUTER'||type==='AI_ROUTER'){
      if(!Array.isArray(step.children)){complete=false;continue;}
      for(let index=step.children.length-1;index>=0;index--)if(step.children[index])pending.push({step:step.children[index],parent:name,path:[...path,{parent_name:name,kind:'branch',index}]});
    }
    if(type==='LOOP_ON_ITEMS'&&step.firstLoopAction)pending.push({step:step.firstLoopAction,parent:name,path:[...path,{parent_name:name,kind:'loop'}]});
  }
  return {steps,complete};
}
