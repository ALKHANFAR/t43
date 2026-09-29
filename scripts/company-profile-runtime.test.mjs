import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEmployeePrompt,normalizeAgentProfile,normalizeCompanyProfile,recommendEmployees,selectCompanyUrls} from '../lib/company-profile.mjs';

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
