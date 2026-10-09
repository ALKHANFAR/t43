import test from 'node:test';
import assert from 'node:assert/strict';
import {selectKnowledgeContext} from '../lib/knowledge-context.mjs';
import {createCumulativeMemory,MEMORY_TABLE,MEMORY_FIELDS,MEMORY_LIMITS} from '../lib/cumulative-memory.mjs';
const TABLE='T'.repeat(21),OTHER='O'.repeat(21);
const tools=['ap_list_tables','ap_find_records','ap_insert_records','ap_update_record','ap_delete_records','ap_create_table'].map(name=>({name}));
const fields=MEMORY_FIELDS.map(name=>({name,type:'TEXT'}));
const base={scope:'company',owner:'company-a',key:'pricing',value:'99',source_quote:'سعرنا 99',source_request:'old',updated_at:'2026-10-07T10:00:00Z'};
function harness({rows=[],configured=true,ignoreFilters=false,readbackFailure=false}={}){
  let records=structuredClone(rows),serial=1,exists=configured;const calls=[];
  const mcp={call:async(company,method,{name,arguments:args})=>{
    calls.push({company,name,args});assert.equal(company,'company-a');assert.equal(method,'tools/call');
    if(name==='ap_list_tables')return {structuredContent:{tables:exists?[{id:TABLE,name:MEMORY_TABLE,fields,rowCount:records.length}]:[],count:exists?1:0}};
    if(name==='ap_find_records'){const selected=records.filter(row=>ignoreFilters||!(args.filters||[]).some(f=>row.cells[f.fieldName]!==f.value)).slice(0,args.limit);return {structuredContent:{records:selected,count:selected.length}};}
    if(name==='ap_create_table'){exists=true;return {content:[{type:'text',text:'created'}]};}
    if(name==='ap_insert_records'){if(!readbackFailure)for(const cells of args.records)records.push({id:String(serial++).padStart(21,'0'),cells});return {content:[{type:'text',text:'inserted'}]};}
    if(name==='ap_update_record'){if(!readbackFailure)Object.assign(records.find(row=>row.id===args.recordId).cells,args.fields);return {content:[{type:'text',text:'updated'}]};}
    if(name==='ap_delete_records'){assert.equal(args.tableId,TABLE);records=records.filter(row=>!args.recordIds.includes(row.id));return {};}
    throw Error(name);
  }};
  const service=createCumulativeMemory({mcp,companyId:'company-a',userId:'user-a',employeeId:'employee-a',requestId:'current',message:'سعرنا 99 ثم سعرنا 100 وأفضل الاختصار',tools});
  return {service,calls,records:()=>records};
}
const row=(id,cells)=>({id,cells:{...base,...cells}});
test('native memory deletion is intercepted by table even for foreign records while business tables remain native',async()=>{
  const h=harness({rows:[row(OTHER,{scope:'employee',owner:'employee-b'})]});await h.service.load();
  const args={tableId:TABLE,recordIds:[OTHER]};
  assert.equal(h.service.handles('ap_delete_records',args),true);
  await assert.rejects(()=>h.service.mutate('ap_delete_records',args),{code:'memory_unverified'});
  assert.equal(h.calls.some(c=>c.name==='ap_delete_records'),false);
  assert.equal(h.service.handles('ap_delete_records',{tableId:'B'.repeat(21),recordIds:['C'.repeat(21)]}),false);
});
test('both chat scopes share company knowledge while user and employee memories remain isolated',async()=>{
  const rows=[row('A'.repeat(21),{}),row('B'.repeat(21),{scope:'user',owner:'user-a',key:'tone'}),row('C'.repeat(21),{scope:'user',owner:'user-b',key:'private'}),row('D'.repeat(21),{scope:'employee',owner:'employee-a',key:'goal'}),row('E'.repeat(21),{scope:'employee',owner:'employee-b',key:'other'})];
  const h=harness({rows});assert.deepEqual((await h.service.load()).facts.map(f=>f.key),['pricing','tone','goal']);
  const scoped=h.service.scopeResult({structuredContent:{records:rows,count:rows.length}});
  assert.deepEqual(scoped.structuredContent.records.map(r=>r.id),['A'.repeat(21),'B'.repeat(21),'D'.repeat(21)]);
});
test('repeating a fact is a no-op and correcting its key updates the original record',async()=>{
  const h=harness({rows:[row(OTHER,{})]});await h.service.load();
  const args={tableId:TABLE,records:[{scope:'company',owner:'forged',key:' PRICING ',value:'99',source_quote:'سعرنا 99'}]};
  assert.equal((await h.service.mutate('ap_insert_records',args)).structuredContent.operation,'noop');
  args.records[0].value='100';args.records[0].source_quote='سعرنا 100';
  assert.equal((await h.service.mutate('ap_insert_records',args)).structuredContent.operation,'update');
  assert.equal(h.records().length,1);assert.equal(h.records()[0].cells.owner,'company-a');assert.equal(h.records()[0].cells.source_request,'current');assert.equal(h.records()[0].cells.value,'100');
  assert.equal(h.calls.some(c=>c.name==='ap_insert_records'),false);
});
test('storage cap rejects growth but still permits updating an existing fact',async()=>{
  const rows=Array.from({length:MEMORY_LIMITS.records},(_,i)=>row(String(i).padStart(21,'0'),{key:'fact '+i}));
  const h=harness({rows});await h.service.load();
  await assert.rejects(()=>h.service.mutate('ap_insert_records',{tableId:TABLE,records:[{scope:'company',key:'new',value:'100',source_quote:'سعرنا 100'}]}),{code:'memory_budget_full'});
  assert.equal(h.calls.some(c=>c.name==='ap_insert_records'),false);
  await h.service.mutate('ap_insert_records',{tableId:TABLE,records:[{scope:'company',key:'fact 0',value:'100',source_quote:'سعرنا 100'}]});assert.equal(h.records().length,MEMORY_LIMITS.records);
});
test('task restrictions, invented sources, oversized values and another employee cannot be persisted',async()=>{
  const h=harness({rows:[row(OTHER,{scope:'employee',owner:'employee-b'})]});await h.service.load();
  for(const candidate of [{scope:'task',key:'rule',value:'لا تنشر',source_quote:'سعرنا 99'},{scope:'company',key:'rule',value:'100',source_quote:'not in user message'},{scope:'company',key:'rule',value:'x'.repeat(513),source_quote:'سعرنا 99'}])await assert.rejects(()=>h.service.mutate('ap_insert_records',{tableId:TABLE,records:[candidate]}),{code:'memory_unverified'});
  await assert.rejects(()=>h.service.mutate('ap_update_record',{tableId:TABLE,recordId:OTHER,fields:{value:'100',source_quote:'سعرنا 100'}}),{code:'memory_unverified'});
  assert.equal(h.calls.some(c=>['ap_insert_records','ap_update_record'].includes(c.name)),false);
});
test('saved is returned only after independent readback verifies every server-owned field',async()=>{
  const h=harness({readbackFailure:true});await h.service.load();
  await assert.rejects(()=>h.service.mutate('ap_insert_records',{tableId:TABLE,records:[{scope:'company',key:'pricing',value:'100',source_quote:'سعرنا 100'}]}),{code:'memory_unverified'});
});
test('unknown or over-budget inventories fail closed and cumulative context has a separate cap',async()=>{
  const many=Array.from({length:129},(_,i)=>row(String(i).padStart(21,'0'),{key:'fact '+i}));await assert.rejects(()=>harness({rows:many}).service.load(),{code:'memory_unverified'});
  const bad=harness({ignoreFilters:true,rows:[row(OTHER,{scope:'task'})]});await assert.rejects(bad.service.load,{code:'memory_unverified'});
  const h=harness({rows:many.slice(0,128).map(r=>({...r,cells:{...r.cells,value:'x'.repeat(512)}}))});const loaded=await h.service.load();
  assert.ok(loaded.facts.reduce((sum,fact)=>sum+JSON.stringify(fact).length,0)<=MEMORY_LIMITS.contextChars);assert.ok(loaded.facts.length<128);
});
test('native table setup is verified, reuses existing table and never mutates its schema',async()=>{
  const h=harness({configured:false});assert.equal((await h.service.load()).configured,false);
  await h.service.mutate('ap_create_table',{name:MEMORY_TABLE,fields});await h.service.mutate('ap_create_table',{name:MEMORY_TABLE,fields});
  assert.equal(h.calls.filter(c=>c.name==='ap_create_table').length,1);
  await assert.rejects(()=>h.service.mutate('ap_delete_table',{tableId:TABLE}),{code:'memory_unverified'});
  assert.equal(h.calls.some(c=>c.name==='ap_delete_table'),false);
});
test('forget removes only accessible memories and verifies deletion',async()=>{
  const h=harness({rows:[row('A'.repeat(21),{}),row(OTHER,{scope:'user',owner:'user-b'})]});await h.service.load();
  await assert.rejects(()=>h.service.mutate('ap_delete_records',{recordIds:[OTHER]}),{code:'memory_unverified'});
  await h.service.mutate('ap_delete_records',{recordIds:['A'.repeat(21)]});assert.equal(h.records().length,1);
});

