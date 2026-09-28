import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { JSDOM } from 'jsdom';

const source=readFileSync(new URL('../app/activepieces-mcp.js',import.meta.url),'utf8');
const AP='https://activepieces-production-82ad.up.railway.app';

function response(body,{status=200,headers={}}={}){
  const text=typeof body==='string'?body:JSON.stringify(body);
  return {ok:status>=200&&status<300,status,headers:new Headers(headers),json:async()=>JSON.parse(text||'{}'),text:async()=>text};
}
function runtime(fetchImpl){
  const dom=new JSDOM('<!doctype html>',{url:'https://t43-frontend-production-5106.up.railway.app/app/chat.html',runScripts:'outside-only'});
  const w=dom.window,navigations=[];
  Object.defineProperty(w,'crypto',{value:webcrypto});
  w.TextEncoder=TextEncoder;
  w.fetch=fetchImpl;
  w.__SIY_MCP_NAVIGATE__=url=>navigations.push(url);
  w.eval(source);
  return {dom,w,client:w.SiyadahActivepiecesMcp,navigations};
}
function metadataFetch(calls){
  return async(url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).endsWith('/.well-known/oauth-protected-resource/mcp/platform')) return response({resource:AP+'/mcp/platform',authorization_servers:[AP]});
    if(String(url).endsWith('/.well-known/oauth-authorization-server')) return response({authorization_endpoint:AP+'/authorize',token_endpoint:AP+'/token',registration_endpoint:AP+'/register'});
    if(String(url).endsWith('/register')) return response({client_id:'public-client',token_endpoint_auth_method:'none'},{status:201});
    throw new Error('unexpected '+url);
  };
}

test('direct connect dynamically registers with self-hosted Activepieces plus PKCE and never a Siyadah backend',async()=>{
  const calls=[],p=runtime(metadataFetch(calls));
  try{
    await p.client.connect();
    assert.equal(calls.every(call=>call.url.startsWith(AP+'/')),true);
    assert.equal(calls.some(call=>call.url.includes('/siyadah-api/')),false);
    assert.equal(calls.some(call=>call.url.endsWith('/register')),true);
    const authorize=new URL(p.navigations[0]);
    assert.equal(authorize.origin,AP);
    assert.equal(authorize.pathname,'/authorize');
    assert.equal(authorize.searchParams.get('code_challenge_method'),'S256');
    assert.equal(authorize.searchParams.get('client_id'),'public-client');
    assert.equal(authorize.searchParams.get('scope'),'mcp');
    assert.equal(authorize.searchParams.get('resource'),AP+'/mcp/platform');
    assert.equal(authorize.searchParams.get('state'),p.w.sessionStorage.getItem('siyadah.ap.mcp.state'));
    assert.ok(p.w.sessionStorage.getItem('siyadah.ap.mcp.verifier').length>=43);
  }finally{p.dom.window.close();}
});

test('OAuth callback rejects a mismatched state before token exchange',async()=>{
  const calls=[],p=runtime(metadataFetch(calls));
  try{
    await p.client.connect();
    p.w.history.pushState({},'',p.w.location.pathname+'?code=one&state=wrong');
    await assert.rejects(()=>p.client.handleCallback(),/جلسة OAuth/);
    assert.equal(calls.some(call=>call.url.endsWith('/token')),false);
    assert.equal(p.w.location.search,'');
  }finally{p.dom.window.close();}
});

test('callback exchanges the code then initialize and tools/list stay direct with MCP session',async()=>{
  const calls=[];
  let phase='connect';
  const p=runtime(async(url,options={})=>{
    const target=String(url);calls.push({url:target,options});
    if(phase==='connect') return metadataFetch([])(url,options);
    if(target.endsWith('/token')) return response({access_token:'access-one',refresh_token:'refresh-one'});
    if(target.endsWith('/mcp/platform')){
      const body=JSON.parse(options.body);
      if(body.method==='initialize') return response({jsonrpc:'2.0',id:body.id,result:{protocolVersion:'2025-11-25',capabilities:{}}},{headers:{'content-type':'application/json','mcp-session-id':'session-one'}});
      if(body.method==='notifications/initialized') return response('',{status:202});
      if(body.method==='tools/list') return response('event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:body.id,result:{tools:[{name:'create_flow'},{name:'list_pieces'}]}})+'\n\n',{headers:{'content-type':'text/event-stream'}});
      if(body.method==='tools/call') return response({jsonrpc:'2.0',id:body.id,result:{content:[{type:'text',text:'ok'}]}});
    }
    throw new Error('unexpected '+target);
  });
  try{
    await p.client.connect();
    const authorize=new URL(p.navigations[0]);
    phase='callback';
    p.w.history.pushState({},'',p.w.location.pathname+'?code=issued-code&state='+encodeURIComponent(authorize.searchParams.get('state')));
    assert.equal(await p.client.handleCallback(),true);
    assert.equal(p.w.location.search,'');
    const tools=await p.client.listTools();
    assert.deepEqual(Array.from(tools,tool=>tool.name),['create_flow','list_pieces']);
    const called=await p.client.callTool('list_pieces',{query:'gmail'});
    assert.equal(called.content[0].text,'ok');
    const tokenCall=calls.find(call=>call.url.endsWith('/token'));
    assert.match(tokenCall.options.body,/grant_type=authorization_code/);
    assert.ok(!tokenCall.url.includes('issued-code'));
    const mcpCalls=calls.filter(call=>call.url===AP+'/mcp/platform'&&call.options.method==='POST');
    assert.deepEqual(mcpCalls.map(call=>JSON.parse(call.options.body).method),['initialize','tools/list','tools/call']);
    assert.equal(mcpCalls[0].options.headers.Authorization,'Bearer access-one');
    assert.equal(mcpCalls[2].options.headers['Mcp-Session-Id'],'session-one');
  }finally{p.dom.window.close();}
});
