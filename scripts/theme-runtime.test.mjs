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

test('account typography uses the shared bilingual type and measure roles',async()=>{
  const [theme,authCss]=await Promise.all([
    readFile(new URL('../siyadah-theme.css',import.meta.url),'utf8'),
    readFile(new URL('../auth-design.css',import.meta.url),'utf8'),
  ]);
  for(const font of ['Readex Pro','IBM Plex Sans Arabic','Jost','Inter'])assert.ok(theme.includes(font));
  for(const role of ['--type-display','--type-page','--type-body','--type-label','--space-4','--measure-form','--control-height'])assert.ok(theme.includes(role),role);
  assert.match(authCss,/\.story h2\{[^}]*var\(--type-display\)/);
  assert.match(authCss,/h1\{[^}]*var\(--type-page\)/);
  assert.match(authCss,/\.field input\{[^}]*var\(--type-control\)/);
});
