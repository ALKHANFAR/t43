import test from 'node:test';
import assert from 'node:assert/strict';
import {runNativeContextProbe,AP_CONTEXT_SOURCE} from './native-context-probe.mjs';
test('native context probe without a source checkout reports unavailable with zero checks',async()=>{
 assert.deepEqual(await runNativeContextProbe({sourceRoot:null}),{mode:'unavailable',reason:'ACTIVEPIECES_SOURCE_ROOT_required',checksRun:0});
 assert.equal(AP_CONTEXT_SOURCE,'23e0c254979c73cfbfbde00242668ee873e79508');
});
