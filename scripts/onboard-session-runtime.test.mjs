import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const html=await readFile(new URL('../app/onboard.html',import.meta.url),'utf8');
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));

function page(fetch){
  return new JSDOM(html,{
    url:'https://accounts.siyadah-ai.com/app/onboard.html',
    runScripts:'dangerously',
    beforeParse(window){window.fetch=fetch;},
  });
}

test('onboarding stays gated until the session succeeds',async()=>{
  let finish;
  const dom=page(()=>new Promise(resolve=>{finish=resolve;}));
  const {document}=dom.window;
  assert.equal(document.documentElement.dataset.session,'checking');
  assert.equal(document.querySelector('script[src="onboard.js?v=1.9.0"]'),null);
  finish({ok:true});
  await settle();
  assert.equal(document.documentElement.dataset.session,'ready');
  assert.ok(document.querySelector('script[src="onboard.js?v=1.9.0"]'));
  dom.window.close();
});

test('failed session remains gated and offers retry',async()=>{
  let attempts=0;
  const dom=page(()=>{
    attempts++;
    return attempts===1?Promise.resolve({ok:false,status:401}):Promise.resolve({ok:true});
  });
  const {document}=dom.window;
  await settle();
  assert.equal(document.documentElement.dataset.session,'error');
  assert.match(document.getElementById('sessionMessage').textContent,/انتهت جلستك/);
  assert.equal(document.querySelector('script[src="onboard.js?v=1.9.0"]'),null);
  document.getElementById('sessionRetry').click();
  await settle();
  assert.equal(document.documentElement.dataset.session,'ready');
  assert.equal(attempts,2);
  dom.window.close();
});
