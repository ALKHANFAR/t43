import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as nodeModule from 'node:module';
import {runInNewContext} from 'node:vm';
import {pathToFileURL} from 'node:url';
import {evaluateKnowledgeCase} from './knowledge-quality-eval.mjs';
import {workflow,REPORT_TOOL} from './employee-stress-eval.mjs';
import {bindEmployeeFlowContext} from '../lib/mcp-flow-scope.mjs';
export const AP_CONTEXT_SOURCE='23e0c254979c73cfbfbde00242668ee873e79508';

// Optional source-backed probe, never a second production engine or a live AP client.
export async function runNativeContextProbe({sourceRoot=process.env.ACTIVEPIECES_SOURCE_ROOT}={}){
 if(!sourceRoot)return {mode:'unavailable',reason:'ACTIVEPIECES_SOURCE_ROOT_required',checksRun:0};
 const {stripTypeScriptTypes}=nodeModule;
 if(typeof stripTypeScriptTypes!=='function')return {mode:'unavailable',reason:'typescript_stripping_runtime_required',checksRun:0};
 const sources=[];
 const read=path=>{const source=execFileSync('git',['show',`${AP_CONTEXT_SOURCE}:${path}`],{cwd:sourceRoot,encoding:'utf8',timeout:15000,env:{...process.env,GIT_NO_LAZY_FETCH:'1'}});sources.push({path,sha256:createHash('sha256').update(source).digest('hex')});return source;};
 const load=(source,symbols,expression)=>runInNewContext(stripTypeScriptTypes(source).replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')+'\n;'+expression,symbols);
 const isNil=value=>value===null||value===undefined,isString=value=>typeof value==='string';
 const objectHelpers=load(read('packages/core/utils/src/lib/object-utils.ts'),{isNil,isString},'({cloneResolvedValue,applyFunctionToValues})');
 const {extractMustacheTokens}=load(read('packages/core/utils/src/lib/mustache-utils.ts'),{},'({extractMustacheTokens})');
 const {propertyPath}=load(read('packages/server/engine/src/lib/variables/property-path.ts'),{isNil},'({propertyPath})');
 const {evalWithPropertyPath}=load(read('packages/server/engine/src/lib/variables/props-resolver.ts'),{isNil,propertyPath,cloneResolvedValue:objectHelpers.cloneResolvedValue,console:{warn:()=>{}},utils:{tryCatchAndThrowOnEngineError:async fn=>{try{return {data:await fn()};}catch(error){return {error};}}}},'({evalWithPropertyPath})');
 // Only direct dotted paths are exercised. Native JS/formula evaluation and jsep parsing are not run.
 async function resolveInput(input,trigger){
  return objectHelpers.applyFunctionToValues(input,async value=>{
   const tokens=extractMustacheTokens(value);let output='',end=0;
   for(const token of tokens){
    const path=token.inner.trim();if(!/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(path))throw Error('unsupported_probe_expression');
    const resolved=await evalWithPropertyPath({segments:path.split('.'),getStepView:async name=>name==='trigger'?trigger:undefined});
    if(tokens.length===1&&token.token===value)return resolved;
    output+=value.slice(end,token.index)+(isString(resolved)?resolved:JSON.stringify(resolved));end=token.index+token.token.length;
   }
   return output+value.slice(end);
  });
 }
 const template={prompt:'{{trigger.siyadahContext.context.selectedEmployee.instructions}}\n{{trigger.siyadahContext.context.knowledge.facts}}',company:'{{trigger.siyadahContext.context.company}}'};
 const results=[];let priorPrompt=null;
 for(const [price,instruction] of [['120','اشرح العرض بإيجاز.'],['240','اشرح تفاصيل العرض ومصادره.']]){
  const c=workflow({id:'native_input_'+price,effect:true});c.employeeFixture.prompt=instruction;c.employeeFixture.prompt_version=price==='120'?1:2;c.facts=[{key:'current_price',topic:'pricing',value:price,certainty:'user_confirmed'}];c.contextEvidence=['current_price'];
  const fixture=c.toolFixture;let observed;
  c.toolFixture=async(params,trace)=>{if(params.name===REPORT_TOOL)observed=await resolveInput(template,params.arguments);return fixture(params,trace);};
  let turn=0;const fetchImpl=async()=>({ok:true,status:200,json:async()=>({choices:[{message:turn++===0?{content:'',tool_calls:[{id:'invoke',function:{name:REPORT_TOOL,arguments:JSON.stringify({siyadahContext:{context:{company:{name:'forged'}}}})}}]}:{content:'{"status":"answered","answer":"350","evidence_keys":["verified_total"]}'}}]})});
  const r=await evaluateKnowledgeCase({testCase:c,chat:'employee',live:true,apiKey:'synthetic-provider',fetchImpl});
  const passed=r.context_passed&&r.workflow_passed&&observed?.prompt===instruction+'\n'+JSON.stringify([{topic:'pricing',key:'current_price',value:price,certainty:'user_confirmed'}])&&observed.company.name==='شركة اختبار اصطناعية';
  results.push({id:c.id,passed,checks:['saved_instructions','current_knowledge','server_owned_company'],syntheticInvocations:r.effects});
  if(priorPrompt!==null)results.push({id:'same_template_changes_with_context',passed:observed?.prompt!==priorPrompt});priorPrompt=observed?.prompt;
 }
 const sample={siyadahContext:{context:{selectedEmployee:{instructions:'saved'},knowledge:{facts:[{value:'120'}]}}}};
 const missing=await resolveInput({prompt:'{{trigger.missing.context.selectedEmployee.instructions}}'},sample);
 results.push({id:'missing_binding_is_not_instruction_delivery',passed:missing.prompt===''});
 const literal=await resolveInput({prompt:'Use company context.'},sample);
 results.push({id:'describing_context_does_not_insert_it',passed:literal.prompt==='Use company context.'&&!literal.prompt.includes('saved')});
 const textTool={inputSchema:{properties:{company_context:{type:'string',description:'[siyadah:context]'}}}};
 const textTrigger=bindEmployeeFlowContext(textTool,{company_context:'forged'},sample.siyadahContext);
 const textInput=await resolveInput({prompt:'Company context:\n{{trigger.company_context}}'},textTrigger);
 results.push({id:'native_text_binding_delivers_serialized_context',passed:textInput.prompt==='Company context:\n'+JSON.stringify(sample.siyadahContext)});
 const nestedText=await resolveInput({prompt:'{{trigger.company_context.context.selectedEmployee.instructions}}'},textTrigger);
 results.push({id:'nested_path_into_text_is_not_context_delivery',passed:nestedText.prompt===''});
 const clone=await resolveInput({input:'{{trigger.siyadahContext}}'},sample);clone.input.context.selectedEmployee.instructions='changed';
 results.push({id:'resolved_object_does_not_mutate_trigger',passed:sample.siyadahContext.context.selectedEmployee.instructions==='saved'});
 return {mode:'source_backed_native_path_resolution',sourceCommit:AP_CONTEXT_SOURCE,sources,checksRun:results.length,passed:results.filter(r=>r.passed).length,results,limits:['Scripted LLM, actual Siyadah chat loop; synthetic trigger execution state and run/profile services.','Executes native property-path lookup, clone and token helpers; dotted-path parsing and interpolation are probe adapters. Full jsep, formulas, script evaluation and engine orchestration are not exercised.','No AI provider call, live Activepieces run, delivery, business outcome or added production gate.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const r=await runNativeContextProbe();console.log(JSON.stringify(r,null,2));process.exitCode=r.mode==='unavailable'?2:r.passed===r.checksRun?0:1;}
 catch{console.log(JSON.stringify({mode:'unavailable',reason:'pinned_source_or_runtime_unavailable',checksRun:0}));process.exitCode=2;}
}
