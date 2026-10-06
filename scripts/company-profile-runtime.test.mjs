import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEmployeePrompt,createCompanyProfileService,normalizeAgentProfile,normalizeCompanyProfile,normalizeCompanySettings,recommendEmployees,selectCompanyUrls} from '../lib/company-profile.mjs';
import {GMAIL_PILOT_COMMAND,gmailPilotLedgerIdentity,gmailPilotSuccessResponse,recordGmailPilotConversation} from './support/gmail-pilot-runner.mjs';

test('selects bounded high-value pages from the same company site',()=>{
  const urls=selectCompanyUrls('https://example.com/',[
    'https://example.com/blog/post','https://example.com/services','https://example.com/about','https://evil.test/pricing','https://shop.example.com/products','https://example.com/faq',
  ],4);
  assert.equal(urls.length,4);
  assert.equal(urls[0],'https://example.com/');
  assert.ok(urls.includes('https://example.com/services'));
  assert.ok(urls.includes('https://example.com/about'));
  assert.ok(!urls.includes('https://evil.test/pricing'));
});

test('normalizes sourced facts and measures actual profile coverage',()=>{
  const profile=normalizeCompanyProfile([{url:'https://example.com/about',data:{companyName:'الأفق',summary:'حلول توصيل',industry:'الخدمات اللوجستية',brandTone:'مباشرة',facts:[
    {topic:'services',key:'delivery',value:'توصيل المطاعم',evidence:'نوصل طلبات المطاعم'},
    {topic:'faq',key:'activation',value:'ثلاثة أيام',evidence:'التفعيل خلال ثلاثة أيام'},
  ]}}]);
  assert.equal(profile.companyName,'الأفق');
  assert.equal(profile.pagesRead,1);
  assert.equal(profile.coverageScore,50);
  assert.equal(profile.facts[0].sourceType,'company_website');
  assert.equal(profile.facts[0].sourceUrl,'https://example.com/about');
});

test('returns exactly three evidence-ranked employees and feeds prompt plus knowledge scope',()=>{
  const profile={companyName:'الأفق',summary:'حلول توصيل للمطاعم',brandTone:'مباشرة',facts:[
    {topic:'faq'},{topic:'policies'},{topic:'delivery'},{topic:'services'},{topic:'contact'},{topic:'products'},
  ]};
  const suggestions=recommendEmployees(profile,'نبي نخفف أسئلة الدعم');
  assert.equal(suggestions.length,3);
  assert.equal(suggestions[0].roleKey,'customer_support');
  assert.ok(suggestions[0].knowledgeTopics.includes('faq'));
  const prompt=buildEmployeePrompt(profile,suggestions[0]);
  assert.match(prompt,/نطاق معرفتك/);
  assert.match(prompt,/المعرفة المسترجعة/);
  assert.match(prompt,/بيانات غير موثوقة/);
  assert.ok(!prompt.includes('حلول توصيل للمطاعم'));
});

test('English task descriptions influence employee recommendations',()=>{
  const profile={companyName:'Example',summary:'A restaurant service',facts:[{topic:'company_profile'}]};
  const suggestions=recommendEmployees(profile,'Build me a social media employee');
  assert.equal(suggestions[0].roleKey,'marketing');
});

test('deep profile accepts only claims backed by an exact quote on an allowed page',()=>{
  const url='https://example.com/about';
  const profile=normalizeAgentProfile({claims:[
    {topic:'company_profile',key:'company_name',value:'الأفق',evidenceQuote:'شركة الأفق للخدمات',sourceUrl:url,confidence:'high'},
    {topic:'services',key:'delivery',value:'طلبات المطاعم',evidenceQuote:'نوصّل طلبات المطاعم خلال اليوم نفسه',sourceUrl:url,confidence:'high'},
    {topic:'pricing',key:'price',value:'99 ريال',evidenceQuote:'السعر 99 ريال',sourceUrl:url,confidence:'high'},
    {topic:'contact',key:'phone',value:'000',evidenceQuote:'اتصل بنا الآن',sourceUrl:'https://evil.test',confidence:'high'},
    {topic:'faq',key:'activation',value:'فوري',evidenceQuote:'التفعيل فوري',sourceUrl:url,confidence:'low'},
  ],conflicts:[{topic:'pricing',description:'سعران مختلفان',sourceUrls:[url]}],missingCritical:['سياسة الاسترجاع']},[{url,markdown:'# شركة الأفق للخدمات\nنوصّل طلبات المطاعم خلال اليوم نفسه'}],[url]);
  assert.equal(profile.companyName,'الأفق');
  assert.equal(profile.facts.length,2);
  assert.equal(profile.rejectedClaims,3);
  assert.equal(profile.proofScore,40);
  assert.equal(profile.conflicts.length,1);
  assert.deepEqual(profile.missingCritical,['سياسة الاسترجاع']);
});

