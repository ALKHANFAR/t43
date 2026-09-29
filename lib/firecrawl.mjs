const PRIVATE_IPV4=/^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

export class FirecrawlError extends Error{
  constructor(code,message,status=500){super(message);this.name='FirecrawlError';this.code=code;this.status=status;}
}

function publicUrl(value){
  let url;
  try{url=new URL(String(value||''));}catch{throw new FirecrawlError('invalid_url','الرابط غير صالح.',400);}
  const host=url.hostname.toLowerCase();
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||host==='localhost'||host.endsWith('.localhost')||host==='::1'||PRIVATE_IPV4.test(host)){
    throw new FirecrawlError('invalid_url','الرابط غير صالح.',400);
  }
  return url.toString();
}

export function createFirecrawlClient({apiKey,baseUrl='https://api.firecrawl.dev',fetchImpl=fetch}={}){
  const endpoint=String(baseUrl||'').replace(/\/$/,'');
  async function request(path,payload,timeout=70_000,method='POST'){
    if(!apiKey)throw new FirecrawlError('firecrawl_not_configured','أداة قراءة المواقع غير مهيأة.',503);
    let response;
    try{
      response=await fetchImpl(`${endpoint}${path}`,{
        method,
        headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
        ...(method==='GET'?{}:{body:JSON.stringify(payload)}),
        signal:AbortSignal.timeout(timeout),
      });
    }catch(error){
      if(error?.name==='TimeoutError'||error?.name==='AbortError')throw new FirecrawlError('firecrawl_timeout','قراءة الموقع أخذت وقتًا أطول من المتوقع.',504);
      throw new FirecrawlError('firecrawl_unreachable','تعذّر الوصول إلى أداة قراءة المواقع.',502);
    }
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result?.success!==true){
      if(response.status===401)throw new FirecrawlError('firecrawl_unauthorized','مفتاح أداة قراءة المواقع مرفوض.',502);
      if(response.status===402)throw new FirecrawlError('firecrawl_insufficient_credits','رصيد أداة قراءة المواقع غير كافٍ.',402);
      if(response.status===403)throw new FirecrawlError('firecrawl_forbidden','أداة قراءة المواقع رفضت الطلب.',502);
      if(response.status===429)throw new FirecrawlError('firecrawl_rate_limited','أداة قراءة المواقع طلبت تخفيف الطلبات مؤقتًا.',429);
      throw new FirecrawlError('firecrawl_failed','تعذّرت قراءة الموقع.',502);
    }
    return result;
  }
  async function scrape(value){
    const url=publicUrl(value);
    const result=await request('/v2/scrape',{url,formats:['markdown'],onlyMainContent:true,maxAge:3_600_000,timeout:60_000});
    return {url,markdown:String(result.data?.markdown||''),metadata:result.data?.metadata||{}};
  }
  async function map(value){
    const url=publicUrl(value);
    const result=await request('/v2/map',{url,limit:80,sitemap:'include',includeSubdomains:true},45_000);
    const links=[];
    for(const link of Array.isArray(result.links)?result.links:Array.isArray(result.data?.links)?result.data.links:[]){
      try{links.push(publicUrl(typeof link==='string'?link:link?.url));}catch{}
    }
    return {url,links};
  }
  async function extract(value,{schema,prompt}){
    const url=publicUrl(value);
    const result=await request('/v2/scrape',{
      url,
      formats:[{type:'json',schema,prompt,checkPromptInjection:true}],
      onlyMainContent:true,
      maxAge:3_600_000,
      timeout:90_000,
    },100_000);
    const metadata=result.data?.metadata||{};
    if(Number(metadata.statusCode)>=400)throw new FirecrawlError('page_unavailable','تعذّرت قراءة إحدى صفحات الموقع.',502);
    return {url,data:result.data?.json||{},metadata};
  }
  async function startAgent({urls,prompt,schema,maxCredits=120,effort='high'}={}){
    const safeUrls=Array.from(new Set((urls||[]).map(publicUrl))).slice(0,12);
    if(!safeUrls.length)throw new FirecrawlError('agent_urls_required','لم نحدد صفحات موثوقة للبحث العميق.',400);
    const result=await request('/v2/agent',{
      urls:safeUrls,prompt:String(prompt||'').slice(0,10_000),schema,
      maxCredits:Math.max(1,Math.min(Number(maxCredits)||120,2500)),
      strictConstrainToURLs:true,model:'spark-2',effort:['low','medium','high'].includes(effort)?effort:'high',
    },70_000);
    if(!result.id)throw new FirecrawlError('firecrawl_agent_failed','تعذّر بدء البحث العميق.',502);
    return {id:String(result.id),urls:safeUrls};
  }
  async function getAgent(jobId){
    const id=String(jobId||'');
    if(!/^[0-9a-f-]{36}$/i.test(id))throw new FirecrawlError('invalid_agent_job','معرّف البحث العميق غير صالح.',400);
    const result=await request(`/v2/agent/${id}`,undefined,45_000,'GET');
    return {id,status:result.status,data:result.data||null,error:result.error||null,creditsUsed:Number(result.creditsUsed||0),model:result.model||null,effort:result.effort||null};
  }
  return {scrape,map,extract,startAgent,getAgent};
}
