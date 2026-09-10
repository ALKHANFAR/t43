import assert from'node:assert/strict';import{validateChatRoute455,designWorkView455,routeChat455}from'./chat-routing.mjs';
const cases=[];function test(name,fn){fn();cases.push(name);}
const route={intent:'conversation',reply:'أهلًا بك',fact_updates:[]};
test('Greeting route remains conversation',()=>assert.equal(validateChatRoute455(route,'هلا').intent,'conversation'));
test('Unknown intent rejected',()=>assert.throws(()=>validateChatRoute455({...route,intent:'send_ads'},'هلا')));
test('Correction without facts rejected',()=>assert.throws(()=>validateChatRoute455({...route,intent:'company_update'},'سعرنا 50')));
const fact={key:'service.price',topic:'pricing',value:'50 ريال',evidence_quote:'سعر خدمتنا 50 ريال'};
test('User-grounded correction accepted',()=>assert.equal(validateChatRoute455({...route,intent:'company_update',fact_updates:[fact]},'سعر خدمتنا 50 ريال').fact_updates.length,1));
test('Fabricated correction rejected',()=>assert.throws(()=>validateChatRoute455({...route,fact_updates:[{...fact,value:'100 ريال'}]},'سعر خدمتنا 50 ريال')));
test('Unsupported company permission field rejected',()=>assert.throws(()=>validateChatRoute455({...route,fact_updates:[{...fact,topic:'admin_access'}]},'سعر خدمتنا 50 ريال')));
test('Answered chat returns saved reply',()=>assert.deepEqual(designWorkView455({state:'answered',data:{reply:'تم الحفظ'}}),{status:'succeeded',reply:'تم الحفظ'}));
test('Ready status without readback proof rejected',()=>assert.throws(()=>designWorkView455({state:'awaiting_connections',data:{plan:{name:'موظف'}}})));
test('Enabled draft cannot pass connection-deferred readiness',()=>assert.throws(()=>designWorkView455({state:'awaiting_connections',data:{built:{structureVerified:true,status:'ENABLED',flowId:'x'},plan:{name:'موظف'}}})));
test('Verified disabled draft can report internal construction success',()=>assert.equal(designWorkView455({state:'awaiting_connections',data:{built:{structureVerified:true,status:'DISABLED',flowId:'x'},plan:{name:'موظف'}}}).status,'succeeded'));
test('Missing capabilities remain awaiting input',()=>assert.equal(designWorkView455({state:'needs_configuration',data:{plan:{missing:['قدرة غير موجودة']}}}).status,'awaiting_input'));
test('Concurrent chat results name their original goal',()=>assert.ok(designWorkView455({state:'planning',data:{from_chat:true,intent:'build_employee',goal:'زد مبيعاتي'}}).reply.startsWith('بخصوص «زد مبيعاتي»')));
let count=0;const result=await routeChat455({message:'هلا',companyContext:{},call:async(name,args)=>{count++;assert.equal(name,'ap_run_action');assert.equal(args.actionName,'extractStructuredData');assert.ok(!JSON.stringify(args.input).includes('{{'));return{content:[{type:'text',text:'✅ Result\n\n'+JSON.stringify(route)}]};}});
test('Routing uses one structured AI call and no build or send actions',()=>{assert.equal(count,1);assert.equal(result.intent,'conversation');});
console.log(JSON.stringify({passed:cases.length,cases},null,2));
