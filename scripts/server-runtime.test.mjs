import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';
import assert from 'node:assert/strict';

async function freePort(){
  const server=createServer();
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const {port}=server.address();
  server.close();
  await once(server,'close');
  return port;
}

async function waitForServer(url){
  for(let attempt=0;attempt<50;attempt+=1){
    try{return await fetch(url);}
    catch{await new Promise(resolve=>setTimeout(resolve,50));}
  }
  throw new Error('server did not start');
}

test('root hides the broken duplicate and redirects to the working chat',async()=>{
  const port=await freePort();
  const child=spawn(process.execPath,['server.mjs'],{
    cwd:new URL('..',import.meta.url),
    env:{...process.env,PORT:String(port)},
    stdio:'ignore',
  });
  try{
    await waitForServer(`http://127.0.0.1:${port}/health`);
    const root=await fetch(`http://127.0.0.1:${port}/`,{redirect:'manual'});
    assert.equal(root.status,302);
    assert.equal(root.headers.get('location'),'/app/chat.html');
    const chat=await fetch(`http://127.0.0.1:${port}/app/chat.html`);
    assert.equal(chat.status,200);
    assert.match(await chat.text(),/chat\.js\?v=1\.11\.0/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/app/chat.js?v=1.11.0`)).status,200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/chat.js?v=1.11.0`)).status,404);
    for(const path of ['/server.mjs','/package.json','/lib/account-auth.mjs','/scripts/server-runtime.test.mjs','/developer-lab/index.html']){
      const response=await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status,404,`${path} must not be publicly served`);
    }
  }finally{
    child.kill();
    await once(child,'exit');
  }
});