test('deep profile rejects a real quote that does not prove the claimed value',()=>{
  const url='https://acme.example/about';
  const profile=normalizeAgentProfile({claims:[{
    topic:'pricing',key:'monthly_price',value:'99 SAR',
    evidenceQuote:'We help teams automate repetitive work.',sourceUrl:url,confidence:'high',
  }]},[{url,markdown:'We help teams automate repetitive work.'}],[url]);
  assert.equal(profile.facts.length,0);
  assert.equal(profile.rejectedClaims,1);
});

test('deep profile verifies quotes after the first 1,200 page characters',()=>{
  const url='https://acme.example/services';
  const quote='خدمة العملاء متاحة طوال أيام الأسبوع';
  const profile=normalizeAgentProfile({claims:[{
    topic:'services',key:'support',value:'طوال أيام الأسبوع',evidenceQuote:quote,sourceUrl:url,confidence:'high',
  }]},[{url,markdown:'مقدمة '.repeat(220)+'\n'+quote}],[url]);
  assert.equal(profile.facts.length,1);
  assert.equal(profile.facts[0].evidenceQuote,quote);
});

test('company voice settings are bounded, deduplicated and separate from knowledge facts',()=>{
  assert.deepEqual(normalizeCompanySettings({voice:' مباشر وواضح ',language:'auto',dialect:'سعودية بيضاء',preferredWords:['أبشر','أبشر','تم'],forbiddenWords:'مستحيل، مضمون'}),{
    voice:'مباشر وواضح',language:'auto',dialect:'سعودية بيضاء',preferredWords:['أبشر','تم'],forbiddenWords:['مستحيل','مضمون'],
  });
  assert.equal(normalizeCompanySettings({language:'invalid'}).language,'ar');
});

test('knowledge and employees are always read through the owning company id',async()=>{
  const seen=[];
  const profiles={
    company_alpha:{company_id:'company_alpha',coverage_score:80,last_success_at:'2026-09-29T00:00:00Z',last_error:null},
    company_beta:{company_id:'company_beta',coverage_score:20,last_success_at:null,last_error:null},
  };
  const query=async(text,values=[])=>{
    seen.push({text,values});const companyId=values[0];
    if(text.startsWith('SELECT * FROM siyadah_company_profiles'))return {rows:profiles[companyId]?[profiles[companyId]]:[]};
    if(text.includes('FROM siyadah_company_knowledge_items'))return {rows:[{topic:'services',fact_key:`fact_${companyId}`,value_json:`value_${companyId}`,evidence_quote:'دليل',source_type:'company_website',source_url:`https://${companyId}.example`,certainty:'high',observed_at:'2026-09-29T00:00:00Z'}]};
    if(text.includes('FROM siyadah_digital_employees'))return {rows:[{id:`employee_${companyId}`,activepieces_flow_id:companyId==='company_alpha'?'F12345678901234567890':'G12345678901234567890',name:companyId==='company_alpha'?'ألف':'باء',role_title:'دعم العملاء',prompt:'تعليمات',knowledge_topics_json:['services'],knowledge_version:1,status:'draft'}]};
    throw new Error('unexpected query');
  };
  const service=createCompanyProfileService({query});
  const [alphaKnowledge,betaKnowledge,alphaEmployees,betaEmployees]=await Promise.all([
    service.ownedKnowledge('company_alpha'),service.ownedKnowledge('company_beta'),
    service.listEmployees('company_alpha'),service.listEmployees('company_beta'),
  ]);
  assert.equal(alphaKnowledge.companyId,'company_alpha');
  assert.equal(betaKnowledge.companyId,'company_beta');
  assert.equal(alphaKnowledge.facts[0].key,'fact_company_alpha');
  assert.equal(betaKnowledge.facts[0].key,'fact_company_beta');
  assert.equal(alphaEmployees[0].recordId,'employee_company_alpha');
  assert.equal(betaEmployees[0].recordId,'employee_company_beta');
  assert.notEqual(alphaEmployees[0].flowId,betaEmployees[0].flowId);
  assert.equal(seen.every(call=>call.values[0]==='company_alpha'||call.values[0]==='company_beta'),true);
  assert.equal(seen.filter(call=>call.text.includes('siyadah_company_knowledge_items')||call.text.includes('siyadah_digital_employees')).every(call=>/company_id=\$1/.test(call.text)),true);
});

