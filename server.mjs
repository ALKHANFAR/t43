import {createReadStream, statSync} from 'node:fs';
import {extname, join, normalize} from 'node:path';
import {createServer} from 'node:http';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import pg from 'pg';
import {createTenantProjectService,TenantProjectError} from './lib/tenant-projects.mjs';
import {SESSION_COOKIE,cookieValue,createTenantSession,readTenantSession,sessionCookie} from './lib/tenant-session.mjs';
import {createFirecrawlClient,FirecrawlError} from './lib/firecrawl.mjs';
import {createCompanyProfileService,CompanyProfileError} from './lib/company-profile.mjs';
import {createAccountAuthService,AccountAuthError} from './lib/account-auth.mjs';
import {createMailer,MailerError} from './lib/mailer.mjs';

const root=process.cwd();
const port=Number(process.env.PORT||3000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
let tenantProjectsPromise;
let companyProfilesPromise;
let accountAuthPromise;
let databasePromise;
let firecrawlClient;
const mailer=createMailer({apiKey:process.env.RESEND_API_KEY,from:process.env.SIYADAH_MAIL_FROM});

function json(res,status,body,headers={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(body));}
async function body(req,limit=32_000){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>limit)throw new TenantProjectError('request_too_large','الطلب كبير جدًا.',413);}try{return JSON.parse(raw||'{}');}catch{throw new TenantProjectError('invalid_json','طلب غير صالح.',400);}}
function authorized(req){
  const expected=String(process.env.SIYADAH_INTERNAL_TOKEN||''),actual=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!expected||expected.length!==actual.length)return false;
  return timingSafeEqual(Buffer.from(expected),Buffer.from(actual));
}
async function tenantProjects(){
  if(!tenantProjectsPromise)tenantProjectsPromise=(async()=>{
    const pool=await database();
    const service=createTenantProjectService({query:(text,values)=>pool.query(text,values),activepiecesUrl:process.env.ACTIVEPIECES_URL,apiKey:process.env.ACTIVEPIECES_PLATFORM_API_KEY,defaultMaxConcurrentJobs:process.env.SIYADAH_DEFAULT_PROJECT_CONCURRENCY||2});
    await service.init();return service;
  })().catch(error=>{tenantProjectsPromise=null;throw error;});
  return tenantProjectsPromise;
}
async function database(){
  if(!databasePromise)databasePromise=(async()=>{
    if(!process.env.DATABASE_URL)throw new TenantProjectError('database_not_configured','قاعدة بيانات العزل غير مهيأة.',503);
    const databaseUrl=new URL(process.env.DATABASE_URL);
    const ssl=databaseUrl.hostname.endsWith('.railway.internal')?false:(process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined);
    return new pg.Pool({connectionString:process.env.DATABASE_URL,ssl,max:10});
  })().catch(error=>{databasePromise=null;throw error;});
  return databasePromise;
}
async function accountAuth(){
  if(!accountAuthPromise)accountAuthPromise=(async()=>{
    const pool=await database(),service=createAccountAuthService({query:(text,values)=>pool.query(text,values)});
    await service.init();return service;
  })().catch(error=>{accountAuthPromise=null;throw error;});
  return accountAuthPromise;
}
function firecrawl(){
  if(!firecrawlClient)firecrawlClient=createFirecrawlClient({apiKey:process.env.FIRECRAWL_API_KEY,baseUrl:process.env.FIRECRAWL_API_URL});
  return firecrawlClient;
}
async function companyProfiles(){
  if(!companyProfilesPromise)companyProfilesPromise=(async()=>{
    const pool=await database(),service=createCompanyProfileService({query:(text,values)=>pool.query(text,values),firecrawl:firecrawl()});
    await service.init();return service;
  })().catch(error=>{companyProfilesPromise=null;throw error;});
  return companyProfilesPromise;
}
async function createTenantFlow(req,res){
  if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});
  try{
    const input=await body(req),service=await tenantProjects();
    const flow=await service.createFlow({tenantId:input.tenantId,displayName:input.flowName,metadata:{source:'siyadah-gateway'}});
    return json(res,201,{ok:true,tenantId:input.tenantId,projectId:flow.projectId,flowId:flow.id,status:flow.status,displayName:flow.version?.displayName||input.flowName});
  }catch(error){
    if(error instanceof TenantProjectError)return json(res,error.status,{ok:false,error:error.code,message:error.message});
    console.error('tenant flow creation failed',error?.message||error);return json(res,500,{ok:false,error:'internal_error'});
  }
}
async function provisionTenant(req,res){
  if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});
  try{
    const input=await body(req),service=await tenantProjects();
    const project=await service.ensure({tenantId:input.tenantId,displayName:input.displayName});
    return json(res,project.created?201:200,{ok:true,tenantId:project.tenant_id,projectId:project.activepieces_project_id,externalId:project.external_id,status:project.provision_status,created:project.created});
  }catch(error){
    if(error instanceof TenantProjectError)return json(res,error.status,{ok:false,error:error.code,message:error.message});
    console.error('tenant provision failed',error?.message||error);return json(res,500,{ok:false,error:'internal_error'});
  }
}

