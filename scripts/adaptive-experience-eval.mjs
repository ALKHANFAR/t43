import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {evaluateKnowledgeCase} from './knowledge-quality-eval.mjs';
import ReplyView from '../app/reply-view.js';
import {measureJourney} from '../lib/journey-cost.mjs';

// Real production model loop; AP remains explicitly synthetic/read-only.
// This evaluates model presentation, never claims creation of a live employee or provider execution.
export const EXPERIENCE_CASES=[
  ['simple_ar','كم مدة الاسترجاع؟ أجب باختصار.'],
  ['simple_en','How long is the refund period? Keep it short.'],
  ['sales_plan','أبغى موظف مبيعات يتابع العملاء ويجهز عروض الأسعار. اعرض خطة للمراجعة فقط.'],
  ['sales_plan_en','Plan a sales employee that follows up leads and prepares quotes. Review only.'],
  ['tone','سمّه راشد وخله سعودي طبيعي ومهني؛ اقترح تعديل التعليمات فقط.'],
  ['tone_en','Suggest changing the employee tone to concise professional English.'],
  ['tools','اقترح الأدوات المناسبة للمتابعة دون ربطها أو تنفيذها، ووضح ما يحتاج اكتشافًا.'],
  ['tools_en','Compare email and a CRM for sales follow-up. Do not assume connected tools.'],
  ['missing','جهز خطة عرض سعر؛ إذا تنقصك معلومة اسأل عن الناقص فقط.'],
  ['known','كم الخصم المسموح؟ استخدم سياسة الشركة دون أن تسألني مجددًا.'],
  ['simplify','خل خطة موظف المبيعات أبسط مع إبقاء سياسة الخصم والموافقة.'],
  ['simplify_en','Make the sales plan simpler while keeping approval and pricing facts.'],
  ['optional','هل فيه إضافة مفيدة لهذا الموظف؟ اقترح واحدة فقط ولا توسع طلبي تلقائيًا.'],
  ['reject','لا أريد متابعة غير المستجيبين؛ ابق على تجهيز العرض فقط.'],
  ['table','قارن متابعة العملاء بالإيميل وCRM في جدول مختصر.'],
  ['free_edit','أريد تعديل أي جزء بحرية: الأدوات والأسلوب والخطوات، بدون خيارات مغلقة.'],
  ['draft_only','مسودة فقط؛ لا نشر ولا تشغيل ولا إرسال. ماذا بقي حتى يصبح الموظف جاهزًا؟'],
  ['old_test','لم نختبر النسخة الحالية. وضح ما يلزم قبل نشرها دون أن تنشر الآن.'],
  ['failure','فشل اتصال الإيميل ولم يثبت الإرسال؛ كيف تشرح الحالة وتقترح الاستكمال دون إعادة إرسال؟'],
  ['scope','موظف آخر في شركة أخرى لديه سياسة أسعار. لا تستخدم بياناته؛ اطلب ما ينقصنا فقط.']
].map(([id,question])=>({id,question,facts:[
  {key:'refund',topic:'policies',value:'الاسترجاع خلال 14 يومًا. Refund within 14 days.',certainty:'user_confirmed'},
  {key:'discount',topic:'pricing',value:'الخصم يحتاج موافقة المدير. Discounts require manager approval.',certainty:'user_confirmed'}
],evidence:[],includeReply:true,maxModelCalls:2,deadlineMs:60_000,
  answerFormat:'للقراءة فقط. تعامل مع الطلب طبيعيًا واختر النص أو عقد العرض الاختياري عند فائدته. اقترح ولا تنفذ؛ لا تفترض وجود أدوات مربوطة أو نتيجة تشغيل.',
  scoreAnswer:reply=>({evidence:'presentation_observation_only',nonempty:typeof reply==='string'&&Boolean(reply.trim()),format:ReplyView.parse(reply)?'validated_ui':ReplyView.fallback(reply)?'safe_text_fallback':'text',human_review_required:true})}));

export async function evaluateExperience({live=false,apiKey=process.env.DEEPSEEK_API_KEY||'',fetchImpl=fetch,price=null,cases=EXPERIENCE_CASES}={}){
  if(!live)return {mode:'prepared_not_run',modelCasesRun:0,quality_verified:false,cases:cases.map(({id,question})=>({id,question})),chats:['main','employee']};
  if(!apiKey)return {mode:'live_unavailable',reason:'missing_model_key',modelCasesRun:0,quality_verified:false};
  const results=[];
  for(const testCase of cases)for(const chat of ['main','employee']){
    try{const result=await evaluateKnowledgeCase({testCase,chat,live:true,apiKey,fetchImpl});results.push({...result,cost:measureJourney(result.usage,price)});}
    catch{return {mode:'live_incomplete',reason:'model_evaluation_failed',modelCasesRun:results.length,quality_verified:false,results};}
  }
  return {mode:'live_model_synthetic_AP',modelCasesRun:results.length,quality_verified:false,human_review_required:true,provider_execution_verified:false,results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2);if(args.some(a=>a!=='--live'&&!a.startsWith('--prices='))||args.filter(a=>a==='--live').length>1||args.filter(a=>a.startsWith('--prices=')).length>1)throw new Error('Usage: node scripts/adaptive-experience-eval.mjs [--live] [--prices=reviewed-prices.json]');
  const prices=args.find(a=>a.startsWith('--prices=')),price=prices?JSON.parse(readFileSync(prices.slice(9),'utf8')):null;
  const report=await evaluateExperience({live:args.includes('--live'),price});console.log(JSON.stringify(report,null,2));
  if(['live_unavailable','live_incomplete'].includes(report.mode))process.exitCode=2;
}
