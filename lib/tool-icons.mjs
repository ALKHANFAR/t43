import {readFileSync} from 'node:fs';

const icons=JSON.parse(readFileSync(new URL('../data/tool-icon-sources.json',import.meta.url),'utf8'));
const contentTypes=new Set(['image/png','image/jpeg','image/webp','image/svg+xml','image/gif']);

export async function toolIcon(slug,{fetchImpl=fetch}={}){
  if(!/^[a-z0-9-]{1,80}$/.test(slug||'')||!Object.hasOwn(icons,slug))return {status:404};
  const source=icons[slug];
  if(!source.startsWith('https://cdn.activepieces.com/'))return {status:404};
  try{
    const upstream=await fetchImpl(source,{redirect:'error',signal:AbortSignal.timeout(5000)});
    if(!upstream.ok)return {status:502};
    const type=String(upstream.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(!contentTypes.has(type))return {status:502};
    const length=Number(upstream.headers.get('content-length')||0);
    if(length>1_000_000)return {status:502};
    const bytes=Buffer.from(await upstream.arrayBuffer());
    if(bytes.length>1_000_000)return {status:502};
    return {status:200,type,bytes};
  }catch{return {status:502};}
}