async function scrapeWeb(req,res){
  if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});
  try{
    const input=await body(req);
    const result=await firecrawl().scrape(input.url);
    return json(res,200,{ok:true,...result});
  }catch(error){
    if(error instanceof FirecrawlError)return json(res,error.status,{ok:false,error:error.code,message:error.message});
    console.error('web scrape failed',error?.message||error);return json(res,500,{ok:false,error:'internal_error'});
  }
}

async function onboarding(req,res){
  let sessionHeaders={};
  try{
    const input=await body(req),resolved=await tenantSession(req);sessionHeaders=resolved.headers;
    if(Object.hasOwn(input,'companyId')||Object.hasOwn(input,'tenantId')||Object.hasOwn(input,'projectId'))throw new TenantProjectError('client_scope_forbidden','نطاق الشركة يحدده الخادم فقط.',400);
    const companyId=resolved.session.companyId,projects=await tenantProjects(),profiles=await companyProfiles();
    const profileView=(profile)=>({
      companyName:profile.companyName,summary:profile.summary,industry:profile.industry,brandTone:profile.brandTone,
      coverageScore:profile.coverageScore,pagesRead:profile.pagesRead,knowledgeVersion:profile.knowledgeVersion,
      factCount:Array.isArray(profile.facts)?profile.facts.length:0,
      knowledgeAreas:Array.from(new Set((profile.facts||[]).map(item=>item.topic))).slice(0,6),
      proofScore:Number(profile.proofScore||0),rejectedClaims:Number(profile.rejectedClaims||0),
      conflictsCount:Array.isArray(profile.conflicts)?profile.conflicts.length:0,
      missingCritical:Array.isArray(profile.missingCritical)?profile.missingCritical.slice(0,6):[],
    });
    if(input.op==='enrich_company'){
      const project=await projects.ensure({tenantId:companyId,displayName:resolved.account.company_name});
      const started=await profiles.beginEnrich({companyId,projectId:project.activepieces_project_id,websiteUrl:input.website_url,maxCredits:Number(process.env.FIRECRAWL_AGENT_MAX_CREDITS||120)});
      return json(res,202,{ok:true,status:'processing',jobId:started.jobId,creditsUsed:started.creditsUsed},sessionHeaders);
    }
    if(input.op==='check_company_enrichment'){
      const checked=await profiles.checkEnrich(companyId);
      if(checked.status==='processing')return json(res,202,{ok:true,status:'processing',jobId:checked.jobId,creditsUsed:checked.creditsUsed},sessionHeaders);
      return json(res,200,{ok:true,status:'ready',profile:profileView(checked.profile),suggestions:checked.profile.suggestions||[],creditsUsed:checked.creditsUsed},sessionHeaders);
    }
    if(input.op==='describe_company'){
      const name=String(input.name||resolved.account.company_name),project=await projects.ensure({tenantId:companyId,displayName:name});
      const profile=await profiles.describe({companyId,projectId:project.activepieces_project_id,name,description:input.description});
      return json(res,200,{ok:true,profile:profileView(profile),suggestions:profile.suggestions},sessionHeaders);
    }
    if(input.op==='recommend_employees')return json(res,200,{ok:true,suggestions:await profiles.recommend(companyId,input.goal)},sessionHeaders);
    if(input.op==='select_employee'){
      const row=await profiles.read(companyId),suggestions=Array.isArray(row?.suggestions_json)?row.suggestions_json:[],suggestion=suggestions.find(item=>item.id===input.suggestion_id);
      if(!suggestion)throw new CompanyProfileError('invalid_suggestion','اختر موظفًا من الاقتراحات الحالية.',400);
      const flow=await projects.createFlow({tenantId:companyId,displayName:`${suggestion.name} · ${suggestion.title}`,metadata:{source:'siyadah-onboarding',state:'draft',roleKey:suggestion.roleKey,knowledgeVersion:row.knowledge_version}});
      const created=await profiles.createEmployeeDraft({companyId,suggestionId:suggestion.id,flow});
      return json(res,201,{ok:true,employee:created,message:`تم تجهيز ${created.name} وربطه بمعرفة شركتك. لن يبدأ العمل قبل ربط أدواته واختبار أول مهمة.`},sessionHeaders);
    }
    return json(res,400,{ok:false,error:'unsupported_operation'},sessionHeaders);
  }catch(error){
    if(error instanceof TenantProjectError||error instanceof CompanyProfileError||error instanceof FirecrawlError)return json(res,error.status,{ok:false,error:error.code,message:error.message},sessionHeaders);
    console.error('company onboarding failed',error?.message||error);return json(res,500,{ok:false,error:'internal_error'},sessionHeaders);
  }
}