test('owner instruction edits stay company-scoped and advance the stored version',async()=>{
  const calls=[];
  const query=async(text,values=[])=>{
    calls.push({text,values});
    if(text.startsWith('UPDATE siyadah_digital_employees'))return {rows:[{id:'employee_alpha'}]};
    if(text.startsWith('SELECT id,activepieces_flow_id'))return {rows:[{id:'employee_alpha',activepieces_flow_id:'F12345678901234567890',name:'سعد',role_title:'المبيعات',prompt:'تابع العملاء',prompt_source:'owner',prompt_version:2,knowledge_topics_json:[],knowledge_version:1,status:'draft',tools_json:[],updated_at:'2026-09-30T00:00:00Z'}]};
    throw new Error('unexpected query');
  };
  const service=createCompanyProfileService({query});
  const employee=await service.updateEmployeeInstructions({companyId:'company_alpha',employeeId:'employee_alpha',instructions:'تابع العملاء'});
  const update=calls[0];
  assert.match(update.text,/company_id=\$1 AND id=\$2/);
  assert.match(update.text,/prompt_source='owner'/);
  assert.match(update.text,/prompt_version=prompt_version\+1/);
  assert.deepEqual(update.values,['company_alpha','employee_alpha','تابع العملاء']);
  assert.equal(employee.instructionSource,'owner');
  assert.equal(employee.instructionVersion,2);
});

test('legacy company flows are adopted into an owned employee record before controls are shown',async()=>{
  const calls=[];
  const query=async(text,values=[])=>{
    calls.push({text,values});
    if(text.startsWith('SELECT * FROM siyadah_company_profiles'))return {rows:[{company_id:'company_alpha',knowledge_version:3}]};
    if(text.startsWith('INSERT INTO siyadah_digital_employees'))return {rows:[]};
    if(text.startsWith('SELECT id FROM siyadah_digital_employees'))return {rows:[{id:'employee_alpha'}]};
    if(text.startsWith('SELECT id,activepieces_flow_id'))return {rows:[{id:'employee_alpha',activepieces_flow_id:'F12345678901234567890',name:'موظف التسويق',role_title:'موظف',prompt:'تعليمات أولية',prompt_source:'manual_setup',prompt_version:1,knowledge_topics_json:[],knowledge_version:3,status:'draft',tools_json:[]}]};
    throw new Error('unexpected query');
  };
  const service=createCompanyProfileService({query});
  const employee=await service.adoptEmployeeFlow({companyId:'company_alpha',flow:{id:'F12345678901234567890',version:{displayName:'موظف التسويق'}}});
  assert.equal(employee.recordId,'employee_alpha');
  assert.equal(employee.instructionSource,'manual_setup');
  assert.ok(calls.some(call=>call.text.includes('ON CONFLICT (activepieces_flow_id) DO NOTHING')&&call.values[1]==='company_alpha'));
  assert.ok(calls.some(call=>call.text.includes('WHERE company_id=$1 AND activepieces_flow_id=$2')));
});

