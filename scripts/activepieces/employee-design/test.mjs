import assert from 'node:assert/strict';
import {validateDesign} from './factory-design.mjs';
const contracts=[{pieceName:'source',kind:'trigger',name:'new',version:'1',outputSchema:{fields:[{key:'value',value:'body.value'}]},props:{},authRequired:true},{pieceName:'sink',kind:'action',name:'save',version:'1',outputSchema:{fields:[{key:'id'}]},props:{value:{required:true,type:'SHORT_TEXT'},resource:{required:true,type:'DROPDOWN'}},authRequired:true}];
const needs=[{id:'receive'},{id:'save'}];const plan=()=>({original_goal:'goal',name:'employee',trigger:{pieceName:'source',triggerName:'new',input:{},covers:['receive'],reason:'receive',context_basis:{source:'user_goal',quote:'goal'}},steps:[{pieceName:'sink',actionName:'save',input:{value:'{{trigger.body.value}}'},covers:['save'],reason:'save',context_basis:{source:'user_goal',quote:'goal'}}],bindings:[{step:'step_1',property:'resource',type:'account_resource'}],missing:[],evidence:[{step:'step_1',metric:'saved record',check:'read record',output_path:'id'}]});
assert.equal(validateDesign(plan(),needs,contracts,'goal').status,'awaiting_connections');
for(const [change,error]of [[p=>p.original_goal='lost',/shape/],[p=>p.steps[0].actionName='invented',/unverified_operation/],[p=>p.steps[0].input.bogus='x',/unknown_property/],[p=>p.steps[0].input.value='{{step_1.id}}',/forward_reference/],[p=>p.evidence=[],/evidence_missing/]]){const p=plan();change(p);assert.throws(()=>validateDesign(p,needs,contracts,'goal'),error);}
let p=plan();p.bindings=[];assert.equal(validateDesign(p,needs,contracts,'goal').status,'needs_configuration');p=plan();p.steps[0].covers=[];assert.equal(validateDesign(p,needs,contracts,'goal').status,'needs_configuration');
console.log('PASS 8: connection deferral, exact goal, real operation, schema keys, references, evidence, missing inputs, coverage.');
const {canonicalDesignValue}=await import('./factory-design.mjs');
assert.equal(canonicalDesignValue("{{trigger['output'].message.subject}}"),canonicalDesignValue('{{trigger.message.subject}}'));
const strictContracts=structuredClone(contracts);strictContracts[0].outputSchema={fields:[{value:'message.subject'}]};
p=plan();assert.throws(()=>validateDesign(p,needs,strictContracts,'goal'),/output_reference_not_in_schema/);p.steps[0].input.value='{{trigger.message.subject}}';assert.equal(validateDesign(p,needs,strictContracts,'goal').status,'awaiting_connections');
console.log('PASS 3 output-schema and native reference normalization checks.');