test('hundreds of employees retain independent budgets without scanning the whole company',async()=>{
  const rows=Array.from({length:3000},(_,i)=>row(String(i).padStart(21,'0'),{scope:'employee',owner:'employee-'+Math.floor(i/10),key:'fact '+i}));
  rows.push(row(OTHER,{scope:'employee',owner:'employee-a',key:'my fact'}));
  const h=harness({rows});assert.deepEqual((await h.service.load()).facts.map(f=>f.key),['my fact']);
  assert.equal(h.calls.filter(c=>c.name==='ap_find_records').length,3);
  assert.ok(h.calls.filter(c=>c.name==='ap_find_records').every(c=>c.args.filters.length===2));
  await h.service.mutate('ap_insert_records',{tableId:TABLE,records:[{scope:'employee',key:'pricing',value:'100',source_quote:'سعرنا 100'}]});
  assert.equal(h.records().length,3002);
});
test('a full shared budget cannot starve employee learning',async()=>{
  const h=harness({rows:Array.from({length:128},(_,i)=>row(String(i).padStart(21,'0'),{key:'shared '+i}))});await h.service.load();
  await h.service.mutate('ap_insert_records',{tableId:TABLE,records:[{scope:'employee',key:'pricing',value:'100',source_quote:'سعرنا 100'}]});assert.equal(h.records().length,129);
});
test('provider ignoring scope filters fails closed',async()=>{
  await assert.rejects(()=>harness({ignoreFilters:true,rows:[row(OTHER,{scope:'employee',owner:'employee-b'})]}).service.load(),{code:'memory_unverified'});
});
test('older relevant facts rank before recent unrelated facts within the context budget',async()=>{
  const rows=Array.from({length:128},(_,i)=>row(String(i).padStart(21,'0'),{key:i===0?'سعرنا':'unrelated '+i,value:i===0?'100':'x'.repeat(512),updated_at:i===0?'2020-01-01T00:00:00Z':base.updated_at}));
  const facts=(await harness({rows}).service.load()).facts;assert.equal(facts[0].key,'سعرنا');
});

