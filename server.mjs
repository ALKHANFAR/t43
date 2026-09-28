import {createReadStream, statSync} from 'node:fs';
import {extname, join, normalize} from 'node:path';
import {createServer} from 'node:http';

const root=process.cwd();
const port=Number(process.env.PORT||3000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};

function json(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));}
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
  const requested=url.pathname==='/'?'/app/chat.html':url.pathname;
  const safe=normalize(decodeURIComponent(requested)).replace(/^(\.\.(\/|\\|$))+/,'');
  const file=join(root,safe);
  if(!file.startsWith(root))return json(res,403,{error:'forbidden'});
  try{if(!statSync(file).isFile())throw new Error();}catch{return json(res,404,{error:'not_found'});}
  res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':/\.(?:html|js|css)$/.test(file)?'no-cache':'public, max-age=86400, must-revalidate'});
  if(req.method==='HEAD')return res.end();
  createReadStream(file).pipe(res);
}
createServer((req,res)=>{
  if(req.method==='GET'&&req.url==='/health')return json(res,200,{ok:true});
  if(req.method==='POST'&&req.url==='/deepseek/v1/chat/completions')return deepseek(req,res);
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'method_not_allowed'});
  return staticFile(req,res);
}).listen(port,'0.0.0.0');
