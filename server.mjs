import {createReadStream, statSync} from 'node:fs';
import {extname, join, normalize} from 'node:path';
import {createServer} from 'node:http';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import pg from 'pg';
import {createTenantProjectService,TenantProjectError} from './lib/tenant-projects.mjs';
import {SESSION_COOKIE,cookieValue,createTenantSession,readTenantSession,sessionCookie} from './lib/tenant-session.mjs';

const root=process.cwd();
const port=Number(process.env.PORT||3000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
let tenantProjectsPromise;

function json(res,status,body,headers={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(body));}
async function body(req,limit=32_000){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>limit)throw new TenantProjectError('request_too_large','الطلب كبير جدًا.',413);}try{return JSON.parse(raw||'{}');}catch{throw new TenantProjectError('invalid_json','طلب غير صالح.',400);}}
function authorized(req){
  const expected=String(process.env.SIYADAH_INTERNAL_TOKEN||''),actual=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!expected||expected.length!==actual.length)return false;
  return timingSafeEqual(Buffer.from(expected),Buffer.from(actual));
}
async function tenantProjects(){
  if(!tenantProjectsPromise)tenantProjectsPromise=(async()=>{
    if(!process.env.DATABASE_URL)throw new TenantProjectError('database_not_configured','قاعدة بيانات العزل غير مهيأة.',503);
    const databaseUrl=new URL(process.env.DATABASE_URL);
    const ssl=databaseUrl.hostname.endsWith('.railway.internal')?false:(process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined);
    const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl,max:10});
    const service=createTenantProjectService({query:(text,values)=>pool.query(text,values),activepiecesUrl:process.env.ACTIVEPIECES_URL,apiKey:process.env.ACTIVEPIECES_PLATFORM_API_KEY,defaultMaxConcurrentJobs:process.env.SIYADAH_DEFAULT_PROJECT_CONCURRENCY||2});
    await service.init();return service;
  })().catch(error=>{tenantProjectsPromise=null;throw error;});
  return tenantProjectsPromise;
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

function tenantSession(req){
  const secret=process.env.SIYADAH_SESSION_SECRET;
  if(!secret||secret.length<32)throw new TenantProjectError('session_not_configured','جلسات العملاء غير مهيأة.',503);
  const current=readTenantSession(cookieValue(req.headers.cookie,SESSION_COOKIE),secret);
  if(current)return {session:current,headers:{}};
  const token=createTenantSession(secret),session=readTenantSession(token,secret);
  return {session,headers:{'set-cookie':sessionCookie(token,{secure:process.env.NODE_ENV==='production'})}};
}
function employee(flow){
  const name=String(flow?.version?.displayName||flow?.displayName||'موظف').trim();
  return {recordId:`employee_${flow.id}`,flowId:flow.id,name,role:'موظف رقمي',initial:name.slice(0,1),status:String(flow.status||'DISABLED').toUpperCase()==='ENABLED'?'active':'disabled',tools:[],rules:[],instructions:'',how:[]};
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
    const input=await body(req),resolved=tenantSession(req);sessionHeaders=resolved.headers;
    if(Object.hasOwn(input,'companyId')||Object.hasOwn(input,'tenantId')||Object.hasOwn(input,'projectId'))throw new TenantProjectError('client_scope_forbidden','نطاق الشركة يحدده الخادم فقط.',400);
    const service=await tenantProjects(),companyId=resolved.session.companyId;
    if(input.op==='hydrate'){
      const flows=await service.listFlows(companyId);
      return json(res,200,{ok:true,company:'حسابك',team:flows.map(employee),memory:[],recent_work:[],work_count:0,conversations:[],pending_work:[]},sessionHeaders);
    }
    if(input.op==='message'){
      const conversationId=typeof input.conversation_id==='string'&&input.conversation_id?input.conversation_id:`chat_${randomUUID()}`;
      if(wantsEmployee(input.message)){
        await service.ensure({tenantId:companyId,displayName:`شركة سيادة ${companyId.slice(-8)}`});
        const flow=await service.createFlow({tenantId:companyId,displayName:flowName(input.message),metadata:{source:'siyadah-chat',state:'draft'}});
        const created=employee(flow);
        return json(res,201,{ok:true,conversation_id:conversationId,request_status:'succeeded',work_status:'succeeded',reply:`تم إنشاء ${created.name} كمسودة معطلة داخل مساحة حسابك. لم يتم تشغيلها أو نشرها.`,employee:created},sessionHeaders);
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
  if(req.method==='POST'&&req.url==='/internal/v1/tenants/provision')return provisionTenant(req,res);
  if(req.method==='POST'&&req.url==='/internal/v1/tenant-flows/create')return createTenantFlow(req,res);
  if(req.method==='POST'&&req.url==='/siyadah-api/v1/chat')return publicChat(req,res);
  if(req.method==='POST'&&req.url==='/deepseek/v1/chat/completions')return deepseek(req,res);
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'method_not_allowed'});
  return staticFile(req,res);
}).listen(port,'0.0.0.0');
