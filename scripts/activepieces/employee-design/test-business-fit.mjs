import assert from'node:assert/strict';import{validateBusinessFit455}from'./business-fit.mjs';
const selected=[{id:'trigger'},{id:'step_1'}];assert.deepEqual(validateBusinessFit455({issues:[]},selected),[]);
const issue={type:'existing_system_unproven',step:'step_1',reason:'لم يثبت مصدر الطلبات'};assert.equal(validateBusinessFit455({issues:[issue]},selected).length,1);
for(const value of [null,{}, {issues:[{...issue,type:'invented'}]},{issues:[{...issue,step:'foreign_step'}]},{issues:[{...issue,reason:''}]}])assert.throws(()=>validateBusinessFit455(value,selected));assert.deepEqual(validateBusinessFit455({issues:[{...issue,untrusted_extra:'ignored'}]},selected),[issue]);console.log('PASS 8 business review contract checks');
