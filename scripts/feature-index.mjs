import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'features/index.json'),'utf8'));
const features=catalog.features;

function normalize(value){
  return String(value||'').normalize('NFKC').toLowerCase()
    .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/[ًٌٍَُِّْـ]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}

function locate(entry){
  const absolute=path.resolve(root,entry.path);
  if(path.isAbsolute(entry.path)||!absolute.startsWith(root+path.sep))throw new Error(`unsafe path: ${entry.path}`);
  const lines=fs.readFileSync(absolute,'utf8').split('\n');
  const line=lines.findIndex(value=>value.includes(entry.anchor));
  if(line<0)throw new Error(`missing anchor: ${entry.path} :: ${entry.anchor}`);
  return `${entry.path}:${line+1}`;
}

function check(){
  if(catalog.repository!=='ALKHANFAR/t43'||!Array.isArray(features))throw new Error('invalid feature index');
  const states=new Set(['live','draft_pr','live_needs_change','gap','planned','illustrative']);
  const ids=new Set(),errors=[];
  for(const feature of features){
    if(!/^[a-z0-9_]+$/.test(feature.id)||ids.has(feature.id))errors.push(`invalid or duplicate id: ${feature.id}`);
    ids.add(feature.id);
    if(!feature.name||!feature.meaning||!states.has(feature.state)||!/^ABO-\d+$/.test(feature.linear)||!Array.isArray(feature.aliases)||!Array.isArray(feature.locations)||!feature.locations.length)errors.push(`incomplete feature: ${feature.id}`);
    for(const item of feature.locations||[]){
      if(!item.role||!item.path||!item.anchor){errors.push(`incomplete location: ${feature.id}`);continue;}
      try{locate(item);}catch(error){errors.push(`${feature.id}: ${error.message}`);}
    }
  }
  if(errors.length){for(const error of errors)console.error(error);process.exitCode=1;return false;}
  console.log(`Feature index valid: ${features.length} features, ${features.reduce((n,x)=>n+x.locations.length,0)} exact anchors.`);
  return true;
}

function search(query){
  const key=normalize(query);
  if(!key){console.error('Usage: node scripts/feature-index.mjs "موافقة الموظف"');process.exitCode=2;return;}
  let hits=features.map(feature=>{
    const terms=[feature.name,...feature.aliases].map(normalize);
    let score=terms.some(value=>value===key)?100:terms.some(value=>value.includes(key)||key.includes(value))?50:0;
    if(!score){const tokens=key.split(' ').filter(Boolean);score=tokens.reduce((n,token)=>n+(terms.some(value=>value.includes(token))?1:0),0);}
    return {feature,score};
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.feature.id.localeCompare(b.feature.id));
  if(!hits.length){console.log('No indexed feature matched. Search the repository with rg, then add the missing feature to features/index.json.');process.exitCode=1;return;}
  if(hits[0].score>=50)hits=hits.filter(item=>item.score>=50);
  for(const {feature} of hits){
    console.log(`\n${feature.name} [${feature.id}] — ${feature.state}`);
    console.log(feature.meaning);
    console.log(`Linear: https://linear.app/abo-eyad/issue/${feature.linear}`);
    if(feature.pr)console.log(`PR: ${feature.pr}`);
    for(const item of feature.locations)console.log(`  ${item.role}: ${locate(item)}`);
  }
}

if(process.argv[2]==='--check')check();else search(process.argv.slice(2).join(' '));
