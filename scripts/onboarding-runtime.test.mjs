import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('onboarding uses live company enrichment and prepares one employee safely',async()=>{
  const [html,js,server]=await Promise.all([readFile(new URL('../app/onboard.html',import.meta.url),'utf8'),readFile(new URL('../app/onboard.js',import.meta.url),'utf8'),readFile(new URL('../server.mjs',import.meta.url),'utf8')]);
  assert.match(js,/op:'enrich_company'/);
  assert.match(js,/op:'check_company_enrichment'/);
  assert.match(js,/op:'recommend_employees'/);
  assert.match(js,/op:'select_employee'/);
  assert.match(js,/SUGGESTIONS\.slice\(0,3\)/);
  assert.ok(!js.includes('pages:14'));
  assert.ok(!html.includes('وافق وشغّل'));
  assert.match(html,/موظفك جاهز للخطوة التالية/);
  assert.match(html,/لن يعمل أو يرسل شيئًا/);
  assert.match(html,/هذه بصمة شركتك الأولى/);
  assert.match(html,/ما تم تجهيزه الآن/);
  assert.match(js,/أفضل بداية/);
  assert.match(js,/حقائق مثبتة/);
  assert.match(server,/factCount:Array\.isArray\(profile\.facts\)/);
  assert.match(server,/knowledgeAreas:Array\.from/);
});
