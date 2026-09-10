import {verifyCatalogContract} from './catalog-contract.mjs';
// Generic retrieval over the user's editable catalog plus versioned native metadata.
// Ranking proposes candidates. The planner and schema validator decide applicability.
export function searchTokens(text){
 return String(text||'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[_/.-]/g,' ').match(/[\p{L}\p{N}]+/gu)||[];
}
export function indexCatalog(rows,registry){
 const map=new Map(registry.filter(p=>!p.deprecated).map(p=>[p.name,p]));const seen=new Set(),documents=[],invalid=[];
 for(const row of rows){
  if(!row?.piece||seen.has(row.piece))throw Error('catalog_duplicate_or_invalid_piece');seen.add(row.piece);
  const live=map.get(row.piece);if(!live){invalid.push({piece:row.piece,reason:'missing_from_registry'});continue;}
  let contract;try{contract=typeof row.operations_v1==='string'?JSON.parse(row.operations_v1):row.operations_v1;}catch{}
  if(!verifyCatalogContract(row,live).ok){invalid.push({piece:live.name,reason:'contract_missing_or_version_changed'});continue;}
  for(const op of contract.operations){
   if(!['action','trigger'].includes(op.kind)||!op.id)throw Error('catalog_operation_invalid');
   const own=[op.id,op.label,op.description,op.ai?.description].filter(Boolean).join(' ');
   const contextual=[row.name,row.desc_ar,row.capability_ar,row.roles,row.category].join(' ');
   const tokens=searchTokens(own+' '+contextual),counts=new Map();for(const t of tokens)counts.set(t,(counts.get(t)||0)+1);
   documents.push({key:row.piece+':'+op.kind+':'+op.id,pieceName:row.piece,version:live.version,kind:op.kind,name:op.id,op,row,counts,length:tokens.length,own:new Set(searchTokens(own))});
  }
 }
 const df=new Map();for(const d of documents)for(const t of d.counts.keys())df.set(t,(df.get(t)||0)+1);
 return {documents,df,avgLength:documents.reduce((n,d)=>n+d.length,0)/Math.max(documents.length,1),invalid};
}
export function retrieveCatalog(index,{kind,query,explicitPiece=null,limit=8}){
 const terms=[...new Set(searchTokens(query))];const N=index.documents.length;
 return index.documents.filter(d=>d.kind===kind&&(!explicitPiece||d.pieceName===explicitPiece)).map(d=>{
  let score=0,operationHits=0;
  for(const t of terms){const tf=d.counts.get(t)||0;if(!tf)continue;const df=index.df.get(t)||0;const idf=Math.log(1+(N-df+0.5)/(df+0.5));score+=idf*(tf*2.2)/(tf+1.2*(0.25+0.75*d.length/index.avgLength));if(d.own.has(t))operationHits++;}
  return {...d,score,operationHits};
 }).filter(d=>d.score>0).sort((a,b)=>b.score-a.score||(Number(a.row.rank)||9)-(Number(b.row.rank)||9)||a.key.localeCompare(b.key)).slice(0,limit).map(d=>({key:d.key,pieceName:d.pieceName,version:d.version,kind:d.kind,name:d.name,source:'curated_catalog_operation',retrievalScore:Number(d.score.toFixed(4)),operationHits:d.operationHits,audience:d.op.audience,curated:{description_ar:d.row.desc_ar,roles:d.row.roles,capability_ar:d.row.capability_ar,rank:d.row.rank},operation:{label:d.op.label,description:d.op.description,ai:d.op.ai,classification:d.op.classification,output_evidence:d.op.output_evidence}}));
}
export function mergeCatalogCandidates(nativeHits,catalogHits,limit=10){
 const map=new Map();
 for(const [list,source]of [[nativeHits,'native'],[catalogHits,'catalog']])list.forEach((h,i)=>{const key=h.key||h.pieceName+':'+h.kind+':'+h.name;const old=map.get(key)||{...h,key,sources:[],fusion:0};old.sources.push(source);old.fusion+=1/(30+i+1);if(source==='catalog')Object.assign(old,{curated:h.curated,operation:h.operation});map.set(key,old);});
 return [...map.values()].sort((a,b)=>b.fusion-a.fusion).slice(0,limit);
}
