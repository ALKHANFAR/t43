import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const pages=['index.html','ar.html','auth.html','integrations.html','demo.html','demo-en.html','privacy.html','404.html','app/chat.html','app/onboard.html'];

test('customer pages share one appearance contract without local brand palette overrides',async()=>{
  const theme=await readFile(new URL('../siyadah-theme.css',import.meta.url),'utf8');
  assert.match(theme,/--accent:#1029D1/);
  assert.match(theme,/--paper:#FFFFFF/);
  for(const page of pages){
    const html=await readFile(new URL('../'+page,import.meta.url),'utf8');
    assert.match(html,/data-theme="siyadah"/,page);
    assert.match(html,/href="(?:\.\.\/)?siyadah-theme\.css"/,page);
    assert.doesNotMatch(html,/#0B844B|#40E799|#F2FAF6/,page);
    assert.doesNotMatch(html,/:root\{[^}]*--accent:/,page);
  }
});
