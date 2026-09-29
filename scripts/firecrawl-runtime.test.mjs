import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirecrawlClient,FirecrawlError} from '../lib/firecrawl.mjs';

test('scrapes one public page through the official v2 API with the server key',async()=>{
  const calls=[];
  const client=createFirecrawlClient({
    apiKey:'fc-test',
    fetchImpl:async(url,options)=>{
      calls.push({url,options});
      return {ok:true,status:200,json:async()=>({success:true,data:{markdown:'# Example',metadata:{statusCode:200}}})};
    },
  });
  const result=await client.scrape('https://example.com');
  assert.equal(result.markdown,'# Example');
  assert.equal(calls[0].url,'https://api.firecrawl.dev/v2/scrape');
  assert.equal(calls[0].options.headers.Authorization,'Bearer fc-test');
  assert.deepEqual(JSON.parse(calls[0].options.body),{
    url:'https://example.com/',formats:['markdown'],onlyMainContent:true,maxAge:3_600_000,timeout:60_000,
  });
});

test('rejects local URLs before calling Firecrawl',async()=>{
  let called=false;
  const client=createFirecrawlClient({apiKey:'fc-test',fetchImpl:async()=>{called=true;}});
  await assert.rejects(()=>client.scrape('http://127.0.0.1/private'),error=>error instanceof FirecrawlError&&error.code==='invalid_url'&&error.status===400);
  assert.equal(called,false);
});

test('requires configuration and maps provider limits without leaking details',async()=>{
  await assert.rejects(()=>createFirecrawlClient().scrape('https://example.com'),error=>error instanceof FirecrawlError&&error.code==='firecrawl_not_configured');
  const client=createFirecrawlClient({apiKey:'fc-test',fetchImpl:async()=>({ok:false,status:429,json:async()=>({error:'provider detail'})})});
  await assert.rejects(()=>client.scrape('https://example.com'),error=>error instanceof FirecrawlError&&error.code==='firecrawl_rate_limited'&&error.status===429&&!error.message.includes('provider detail'));
});

test('maps a company site and extracts guarded structured facts',async()=>{
  const calls=[];
  const client=createFirecrawlClient({apiKey:'fc-test',fetchImpl:async(url,options)=>{
    calls.push({url,body:JSON.parse(options.body)});
    if(url.endsWith('/v2/map'))return {ok:true,status:200,json:async()=>({success:true,links:[{url:'https://example.com/about'},'https://example.com/services']})};
    return {ok:true,status:200,json:async()=>({success:true,data:{json:{facts:[{topic:'services',key:'delivery',value:'توصيل'}]},metadata:{statusCode:200}}})};
  }});
  const mapped=await client.map('https://example.com');
  assert.deepEqual(mapped.links,['https://example.com/about','https://example.com/services']);
  const schema={type:'object',properties:{facts:{type:'array'}}};
  const extracted=await client.extract(mapped.links[0],{schema,prompt:'Extract facts'});
  assert.equal(extracted.data.facts[0].value,'توصيل');
  assert.equal(calls[0].url,'https://api.firecrawl.dev/v2/map');
  assert.equal(calls[1].body.formats[0].checkPromptInjection,true);
  assert.deepEqual(calls[1].body.formats[0].schema,schema);
});

test('starts a constrained high-effort agent and reads its status',async()=>{
  const calls=[];
  const client=createFirecrawlClient({apiKey:'fc-test',fetchImpl:async(url,options)=>{
    calls.push({url,method:options.method,body:options.body&&JSON.parse(options.body)});
    if(options.method==='GET')return {ok:true,status:200,json:async()=>({success:true,status:'completed',data:{claims:[]},creditsUsed:7,model:'spark-2',effort:'high'})};
    return {ok:true,status:200,json:async()=>({success:true,id:'550e8400-e29b-41d4-a716-446655440000'})};
  }});
  const started=await client.startAgent({urls:['https://example.com/about'],prompt:'Find proven facts',schema:{type:'object'},maxCredits:25});
  assert.equal(started.id,'550e8400-e29b-41d4-a716-446655440000');
  assert.deepEqual(calls[0].body,{urls:['https://example.com/about'],prompt:'Find proven facts',schema:{type:'object'},maxCredits:25,strictConstrainToURLs:true,model:'spark-2',effort:'high'});
  const status=await client.getAgent(started.id);
  assert.equal(status.status,'completed');
  assert.equal(status.creditsUsed,7);
  assert.equal(calls[1].method,'GET');
  assert.equal(calls[1].body,undefined);
});
