// Local-only navigation preview. No account, email, provider, or database calls.
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const port=Number(process.env.SIYADAH_PREVIEW_PORT||8767);
const rootFiles=new Set(['auth.html','auth-design.css','fonts.css','siyadah-theme.css','pieces.js','index.html','ar.html','site.js','journey.css','site.webmanifest','apple-touch-icon.png']);
const appFiles=new Set(['/app/onboard.html','/app/onboard.js','/app/chat.html','/app/chat.js']);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.svg':'image/svg+xml'};
const previewBanner=`<style id="preview-banner-style">body{padding-top:34px!important}#preview-banner{position:fixed;z-index:100000;inset-block-start:0;inset-inline:0;min-height:34px;display:flex;align-items:center;justify-content:center;gap:12px;padding:5px 12px;background:#1025b5;color:#fff;font:500 12px/1.4 system-ui,sans-serif;text-align:center}#preview-banner a{color:#fff;text-decoration:underline}</style><div id="preview-banner" role="note">معاينة تنقّل فقط · Preview: no account or email <a href="/app/onboard.html">شاهد التهيئة</a></div>`;
const previewAuth=`<script>document.getElementById('authForm').addEventListener('submit',function(event){event.preventDefault();event.stopImmediatePropagation();document.getElementById('msg').textContent='هذه معاينة تنقّل فقط. استخدم «شاهد التهيئة» أعلى الصفحة.';},true);</script>`;
let company='شركة مثال',description='نساعد الشركات على تنظيم طلبات العملاء.',employee=null;

function json(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
async function readBody(req){let raw='';for await(const part of req){raw+=part;if(raw.length>8192)throw new Error('too_large');}return JSON.parse(raw||'{}');}
function suggestions(){return [
  {id:'marketing',roleKey:'marketing',name:'ريم',title:'موظفة التسويق',goal:'تجهز مسودات المحتوى للمراجعة.',reason:'مسودة محتوى من وصف شركتك.',confidence:80,knowledgeTopics:[]},
  {id:'customer_support',roleKey:'customer_support',name:'فهد',title:'دعم العملاء',goal:'يرتب الأسئلة ويرفع ما يحتاج قرارك.',reason:'يبدأ من أسئلة العملاء المتكررة.',confidence:72,knowledgeTopics:[]},
  {id:'operations',roleKey:'operations',name:'ليان',title:'العمليات',goal:'تنظم الطلبات ومراحل متابعتها.',reason:'تربط الطلب بخطوة واضحة.',confidence:64,knowledgeTopics:[]}
];}
function profile(){return {companyName:company,summary:description,pagesRead:0,factCount:0,coverageScore:0,knowledgeVersion:1,knowledgeAreas:[],rejectedClaims:0};}
async function api(req,res,path){
  if(path==='/siyadah-api/v1/auth/session'&&req.method==='GET')return json(res,200,{ok:true,preview:true});
  if(path==='/siyadah-api/v1/auth/logout'&&req.method==='POST')return json(res,200,{ok:true,preview:true});
  if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
  let input;try{input=await readBody(req);}catch{return json(res,400,{ok:false,error:'invalid_preview_request'});}
  if(path==='/siyadah-api/v1/onboarding'){
    if(input.op==='check_company_enrichment')return json(res,404,{ok:false,error:'no_saved_profile'});
    if(input.op==='describe_company'){
      company=String(input.name||company).trim().slice(0,120)||company;
      description=String(input.description||description).trim().slice(0,1200)||description;
      return json(res,200,{ok:true,profile:profile(),suggestions:suggestions(),preview:true});
    }
    if(input.op==='recommend_employees')return json(res,200,{ok:true,suggestions:suggestions(),preview:true});
    if(input.op==='select_employee'){
      const role=suggestions().find(item=>item.id===input.suggestion_id);
      if(!role)return json(res,400,{ok:false,error:'unknown_preview_role'});
      employee={recordId:'preview-employee',flowId:'preview-flow',name:role.name,role:role.title,initial:role.name.slice(0,1),status:'disabled',tools:[],instructions:description,knowledgeVersion:1};
      return json(res,200,{ok:true,employee,preview:true});
    }
  }
  if(path==='/siyadah-api/v1/chat'&&input.op==='hydrate')return json(res,200,{ok:true,company,company_settings:{},brain:null,memory:[],owned_knowledge:{facts:[],knowledgeVersion:1},team:employee?[employee]:[],recent_work:[],conversations:[],pending_work:[],preview:true});
  if(path==='/siyadah-api/v1/integrations'&&input.op==='list')return json(res,200,{ok:true,connections:[],preview:true});
  return json(res,409,{ok:false,error:'preview_only',message:'هذه معاينة تنقّل؛ لا يوجد تشغيل أو حفظ فعلي.'});
}
async function serve(res,path){
  const allowed=rootFiles.has(path.slice(1))||appFiles.has(path)||path.startsWith('/assets/')||path.startsWith('/fonts/');
  if(!allowed||path.includes('..'))return json(res,404,{error:'not_found'});
  const file=resolve(root,'.'+path);
  if(!file.startsWith(root+sep))return json(res,404,{error:'not_found'});
  try{if(!(await stat(file)).isFile())throw new Error();}catch{return json(res,404,{error:'not_found'});}
  let contents=await readFile(file);
  if(extname(file)==='.html'){
    let html=contents.toString().replace('<body>','<body>'+previewBanner);
    if(path==='/auth.html')html=html.replace('</body>',previewAuth+'</body>');
    contents=Buffer.from(html);
  }
  res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(contents);
}
createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/'){res.writeHead(302,{location:'/auth.html'});return res.end();}
  if(path.startsWith('/siyadah-api/'))return api(req,res,path);
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  return serve(res,path).catch(()=>json(res,500,{error:'preview_failure'}));
}).listen(port,'127.0.0.1',()=>process.stdout.write(`Siyadah navigation preview: http://127.0.0.1:${port}/auth.html\n`));