test('user correction creates a new knowledge version without deleting unrelated website facts',async()=>{
  const calls=[],profile={company_id:'company_alpha',knowledge_version:1,profile_json:{facts:[
    {id:'web-price',topic:'pricing',key:'monthly_price',value:'99 ريال',sourceType:'company_website'},
    {id:'web-service',topic:'services',key:'delivery',value:'التوصيل',sourceType:'company_website'},
  ]}};
  const query=async(text,values=[])=>{
    calls.push({text,values});
    if(text.startsWith('SELECT * FROM siyadah_company_profiles'))return {rows:[profile]};
    return {rows:[],rowCount:1};
  };
  const service=createCompanyProfileService({query});
  const result=await service.addKnowledge({companyId:'company_alpha',topic:'pricing',key:'monthly_price',value:'149 ريال'});
  assert.equal(result.knowledgeVersion,2);
  assert.equal(result.fact.value,'149 ريال');
  const profileUpdate=calls.find(call=>call.text.startsWith('UPDATE siyadah_company_profiles SET profile_json'));
  const saved=JSON.parse(profileUpdate.values[1]);
  assert.equal(saved.facts.some(fact=>fact.key==='delivery'&&fact.value==='التوصيل'),true);
  assert.equal(saved.facts.some(fact=>fact.key==='monthly_price'&&fact.value==='149 ريال'),true);
  assert.equal(saved.facts.some(fact=>fact.key==='monthly_price'&&fact.value==='99 ريال'),false);
  assert.equal(calls.some(call=>call.text.includes("status='superseded'")&&call.values[0]==='company_alpha'),true);
  assert.equal(calls.some(call=>call.text.startsWith('UPDATE siyadah_digital_employees')&&call.values[1]===2),true);
});

test('employee conversations persist idempotently inside the owning company',async()=>{
  const conversations=[],messages=[];
  const query=async(sql,values=[])=>{
    if(sql.startsWith('INSERT INTO siyadah_conversations')){
      const [company_id,id,employee_id,title]=values,current=conversations.find(row=>row.company_id===company_id&&row.id===id);
      if(current){current.employee_id=employee_id||current.employee_id;current.updated_at='2026-09-30T02:00:00Z';}else conversations.push({company_id,id,employee_id,title,updated_at:'2026-09-30T01:00:00Z'});return {rows:[]};
    }
    if(sql.startsWith('INSERT INTO siyadah_conversation_messages')){
      const [company_id,conversation_id,request_id,user,assistant]=values;
      for(const [role,content] of [['user',user],['assistant',assistant]])if(!messages.some(row=>row.company_id===company_id&&row.conversation_id===conversation_id&&row.request_id===request_id&&row.role===role))messages.push({company_id,conversation_id,request_id,role,content,created_at:'2026-09-30T01:00:00Z'});
      return {rows:[]};
    }
    if(sql.startsWith('SELECT c.id,CASE WHEN EXISTS'))return {rows:conversations.filter(row=>row.company_id===values[0])};
    if(sql.startsWith('SELECT conversation_id,role'))return {rows:messages.filter(row=>row.company_id===values[0])};
    throw new Error(`unexpected query: ${sql}`);
  };
  const service=createCompanyProfileService({query}),input={conversationId:'chat_one',employeeId:'11111111-1111-4111-8111-111111111111',requestId:'request_one',userMessage:'تابع العميل',assistantMessage:'تم التنفيذ'};
  await service.recordConversation({companyId:'company_alpha',...input});await service.recordConversation({companyId:'company_alpha',...input});
  await service.recordConversation({companyId:'company_beta',...input,conversationId:'chat_two'});
  const alpha=await service.listConversations('company_alpha'),beta=await service.listConversations('company_beta');
  assert.equal(alpha.length,1);assert.equal(alpha[0].messages.length,2);assert.equal(alpha[0].messages[0].content,'تابع العميل');assert.equal(alpha[0].messages[1].content,'تم التنفيذ');
  assert.equal(beta.length,1);assert.equal(beta[0].id,'chat_two');assert.equal(beta[0].messages.length,2);
  const pilotCompany='company_Vo6C04LfL8-hsuPAF_0y9f0N',pilotId=gmailPilotLedgerIdentity();
  const response=gmailPilotSuccessResponse({conversationId:pilotId.conversationId,receipt:{runId:'IM2FOjaApVRHWWqAf8iO2',messageId:'1a0fc1b96c6e6f55'}});
  await recordGmailPilotConversation({profiles:service,companyId:pilotCompany,response});
  await recordGmailPilotConversation({profiles:service,companyId:pilotCompany,response});
  const restored=await service.listConversations(pilotCompany);
  assert.equal(restored.length,1);assert.equal(restored[0].id,pilotId.conversationId);
  assert.deepEqual(restored[0].messages.map(message=>message.content),[GMAIL_PILOT_COMMAND,response.reply]);
  await assert.rejects(()=>recordGmailPilotConversation({profiles:service,companyId:'company_other',response}),{code:'pilot_conversation_unverified'});
});

