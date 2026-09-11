import fs from 'node:fs';import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('preview-integrated.js',import.meta.url),'utf8');
const start=src.indexOf("row=await state.update(row.id,'registering'");const end=src.indexOf(' if(row.data.conversation_id)',start);assert.ok(start>0&&end>start);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const finalize=new AsyncFunction('row','plan','compact','built','state','body','registerDesignedEmployee455',src.slice(start,end)+'return row;');
for(const fail of [false,true]){
 let current={id:'design',state:'verifying',data:{}};let registered=false;const observed=[];
 const state={update:async(id,state,data)=>{observed.push(state);if(['awaiting_connections','needs_configuration'].includes(state))assert.ok(registered,'Final status must not precede employee registration');return current={id,state,data}}};
 const call=()=>finalize(current,{status:'awaiting_connections'},{status:'awaiting_connections'},{flowId:'flow'},state,{payload:{owner:'owner'}},async({design})=>{assert.equal(current.state,'registering');assert.equal(design.state,'awaiting_connections');if(fail)throw Error('storage failure');registered=true;return{id:'employee'}});
 if(fail){await assert.rejects(call,/storage failure/);assert.deepEqual(observed,['registering']);}else{const row=await call();assert.equal(row.data.employeeId,'employee');assert.deepEqual(observed,['registering','awaiting_connections']);}
}
console.log('PASS success is emitted only after registration; storage failure never reports completion');
