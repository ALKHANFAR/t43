import {createReadStream, statSync} from 'node:fs';
import {extname, join, normalize} from 'node:path';
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import pg from 'pg';
import {createTenantProjectService,TenantProjectError} from './lib/tenant-projects.mjs';

const root=process.cwd();
const port=Number(process.env.PORT||3000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
let tenantProjectsPromise;

function json(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));}
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
    const service=createTenantProjectService({query:(text,values)=>pool.query(text,values),activepiecesUrl:process.env.ACTIVEPIECES_URL,apiKey:process.env.ACTIVEPIECES_PLATFORM_API_KEY});
    await service.init();return service;
  })().catch(error=>{tenantProjectsPromise=null;throw error;});
  return tenantProjectsPromise;
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
  if(req.method==='POST'&&req.url==='/deepseek/v1/chat/completions')return deepseek(req,res);
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'method_not_allowed'});
  return staticFile(req,res);
}).listen(port,'0.0.0.0');