test('reloaded main chat finds its saved draft without becoming an employee chat',async()=>{
  const calls=[];
  const employees=[{id:'11111111-1111-4111-8111-111111111111',company_id:'company_alpha',creation_request_id:'create_1',activepieces_flow_id:null,name:'موظف تسويق',status:'draft'}];
  const conversations=[
    {company_id:'company_alpha',id:'main_chat',employee_id:employees[0].id,title:'جهز موظف تسويق',updated_at:'2026-10-05T00:00:00Z'},
    {company_id:'company_alpha',id:'employee_chat',employee_id:employees[0].id,title:'تابع العملاء',updated_at:'2026-10-05T00:01:00Z'},
    {company_id:'company_beta',id:'main_chat',employee_id:null,title:'محادثة أخرى',updated_at:'2026-10-05T00:02:00Z'},
  ];
  const messages=[
    {company_id:'company_alpha',conversation_id:'main_chat',request_id:'create_1',role:'user',content:'جهز موظف تسويق',created_at:'2026-10-05T00:00:00Z'},
    {company_id:'company_alpha',conversation_id:'main_chat',request_id:'create_1',role:'assistant',content:'حُفظت مسودة',created_at:'2026-10-05T00:00:01Z'},
    {company_id:'company_alpha',conversation_id:'employee_chat',request_id:'talk_1',role:'user',content:'تابع العملاء',created_at:'2026-10-05T00:01:00Z'},
  ];
  const hasDraftMessage=(companyId,conversationId)=>employees.some(employee=>employee.company_id===companyId&&messages.some(message=>message.company_id===companyId&&message.conversation_id===conversationId&&message.request_id===employee.creation_request_id&&message.role==='user'));
  const query=async(sql,values=[])=>{
    calls.push({sql,values});
    if(sql.startsWith('SELECT e.id FROM siyadah_digital_employees e')){
      const [companyId,conversationId]=values;
      const employee=employees.find(row=>row.company_id===companyId&&hasDraftMessage(companyId,conversationId));
      return {rows:employee?[{id:employee.id}]:[]};
    }
    if(sql.startsWith('SELECT id,company_id,activepieces_flow_id'))return {rows:employees.filter(row=>row.company_id===values[0]&&row.id===values[1])};
    if(sql.startsWith('SELECT c.id,CASE WHEN EXISTS'))return {rows:conversations.filter(row=>row.company_id===values[0]).map(row=>({...row,employee_id:hasDraftMessage(row.company_id,row.id)?null:row.employee_id}))};
    if(sql.startsWith('SELECT conversation_id,role'))return {rows:messages.filter(row=>row.company_id===values[0])};
    throw new Error(`unexpected query: ${sql}`);
  };
  const service=createCompanyProfileService({query});
  const draft=await service.findConversationDraft('company_alpha','main_chat');
  assert.equal(draft?.id,employees[0].id);
  assert.equal(await service.findConversationDraft('company_alpha','employee_chat'),null);
  assert.equal(await service.findConversationDraft('company_beta','main_chat'),null);
  const restored=await service.listConversations('company_alpha');
  assert.equal(restored.find(item=>item.id==='main_chat').employee_id,null);
  assert.equal(restored.find(item=>item.id==='employee_chat').employee_id,employees[0].id);
  assert.equal(restored.find(item=>item.id==='main_chat').messages.length,2);
  assert.equal((await service.listConversations('company_beta'))[0].employee_id,null);
  assert.ok(calls.filter(call=>call.sql.includes('siyadah_conversation_messages m')).every(call=>call.sql.includes('m.company_id=e.company_id')&&call.sql.includes('m.request_id=e.creation_request_id')));
  assert.ok(calls.every(call=>call.values[0]==='company_alpha'||call.values[0]==='company_beta'));
});
