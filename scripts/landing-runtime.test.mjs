import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('public access form distinguishes failed delivery from a sent request in both languages',async()=>{
  const js=await readFile(new URL('../site.js',import.meta.url),'utf8');
  assert.doesNotMatch(js,/cloud\.activepieces\.com|\/api\/v1\/webhooks\//);
  for(const page of ['index.html','ar.html']){
    const html=await readFile(new URL('../'+page,import.meta.url),'utf8');
    const dom=new JSDOM(html,{url:'https://siyadah.test/'+page,runScripts:'outside-only'}),w=dom.window;
    w.IntersectionObserver=class {observe(){} unobserve(){} disconnect(){}};
    w.matchMedia=()=>({matches:true});
    w.HTMLElement.prototype.scrollIntoView=()=>{};
    w.fetch=async()=>{throw new Error('network unavailable');};
    w.eval(js);
    w.document.querySelector('#name').value='Test Person';
    w.document.querySelector('#phone').value='5551234567';
    w.document.querySelector('#email').value='test@example.com';
    const form=w.document.querySelector('#waitlist');
    form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(w.document.querySelector('#sendError').hidden,false,page);
    assert.equal(w.document.querySelector('#done').classList.contains('on'),false,page);

    w.CONFIG.web3formsKey='notification-only';
    w.fetch=async url=>{
      if(url.includes('web3forms.com'))return {ok:true,json:async()=>({})};
      throw new Error('primary endpoint unavailable');
    };
    form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(w.document.querySelector('#done').classList.contains('on'),false,page);

    w.CONFIG.web3formsKey='';
    const requests=[];
    w.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({ok:true,status:'accepted'})};};
    form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(w.document.querySelector('#sendError').hidden,true,page);
    assert.equal(w.document.querySelector('#done').classList.contains('on'),true,page);
    assert.equal(requests.length,1,page);
    assert.equal(requests[0].url,'/siyadah-api/v1/waitlist',page);
    dom.window.close();
  }
});
