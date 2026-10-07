import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const required=['provider_inventory','provider_plans','no_training_controls','gateway_routing','google_scopes','limited_use_publication','current_demo'];
const https=value=>{try{return new URL(value).protocol==='https:';}catch{return false;}};

// This checks evidence completeness. It does not certify a provider's behavior.
export function reviewReadiness(packet,{now=new Date()}={}){
  const failures=[];
  if(packet?.schemaVersion!==1||packet?.repository!=='ALKHANFAR/t43')failures.push('invalid_packet');
  if(!/^[a-f0-9]{40}$/.test(packet?.deployment?.commit||''))failures.push('production_commit_missing');
  if(!Array.isArray(packet?.providers)||!packet.providers.length)failures.push('provider_inventory_empty');
  const ids=new Set();
  for(const provider of packet?.providers||[]){
    if(!provider.id||ids.has(provider.id))failures.push('invalid_provider_id');
    ids.add(provider.id);
    if(!provider.plan?.trim()||!provider.planEvidence?.trim())failures.push(`${provider.id}:plan_unverified`);
    if(!Array.isArray(provider.endpoints)||!provider.endpoints.length||provider.endpoints.some(endpoint=>!https(endpoint.url)||!Array.isArray(endpoint.models)||!endpoint.models.length))failures.push(`${provider.id}:endpoints_missing`);
    // N/A is not an escape hatch when a provider can receive Google-derived data.
    if(provider.googleDataExposure!=='isolated'&&provider.googleDataExposure!=='no_training')failures.push(`${provider.id}:google_data_exposure_unverified`);
    if(!provider.controlEvidence?.trim())failures.push(`${provider.id}:control_evidence_missing`);
  }
  for(const id of required){
    const matches=(packet?.gates||[]).filter(gate=>gate.id===id);
    if(matches.length!==1){failures.push(`${id}:gate_missing_or_duplicate`);continue;}
    const gate=matches[0],at=new Date(gate.verifiedAt),expires=new Date(gate.validUntil);
    if(gate.status!=='verified'||!gate.evidence?.trim()||!gate.reviewer?.trim()||!Number.isFinite(at.getTime())||at>now||!Number.isFinite(expires.getTime())||expires<=now||expires<=at||gate.commit!==packet.deployment?.commit)failures.push(`${id}:not_verified_for_current_release`);
  }
  return {ready:failures.length===0,failures,meaning:'Evidence completeness only; not Google approval or a no-training certification.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const packet=JSON.parse(readFileSync(process.argv[2]||new URL('../docs/google-review/ai-evidence.json',import.meta.url),'utf8'));
    const result=reviewReadiness(packet);console.log(JSON.stringify(result,null,2));process.exitCode=result.ready?0:1;
  }catch{console.error('Cannot read the Google review evidence packet.');process.exitCode=2;}
}