test('text retrieval normalizes Arabic marks, keeps evidence whole and uses employee topics only for ties',()=>{
  const facts=[{key:'عام',topic:'support',value:'سياسة الدعم',source:'support-source'},{key:'السعر',topic:'pricing',value:'السِّعْر 199',source:'pricing-source'}];
  assert.equal(selectKnowledgeContext(facts,{message:'السعر',topics:['support']})[0].source,'pricing-source');
  assert.equal(selectKnowledgeContext(facts,{message:'',topics:['support']})[0].source,'support-source');
  const large={key:'السعر',value:'x'.repeat(6001)},small={key:'السعر',value:'199',source:'whole-source'};
  assert.deepEqual(selectKnowledgeContext([large,small],{message:'السعر',maxChars:100}),[small]);
  assert.deepEqual(selectKnowledgeContext(facts,{maxFacts:0}),[]);
});


test('native memory readback budgets the complete serialized array including separators',async()=>{
  const rows=Array.from({length:10},(_,i)=>{
    const item=row(String(i).padStart(21,'0'),{key:'fact '+i,value:''});
    item.cells.value='x'.repeat(600-JSON.stringify(item).length);
    assert.equal(JSON.stringify(item).length,600);
    assert.ok(item.cells.value.length<=MEMORY_LIMITS.valueChars);
    return item;
  });
  const h=harness({rows});await h.service.load();
  const result=h.service.scopeResult({structuredContent:{records:rows,count:rows.length}});
  assert.ok(result.content[0].text.length<=MEMORY_LIMITS.contextChars);
  assert.deepEqual(JSON.parse(result.content[0].text),result.structuredContent.records);
  assert.equal(result.structuredContent.records.length,9);
});
