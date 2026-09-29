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
