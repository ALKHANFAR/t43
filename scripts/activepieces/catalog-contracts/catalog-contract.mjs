export const CATALOG_TABLE = 'TLds7DCVEHJ0CLRrJd6Gs';
export const CATALOG_FIELDS = ['operations_v1','contract_version','contract_status','contract_checked_at','contract_hash'];
export function outputPaths(schema){
 const paths=[];
 function visit(fields,prefix=''){
  for(const f of fields||[]){const part=f.value??f.key;if(typeof part!=='string'||!part)continue;
   const path=prefix+part;paths.push(path);
   if(f.children)visit(f.children,path+'.');
   if(f.listItems)visit(f.listItems,path+'[].');
  }
 }
 visit(schema?.fields);return [...new Set(paths)];
}
export function makeCatalogContract(piece){
 if(!piece?.name||!piece.version||!piece.actions||!piece.triggers)throw Error('invalid_piece_metadata');
 const operations=[];
 for(const [kind,items]of [['trigger',piece.triggers],['action',piece.actions]])for(const [id,op]of Object.entries(items)){
  operations.push({kind,id,audience:op.audience||'unspecified',agent_search_eligible:op.audience!=='human',label:op.displayName,description:String(op.description||'').slice(0,700),ai:op.aiMetadata||null,
   requires_connection:op.requireAuth!==false&&!!piece.auth,
   inputs:Object.entries(op.props||{}).filter(([,p])=>p.type!=='MARKDOWN').map(([name,p])=>({name,type:p.type,required:!!p.required,...(p.refreshers?{depends_on:p.refreshers}:{}),...(p.type==='DYNAMIC'?{schema_after_connection:true}:{})})),
   output_paths:outputPaths(op.outputSchema),output_evidence:op.outputSchema?'declared_schema':'not_declared',
   classification:op.classification||null});
 }
 return {schema:1,piece:piece.name,version:piece.version,scope:'operation_metadata_only',connection_verified:false,business_outcome_verified:false,
 source:'https://activepieces-p8l1-455.up.railway.app/api/v1/pieces/'+encodeURIComponent(piece.name)+'?version='+encodeURIComponent(piece.version),
 operations};
}
export function verifyCatalogContract(row,livePiece,now=Date.now()){
 let c;try{c=JSON.parse(row.operations_v1);}catch{return {ok:false,reason:'catalog_contract_missing'};}
 if(c.schema!==1||c.piece!==row.piece||c.piece!==livePiece.name||c.version!==livePiece.version||row.contract_version!==livePiece.version)return {ok:false,reason:'catalog_version_mismatch'};
 const at=Date.parse(row.contract_checked_at);if(!Number.isFinite(at)||now-at>86400000||at>now+60000)return {ok:false,reason:'catalog_stale'};
 if(row.contract_status!=='metadata_verified'||!Array.isArray(c.operations))return {ok:false,reason:'catalog_unverified'};
 return {ok:true,contract:c};
}
export function catalogCard(row,livePiece){
 // Human editorial metadata guides relevance; it never creates an executable capability.
 return {piece:livePiece.name,name:livePiece.displayName,description_ar:String(row?.desc_ar||''),roles:String(row?.roles||'').split(',').filter(Boolean),capability_ar:row?.capability_ar||'',category:row?.category||'',preference:row?.rank||null};
}
