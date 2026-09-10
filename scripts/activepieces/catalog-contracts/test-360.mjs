import fs from 'node:fs';import assert from 'node:assert/strict';
import {validateDesign,parseDesignJSON,readDesignAiResult455,designResponseSchema455,protectDesignPrompt455} from '../employee-design/factory-design.mjs';
const goal='احفظ الطلب';const basis={source:'user_goal',quote:goal};
const contracts=[{pieceName:'source',name:'new',kind:'trigger',version:'1',props:{},outputSchema:{fields:[{key:'email'},{key:'amount'}]}},{pieceName:'sink',name:'save',kind:'action',version:'1',authRequired:true,props:{email:{type:'SHORT_TEXT',required:true},account:{type:'DROPDOWN',required:true},amount:{type:'NUMBER'},enabled:{type:'CHECKBOX'},tags:{type:'ARRAY'},mode:{type:'STATIC_DROPDOWN',options:[{value:'draft'},{value:'paused'}]}},outputSchema:{fields:[{key:'id'}]}}];
const needs=[{id:'source',required:true},{id:'save',required:true}];
const seed=()=>({original_goal:goal,name:'موظف',summary:'حفظ',trigger:{pieceName:'source',triggerName:'new',input:{},covers:['source'],reason:'استقبال',context_basis:basis},steps:[{pieceName:'sink',actionName:'save',input:{email:'{{trigger.email}}'},covers:['save'],reason:'حفظ',context_basis:basis}],bindings:[{step:'step_1',property:'account',type:'account_resource'}],missing:[],assumptions:[],evidence:[{step:'step_1',metric:'طلب محفوظ',check:'معرف السجل',output_path:'id'}]});
const results=[];function test(name,fn){try{fn();results.push({name,status:'passed'});}catch(e){results.push({name,status:'failed',error:e.message});}}
function blocked(edit){const p=seed();edit(p);let r;try{r=validateDesign(p,needs,contracts,goal);}catch{return;}assert.notEqual(r.status,'awaiting_connections');}
test('Valid connection-deferred plan accepted without claiming runtime',()=>{const p=validateDesign(seed(),needs,contracts,goal);assert.equal(p.status,'awaiting_connections');assert.equal(p.runtimeVerified,false);});
for(const [name,edit] of [
 ['Exact original goal retained',p=>p.original_goal='هدف آخر'],
 ['Unknown operation rejected',p=>p.steps[0].actionName='invented'],
 ['Unknown property rejected',p=>p.steps[0].input.secret='invented'],
 ['Current step output cannot reference itself',p=>p.steps[0].input.email='{{step_1.id}}'],
 ['Unknown future step rejected',p=>p.steps[0].input.email='{{step_9.id}}'],
 ['Trigger cannot reference own output',p=>p.trigger.input={email:'{{trigger.email}}'}],
 ['Unknown expression rejected',p=>p.steps[0].input.email='{{global.password}}'],
 ['Undeclared path rejected',p=>p.steps[0].input.email='{{trigger.unknown}}'],
 ['Template connection literals rejected',p=>p.steps[0].input.email='{{connections.gmail}}'],
 ['Placeholder values rejected',p=>p.steps[0].input.email='YOUR_EMAIL'],
 ['Missing required literal rejected',p=>delete p.steps[0].input.email],
 ['Empty required literal rejected',p=>p.steps[0].input.email=''],
 ['Whitespace-only required literal rejected',p=>p.steps[0].input.email='   '],
 ['Wrong number type rejected',p=>p.steps[0].input.amount='not-a-number'],
 ['Wrong boolean type rejected',p=>p.steps[0].input.enabled='yes'],
 ['Wrong array type rejected',p=>p.steps[0].input.tags='one,two'],
 ['Invalid static choice rejected',p=>p.steps[0].input.mode='active'],
 ['Binding wrong step rejected',p=>p.bindings[0].step='step_99'],
 ['Binding wrong piece rejected',p=>p.bindings[0].pieceName='another'],
 ['Duplicate binding rejected',p=>p.bindings.push({...p.bindings[0]})],
 ['Binding cannot overwrite configured input',p=>{p.steps[0].input.account='already-configured';}],
 ['Business value cannot be deferred as account resource',p=>{delete p.steps[0].input.email;p.bindings.push({step:'step_1',property:'email',type:'account_resource'});}],
 ['Connection binding only allowed for auth',p=>{delete p.steps[0].input.email;p.bindings.push({step:'step_1',property:'email',type:'connection'});}],
 ['Uncovered goal need blocks readiness',p=>p.steps[0].covers=[]],
 ['Invented company quote rejected',p=>p.steps[0].context_basis={source:'company_context',quote:'غير موجود'}],
 ['Undeclared assumption rejected',p=>p.steps[0].context_basis={source:'assumption',quote:'غير موجود'}],
 ['Empty proof rejected',p=>p.evidence=[]],
 ['Wrong proof step rejected',p=>p.evidence[0].step='step_99'],
 ['Unknown proof output blocks readiness',p=>p.evidence[0].output_path='revenue'],
 ['Explicit business missing blocks readiness',p=>p.missing=['الميزانية غير محددة']]
])test(name,()=>blocked(edit));
test('Literal number zero and false remain valid',()=>{const p=seed();p.steps[0].input.amount=0;p.steps[0].input.enabled=false;assert.equal(validateDesign(p,needs,contracts,goal).status,'awaiting_connections');});
test('Mapped numeric value is deferred to runtime type check',()=>{const p=seed();p.steps[0].input.amount='{{trigger.amount}}';assert.equal(validateDesign(p,needs,contracts,goal).status,'awaiting_connections');});
test('Declared assumption accepted as assumption',()=>{const p=seed();p.assumptions=['افتراض معلن'];p.steps[0].context_basis={source:'assumption',quote:'افتراض معلن'};assert.equal(validateDesign(p,needs,contracts,goal).status,'awaiting_connections');});
test('Tool failure cannot be parsed as successful AI',()=>assert.throws(()=>readDesignAiResult455({isError:true,content:[{type:'text',text:'✅ Result\n\n{}'}]})));
test('MCP string envelope unwraps once',()=>assert.deepEqual(parseDesignJSON(readDesignAiResult455({content:[{type:'text',text:'✅ Result\n\n'+JSON.stringify('{"original_goal":"x"}')}]})),{original_goal:'x'}));
test('Malformed JSON is not silently repaired by parser',()=>assert.throws(()=>parseDesignJSON('{"a": [1,2}')));
test('Structured response schema requires goal and verified plan shape',()=>{const s=designResponseSchema455('plan');assert.ok(s.required.includes('original_goal'));assert.ok(s.required.includes('evidence'));assert.equal(s.properties.steps.items.properties.input.additionalProperties,true);});
test('Future flow templates are escaped across the planner action boundary',()=>{const value={prompt:'x {{trigger.message.subject}} y',schema:{fields:{}}};const safe=protectDesignPrompt455(value);assert.ok(!safe.prompt.includes('{{'));assert.equal(JSON.parse('\"'+safe.prompt+'\"'),value.prompt);assert.equal(value.prompt,'x {{trigger.message.subject}} y');});
test('Nested JSON object braces remain unchanged in protected prompts',()=>{const value=JSON.stringify({company:{products:{name:'test'}}});assert.equal(protectDesignPrompt455(value),value);});
test('Known source id derives the original quote on the server',()=>{const p=seed();p.steps[0].context_basis={source_id:'user_goal'};const v=validateDesign(p,needs,contracts,goal);assert.equal(v.selected[1].context_basis.quote,goal);});
test('Unknown source id rejected',()=>blocked(p=>p.steps[0].context_basis={source_id:'website:99'}));
test('Multiline website evidence grounds selection by source id',()=>{const p=seed();p.steps[0].context_basis={source_id:'website:0'};const c={website:{websiteEvidence:[{text:'منتجات الشركة\nخدماتها',sourceUrl:'https://example.com/'}]}};const v=validateDesign(p,needs,contracts,goal,c);assert.equal(v.selected[1].context_basis.source,'company_context');assert.equal(v.selected[1].context_basis.quote,'منتجات الشركة\nخدماتها');});
test('Planner schema constrains operations and input keys from the actual contracts',()=>{const s=designResponseSchema455('plan',{contracts,needs});const a=s.properties.steps.items.oneOf;assert.equal(a.length,1);assert.equal(a[0].properties.pieceName.const,'sink');assert.equal(a[0].properties.actionName.const,'save');assert.equal(a[0].properties.input.additionalProperties,false);assert.deepEqual(a[0].properties.covers.items.enum,['source','save']);});
const report={at:new Date().toISOString(),scope:'Deterministic adversarial contract checks; no live intelligence or provider outcome claimed',passed:results.filter(x=>x.status==='passed').length,failed:results.filter(x=>x.status==='failed').length,results};fs.writeFileSync(new URL('test-360-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.failed)process.exitCode=1;
