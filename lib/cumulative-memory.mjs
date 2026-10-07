import {TenantProjectError} from './tenant-projects.mjs';

export const MEMORY_TABLE='Siyadah Memory v1';
export const MEMORY_FIELDS=['scope','owner','key','value','source_quote','source_request','updated_at'];
export const MEMORY_LIMITS=Object.freeze({records:128,totalRecords:65536,valueChars:512,quoteChars:512,contextChars:6000});
const ID=/^[A-Za-z0-9]{21}$/;
const NATIVE=['ap_list_tables','ap_find_records','ap_insert_records','ap_update_record','ap_delete_records'];
const fail=()=>{throw new TenantProjectError('memory_unverified','تعذّر تأكيد الذاكرة؛ لا تعتبر المعلومة محفوظة.',409);};
const tokens=value=>new Set(keyOf(value).replace(/[\u064B-\u065F\u0670]/g,'').match(/[\p{L}\p{N}]{2,}/gu)||[]);
const keyOf=value=>String(value||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');

// AP owns the records. This adapter enforces bounds and server-owned scopes, not tool selection.
export function createCumulativeMemory({mcp,companyId,userId=null,employeeId=null,requestId=null,message='',tools=[]}){
  let table=null,records=[];
  const available=NATIVE.every(name=>tools.some(tool=>tool.name===name));
  const owner=scope=>scope==='company'?companyId:scope==='user'?userId:scope==='employee'?employeeId:null;
  const permitted=row=>Boolean(owner(row.cells.scope))&&row.cells.owner===owner(row.cells.scope);
  const identity=cells=>JSON.stringify([cells.scope,cells.owner,keyOf(cells.key)]);
  const call=async(name,args)=>{const result=await mcp.call(companyId,'tools/call',{name,arguments:args});if(result?.isError===true)fail();return result;};
  async function load(){
    if(!available)return {available:false,facts:[]};
    const result=await call('ap_list_tables',{}),inventory=result?.structuredContent;
    if(!Array.isArray(inventory?.tables)||inventory.count!==inventory.tables.length||inventory.count>=100)fail();
    const matches=inventory.tables.filter(item=>item.name===MEMORY_TABLE);
    if(matches.length>1)fail();table=matches[0]||null;records=[];
    if(!table)return {available:true,configured:false,facts:[]};
    if(!ID.test(table.id)||!Array.isArray(table.fields)||table.fields.length!==MEMORY_FIELDS.length||MEMORY_FIELDS.some(name=>table.fields.filter(field=>field.name===name&&field.type==='TEXT').length!==1))fail();
    if(!Number.isSafeInteger(table.rowCount)||table.rowCount<0||table.rowCount>MEMORY_LIMITS.totalRecords)fail();
    const found={records:[]};
    for(const scope of ['company','user','employee']){
      const scopedOwner=owner(scope);if(!scopedOwner)continue;
      const part=(await call('ap_find_records',{tableId:table.id,filters:[{fieldName:'scope',operator:'eq',value:scope},{fieldName:'owner',operator:'eq',value:scopedOwner}],limit:MEMORY_LIMITS.records+1})).structuredContent;
      if(!Array.isArray(part?.records)||part.count!==part.records.length||part.count>MEMORY_LIMITS.records||part.records.some(row=>row.cells?.scope!==scope||row.cells?.owner!==scopedOwner))fail();
      found.records.push(...part.records);
    }
    if(found.records.length>table.rowCount)fail();
    const identities=new Set();
    for(const row of found.records){
      const c=row.cells;
      if(!ID.test(String(row.id||''))||!c||!['company','user','employee'].includes(c.scope)||typeof c.owner!=='string'||!c.owner||typeof c.key!=='string'||!keyOf(c.key)||c.key.length>80||typeof c.value!=='string'||!c.value.trim()||c.value.length>MEMORY_LIMITS.valueChars||typeof c.source_quote!=='string'||!c.source_quote||c.source_quote.length>MEMORY_LIMITS.quoteChars||typeof c.source_request!=='string'||!c.source_request||!Number.isFinite(Date.parse(c.updated_at)))fail();
      const key=identity(c);if(identities.has(key))fail();identities.add(key);
    }
    records=found.records;
    const facts=[];let chars=0;
    const query=tokens(message),score=row=>[...tokens(row.cells.key+' '+row.cells.value)].filter(word=>query.has(word)).length;
    for(const row of records.filter(permitted).sort((a,b)=>score(b)-score(a)||Date.parse(b.cells.updated_at)-Date.parse(a.cells.updated_at))){
      const fact={scope:row.cells.scope,key:row.cells.key,value:row.cells.value,sourceQuote:row.cells.source_quote,sourceRequest:row.cells.source_request,updatedAt:row.cells.updated_at};
      const size=JSON.stringify(fact).length;if(chars+size>MEMORY_LIMITS.contextChars)continue;facts.push(fact);chars+=size;
    }
    return {available:true,configured:true,tableId:table.id,facts};
  }
  function handles(name,args){
    if(name==='ap_create_table')return args.name===MEMORY_TABLE;
    if(name==='ap_delete_records')return Array.isArray(args.recordIds)&&args.recordIds.some(id=>records.some(row=>row.id===id));
    return table&&[table.id,table.externalId].filter(Boolean).includes(args.tableId??args.input?.tableId??args.input?.table_id);
  }
  function fields(input){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!MEMORY_FIELDS.includes(key)))fail();
    const scope=input.scope,owned=owner(scope),key=keyOf(input.key),value=input.value,quote=input.source_quote;
    if(typeof input.key!=='string'||!owned||!requestId||!key||key.length>80||typeof value!=='string'||!value.trim()||value.length>MEMORY_LIMITS.valueChars||typeof quote!=='string'||!quote.trim()||quote.length>MEMORY_LIMITS.quoteChars||!String(message).includes(quote))fail();
    return {scope,owner:owned,key,value:value.trim(),source_quote:quote,source_request:requestId,updated_at:new Date().toISOString()};
  }
  async function mutate(name,args){
    // Caller holds the company's effect lock; reread before deciding insert versus update.
    if(!available)fail();
    await load();
    if(name==='ap_create_table'){
      if(table)return {content:[{type:'text',text:'Memory table already exists.'}],structuredContent:{id:table.id,memory_verified:true}};
      if(!Array.isArray(args.fields)||args.fields.length!==MEMORY_FIELDS.length||MEMORY_FIELDS.some(field=>args.fields.filter(item=>item.name===field&&item.type==='TEXT').length!==1))fail();
      await call(name,{name:MEMORY_TABLE,fields:args.fields});await load();if(!table)fail();
      return {structuredContent:{id:table.id,memory_verified:true},content:[{type:'text',text:'Memory table verified; no fact has been saved yet.'}]};
    }
    if(!table||!handles(name,args))fail();
    if(name==='ap_insert_records'||name==='ap_update_record'){
      let current=null,input;
      if(name==='ap_insert_records'){if(!Array.isArray(args.records)||args.records.length!==1)fail();input=args.records[0];}
      else{current=records.find(row=>row.id===args.recordId);if(!current||!permitted(current))fail();input={...current.cells,...args.fields};}
      const next=fields(input),matching=records.find(row=>identity(row.cells)===identity(next));
      if(current&&identity(current.cells)!==identity(next))fail();
      current=current||matching;
      if(current&&current.cells.value===next.value)return {structuredContent:{memory_verified:true,operation:'noop'},content:[{type:'text',text:'This fact is already saved.'}]};
      if(current)await call('ap_update_record',{tableId:table.id,recordId:current.id,fields:next});
      else{if(records.filter(row=>row.cells.scope===next.scope&&row.cells.owner===next.owner).length>=MEMORY_LIMITS.records||table.rowCount>=MEMORY_LIMITS.totalRecords)throw new TenantProjectError('memory_budget_full','وصلت الذاكرة إلى حدها؛ حدّث معلومة موجودة أو ادمجها بدل إضافة سجل.',409);await call('ap_insert_records',{tableId:table.id,records:[next]});}
      await load();const saved=records.find(row=>identity(row.cells)===identity(next));
      if(!saved||MEMORY_FIELDS.some(field=>saved.cells[field]!==next[field]))fail();
      return {structuredContent:{memory_verified:true,operation:current?'update':'insert'},content:[{type:'text',text:'Fact saved and independently verified.'}]};
    }
    if(name==='ap_delete_records'){
      if(!Array.isArray(args.recordIds)||!args.recordIds.length||args.recordIds.some(id=>!records.some(row=>row.id===id&&permitted(row))))fail();
      await call(name,{recordIds:args.recordIds});await load();if(records.some(row=>args.recordIds.includes(row.id)))fail();
      return {structuredContent:{memory_verified:true,operation:'delete'},content:[{type:'text',text:'Selected memories removed and verified.'}]};
    }
    fail(); // Schema/table deletion and opaque actions cannot bypass the memory budget.
  }
  function scopeResult(result){
    const data=result?.structuredContent;
    if(result?.isError===true||!Array.isArray(data?.records)||data.count!==data.records.length)fail();
    if(data.records.length>MEMORY_LIMITS.records*3)fail();
    const allowed=new Map(records.filter(permitted).map(row=>[row.id,row])),scoped=[];let chars=0;
    for(const row of data.records){
      const verified=allowed.get(row.id);if(!verified)continue;
      if(!row.cells||MEMORY_FIELDS.some(field=>row.cells[field]!==verified.cells[field]))fail();
      const size=JSON.stringify(verified).length;if(chars+size>MEMORY_LIMITS.contextChars)continue;
      scoped.push(verified);chars+=size;
    }
    return {structuredContent:{records:scoped,count:scoped.length},content:[{type:'text',text:JSON.stringify(scoped)}]};
  }
  return {load,handles,mutate,scopeResult};
}