async function tenantSession(req){
  const secret=process.env.SIYADAH_SESSION_SECRET;
  if(!secret||secret.length<32)throw new TenantProjectError('session_not_configured','جلسات العملاء غير مهيأة.',503);
  const current=readTenantSession(cookieValue(req.headers.cookie,SESSION_COOKIE),secret);
  const account=current?await (await accountAuth()).read(current.companyId):null;
  if(!current||!account||current.sessionVersion!==account.session_version)throw new TenantProjectError('unauthorized','سجّل الدخول للمتابعة.',401);
  return {session:current,account,headers:{}};
}

function authCookie(companyId,sessionVersion=1,maxAge=60*60*24*30){
  const secret=process.env.SIYADAH_SESSION_SECRET;
  if(!secret||secret.length<32)throw new TenantProjectError('session_not_configured','جلسات العملاء غير مهيأة.',503);
  return sessionCookie(companyId?createTenantSession(secret,companyId,sessionVersion):'',{secure:process.env.NODE_ENV==='production',maxAge});
}
function publicOrigin(){
  const explicit=String(process.env.SIYADAH_PUBLIC_URL||'').trim().replace(/\/$/,'');
  if(explicit)return explicit;
  const railway=String(process.env.RAILWAY_PUBLIC_DOMAIN||'').trim();
  return railway?`https://${railway}`:'';
}
async function authRoute(req,res,operation){
  try{
    const service=await accountAuth();
    if(operation==='logout'){
      try{const resolved=await tenantSession(req);await service.invalidateSessions(resolved.session.companyId);}catch(error){if(error?.status!==401)throw error;}
      return json(res,200,{ok:true,message:'تم تسجيل الخروج.'},{'set-cookie':authCookie('',1,0)});
    }
    if(operation==='session'){
      const resolved=await tenantSession(req);
      return json(res,200,{ok:true,account:{companyId:resolved.account.company_id,companyName:resolved.account.company_name,status:resolved.account.status}});
    }
    const input=await body(req);
    if(operation==='verify'){
      await service.verifyEmail(input.token);
      return json(res,200,{ok:true,message:'تم تأكيد بريدك. سجّل الدخول للمتابعة.'},{'set-cookie':authCookie('',1,0)});
    }
    if(operation==='signup'){
      if(!mailer.configured()||!publicOrigin())throw new MailerError('email_not_configured','إرسال البريد غير مهيأ.',503);
      let verification,status=201;
      try{
        const account=await service.signup(input);
        verification={email:account.email,token:account.verificationToken};
      }catch(error){
        if(!(error instanceof AccountAuthError)||error.code!=='email_exists')throw error;
        verification=await service.createEmailVerification(input.email);status=202;
        if(!verification)throw error;
      }
      const sent=await mailer.sendEmailVerification({to:verification.email,url:`${publicOrigin()}/auth.html?verify=${encodeURIComponent(verification.token)}`});
      await service.markEmailVerificationSent(verification.token,sent.id);
      return json(res,status,{ok:true,message:'أرسلنا رابط تأكيد إلى بريدك. افتحه لإكمال التسجيل.'},{'set-cookie':authCookie('',1,0)});
    }
    if(operation==='forgot'){
      if(!mailer.configured()||!publicOrigin())throw new MailerError('email_not_configured','إرسال البريد غير مهيأ.',503);
      const reset=await service.createPasswordReset(input.email);
      if(reset){
        try{
          const sent=await mailer.sendPasswordReset({to:reset.email,url:`${publicOrigin()}/auth.html?reset=${encodeURIComponent(reset.token)}`});
          await service.markPasswordResetSent(reset.token,sent.id);
        }catch(error){await service.cancelPasswordReset(reset.token);throw error;}
      }
      return json(res,202,{ok:true,message:'إذا كان البريد مسجلًا فسيصلك رابط الاستعادة.'});
    }
    if(operation==='reset'){
      await service.resetPassword(input);
      return json(res,200,{ok:true,message:'تم تغيير كلمة المرور. سجّل دخولك من جديد.'},{'set-cookie':authCookie('',1,0)});
    }
    const account=await service.login(input);
    return json(res,200,{ok:true,message:'أهلًا بك.',account:{companyId:account.company_id,companyName:account.company_name,email:account.email,status:account.status}},{'set-cookie':authCookie(account.company_id,account.session_version)});
  }catch(error){
    if(error instanceof AccountAuthError||error instanceof TenantProjectError||error instanceof MailerError)return json(res,error.status,{ok:false,error:error.code,message:error.message});
    console.error('account auth failed',error?.message||error);return json(res,500,{ok:false,error:'internal_error',message:'تعذّر إكمال الدخول.'});
  }
}
function employee(flow){
  const name=String(flow?.version?.displayName||flow?.displayName||'موظف').trim();
  return {recordId:`employee_${flow.id}`,flowId:flow.id,name,role:'موظف',initial:name.slice(0,1),status:String(flow.status||'DISABLED').toUpperCase()==='ENABLED'?'active':'disabled',tools:[],rules:[],instructions:'',how:[]};
}
function flowName(message){
  const compact=String(message||'').replace(/\s+/g,' ').trim().slice(0,90);
  const quoted=compact.match(/[«"]([^»"]{2,60})[»"]/);
  return (quoted?.[1]||compact||'موظف جديد').replace(/[.؟?!]+$/,'').slice(0,80);
}
function wantsEmployee(message){
  const text=String(message||'');
  return /(?:وظ[ّ]?ف|أنشئ|انشئ|ابن|سو[ِّي]*|أبي|أبغى).{0,80}(?:موظف|فلو|تدفق)|(?:موظف|فلو|تدفق).{0,80}(?:وظ[ّ]?ف|أنشئ|انشئ|ابن|سو[ِّي]*)/i.test(text);
}
async function publicChat(req,res){
  let sessionHeaders={};
  try{
    const input=await body(req),resolved=await tenantSession(req);sessionHeaders=resolved.headers;
    if(Object.hasOwn(input,'companyId')||Object.hasOwn(input,'tenantId')||Object.hasOwn(input,'projectId'))throw new TenantProjectError('client_scope_forbidden','نطاق الشركة يحدده الخادم فقط.',400);
    const service=await tenantProjects(),companyId=resolved.session.companyId;
    if(input.op==='hydrate'){
      const flows=await service.listFlows(companyId),profiles=await companyProfiles(),saved=await profiles.listEmployees(companyId),savedFlows=new Set(saved.map(item=>item.flowId)),profile=await profiles.read(companyId);
      return json(res,200,{ok:true,company:profile?.company_name||resolved.account.company_name,team:saved.concat(flows.filter(flow=>!savedFlows.has(flow.id)).map(employee)),memory:[],owned_knowledge:await profiles.ownedKnowledge(companyId),recent_work:[],work_count:0,conversations:[],pending_work:[]},sessionHeaders);
    }
    if(input.op==='message'){
      const conversationId=typeof input.conversation_id==='string'&&input.conversation_id?input.conversation_id:`chat_${randomUUID()}`;
      if(wantsEmployee(input.message)){
        await service.ensure({tenantId:companyId,displayName:`شركة سيادة ${companyId.slice(-8)}`});
        const flow=await service.createFlow({tenantId:companyId,displayName:flowName(input.message),metadata:{source:'siyadah-chat',state:'draft'}});
        const created=employee(flow);
        return json(res,201,{ok:true,conversation_id:conversationId,request_status:'succeeded',work_status:'succeeded',reply:`تم تجهيز ${created.name} داخل مساحة شركتك. لن يبدأ العمل قبل ربط أدواته واختبار أول مهمة.`,employee:created},sessionHeaders);
      }
      return json(res,200,{ok:true,conversation_id:conversationId,request_status:'succeeded',work_status:'succeeded',reply:'وصل طلبك. إنشاء الموظفين متاح الآن، أما التنفيذ الخارجي والتشغيل فما زالا متوقفين حتى يكتمل ربط الأدوات.'},sessionHeaders);
    }
    return json(res,400,{ok:false,error:'unsupported_operation'},sessionHeaders);
  }catch(error){
    if(error instanceof TenantProjectError)return json(res,error.status,{ok:false,error:error.code,message:error.message},sessionHeaders);
    console.error('public tenant chat failed',error?.message||error);return json(res,500,{ok:false,error:'internal_error'},sessionHeaders);
  }
}
async function deepseek(req,res){
  const key=process.env.DEEPSEEK_API_KEY;
  if(!key)return json(res,503,{error:{message:'DeepSeek غير مهيأ على الخادم.'}});
  let raw='';
  for await(const chunk of req){raw+=chunk;if(raw.length>2_000_000)return json(res,413,{error:{message:'الطلب كبير جدًا.'}});}
  let input;try{input=JSON.parse(raw);}catch{return json(res,400,{error:{message:'طلب غير صالح.'}});}
  const payload={model:'deepseek-chat',messages:Array.isArray(input.messages)?input.messages:[],tools:Array.isArray(input.tools)?input.tools:undefined,tool_choice:input.tool_choice||'auto',stream:false};
  try{
    const upstream=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const text=await upstream.text();res.writeHead(upstream.status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(text);
  }catch{return json(res,502,{error:{message:'تعذّر الوصول إلى DeepSeek.'}});}
}
function staticFile(req,res){
  const url=new URL(req.url,'http://localhost');
  const requested=url.pathname;
  const safe=normalize(decodeURIComponent(requested)).replace(/^(\.\.(\/|\\|$))+/,'');
  const file=join(root,safe);
  if(!file.startsWith(root))return json(res,403,{error:'forbidden'});
  try{if(!statSync(file).isFile())throw new Error();}catch{return json(res,404,{error:'not_found'});}
  res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':/\.(?:html|js|css)$/.test(file)?'no-cache':'public, max-age=86400, must-revalidate'});
  if(req.method==='HEAD')return res.end();
  createReadStream(file).pipe(res);
}
createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if((req.method==='GET'||req.method==='HEAD')&&pathname==='/'){
    res.writeHead(302,{location:'/app/chat.html','cache-control':'no-store'});
    return res.end();
  }
  if(req.method==='GET'&&req.url==='/health')return json(res,200,{ok:true});
  if(req.method==='POST'&&req.url==='/siyadah-api/v1/auth/signup')return authRoute(req,res,'signup');
  if(req.method==='POST'&&req.url==='/siyadah-api/v1/auth/verify-email')return authRoute(req,res,'verify');
  if(req.method==='POST'&&req.url==='/siyadah-api/v1/auth/login')return authRoute(req,res,'login');
  if(req.method==='POST'&&req.url==='/siyadah-api/v1/auth/logout')return authRoute(req,res,'logout');
  if(req.method==='POST'&&req.url==='/siyadah-api/v1/auth/forgot-password')return authRoute(req,res,'forgot');
  if(req.method==='POST'&&req.url==='/siyadah-api/v1/auth/reset-password')return authRoute(req,res,'reset');
  if(req.method==='GET'&&req.url==='/siyadah-api/v1/auth/session')return authRoute(req,res,'session');
  if(req.method==='POST'&&req.url==='/internal/v1/tenants/provision')return provisionTenant(req,res);
  if(req.method==='POST'&&req.url==='/internal/v1/tenant-flows/create')return createTenantFlow(req,res);
  if(req.method==='POST'&&req.url==='/internal/v1/web/scrape')return scrapeWeb(req,res);
  if(req.method==='POST'&&req.url==='/siyadah-api/v1/onboarding')return onboarding(req,res);
  if(req.method==='POST'&&req.url==='/siyadah-api/v1/chat')return publicChat(req,res);
  if(req.method==='POST'&&req.url==='/deepseek/v1/chat/completions')return deepseek(req,res);
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'method_not_allowed'});
  return staticFile(req,res);
}).listen(port,'0.0.0.0');
