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
  async function scrape(value){
    if(!apiKey)throw new FirecrawlError('firecrawl_not_configured','أداة قراءة المواقع غير مهيأة.',503);
    const url=publicUrl(value);
    let response;
    try{
      response=await fetchImpl(`${endpoint}/v2/scrape`,{
        method:'POST',
        headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
        body:JSON.stringify({url,formats:['markdown'],onlyMainContent:true,maxAge:3_600_000,timeout:60_000}),
        signal:AbortSignal.timeout(70_000),
      });
    }catch(error){
      if(error?.name==='TimeoutError'||error?.name==='AbortError')throw new FirecrawlError('firecrawl_timeout','قراءة الموقع أخذت وقتًا أطول من المتوقع.',504);
      throw new FirecrawlError('firecrawl_unreachable','تعذّر الوصول إلى أداة قراءة المواقع.',502);
    }
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result?.success!==true){
      if(response.status===401||response.status===403)throw new FirecrawlError('firecrawl_unauthorized','مفتاح أداة قراءة المواقع مرفوض.',502);
      if(response.status===429)throw new FirecrawlError('firecrawl_rate_limited','أداة قراءة المواقع طلبت تخفيف الطلبات مؤقتًا.',429);
      throw new FirecrawlError('firecrawl_failed','تعذّرت قراءة الموقع.',502);
    }
    return {url,markdown:String(result.data?.markdown||''),metadata:result.data?.metadata||{}};
  }
  return {scrape};
}
