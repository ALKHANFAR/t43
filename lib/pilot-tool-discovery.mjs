import {TenantProjectError} from './tenant-projects.mjs';

// Versions come from the checked-in pieces.js snapshot, not a claim about the live instance.
export const PILOT_PIECES=Object.freeze([
  {name:'@activepieces/piece-gmail',snapshotVersion:'0.15.0'},
  {name:'@activepieces/piece-google-calendar',snapshotVersion:'0.10.3'},
  {name:'@activepieces/piece-google-sheets',snapshotVersion:'0.16.11'},
]);
const ID=/^[0-9A-Za-z]{21}$/;
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const field=value=>typeof value==='string'?value:'';

function operation(name,definition,type,pieceAuth){
  const props=isObject(definition.props)?definition.props:null;
  const output=isObject(definition.outputSchema)&&Array.isArray(definition.outputSchema.fields)?definition.outputSchema:null;
  const metadata=isObject(definition.aiMetadata)?definition.aiMetadata:null;
  const classification=['READ','WRITE','DESTRUCTIVE'].includes(definition.classification)?definition.classification:'unknown';
  return {
    name,type,displayName:field(definition.displayName),description:field(definition.description),
    aiDescription:field(metadata?.description)||null,
    idempotent:typeof metadata?.idempotent==='boolean'?metadata.idempotent:null,
    audience:type==='action'&&['human','ai','both'].includes(definition.audience)?definition.audience:type==='action'?'unknown':null,
    classification,approval:'unknown',
    connectionRequired:typeof definition.requireAuth==='boolean'?definition.requireAuth:definition.auth!=null||pieceAuth!=null?true:definition.auth===null&&pieceAuth===null?false:null,
    inputs:props?Object.entries(props).map(([key,p])=>({name:key,type:field(p?.type)||'unknown',required:typeof p?.required==='boolean'?p.required:null,dynamic:p?.type==='DYNAMIC'||p?.type==='STATIC_DROPDOWN'&&p?.options?.type==='DYNAMIC'})):null,
    outputFields:output?output.fields.filter(p=>isObject(p)&&typeof p.key==='string').map(p=>({key:p.key,label:field(p.label)||null,value:field(p.value)||null})):[],
    outputSource:output?'activepieces.piece_detail.operation.outputSchema':'unknown',
    sources:{inputs:props?'activepieces.piece_detail.operation.props':'unknown',aiMetadata:metadata?'activepieces.piece_detail.operation.aiMetadata':'unknown',classification:classification==='unknown'?'unknown':'activepieces.piece_detail.operation.classification',audience:type==='trigger'?null:['human','ai','both'].includes(definition.audience)?'activepieces.piece_detail.operation.audience':'unknown',connectionRequired:typeof definition.requireAuth==='boolean'?'activepieces.piece_detail.operation.requireAuth':definition.auth!=null||pieceAuth!=null||definition.auth===null&&pieceAuth===null?'activepieces.piece_detail.auth':'unknown'},
    status:props&&output?.fields.length&&classification!=='unknown'?'described':'unknown',
    eligibleForExecution:false,
  };
}

function pieceResult(config,summary,detail,connections){
  if(!summary)return {pieceName:config.name,snapshotVersion:config.snapshotVersion,status:'no_match',source:'activepieces.pieces_list',operations:[],connections:[]};
  if(summary.name!==config.name)throw new TenantProjectError('pilot_piece_mismatch','أعاد مزود الأدوات قطعة أخرى.',502);
  const version=field(summary.version),versionDrift=!!version&&version!==config.snapshotVersion;
  if(detail&&(detail.name!==config.name||detail.version!==version))throw new TenantProjectError('pilot_piece_detail_mismatch','تعريف الأداة لا يطابق اسمها ونسختها.',502);
  const actions=isObject(detail?.actions)?detail.actions:null,triggers=isObject(detail?.triggers)?detail.triggers:null;
  const owned=connections.filter(c=>c.pieceName===config.name).map(c=>({id:c.id,status:c.status,pieceVersion:field(c.pieceVersion)||null,versionMatches:!!version&&c.pieceVersion===version}));
  const operations=[...(actions?Object.entries(actions).filter(([,v])=>isObject(v)).map(([n,v])=>operation(n,v,'action',detail.auth)):[]),...(triggers?Object.entries(triggers).filter(([,v])=>isObject(v)).map(([n,v])=>operation(n,v,'trigger',detail.auth)):[])];
  const schemaStatus=actions&&triggers?'observed':'unknown';
  return {pieceName:config.name,snapshotVersion:config.snapshotVersion,snapshotSource:'pieces.js',liveVersion:version||null,versionDrift,schemaStatus,status:schemaStatus==='unknown'?'unknown':versionDrift?'version_drift':'observed',summarySource:'activepieces.pieces_list',summaryCounts:{actions:Number.isInteger(summary.actions)?summary.actions:null,triggers:Number.isInteger(summary.triggers)?summary.triggers:null},detailSource:detail?'activepieces.piece_detail':'unknown',operations,connections:owned,connectionsSource:'activepieces.project_connections',eligibleForExecution:false};
}

export function createPilotToolDiscovery({requireProject,fetchImpl=fetch,activepiecesUrl,apiKey}){
  if(typeof requireProject!=='function')throw new TypeError('requireProject is required');
  const base=String(activepiecesUrl||'').replace(/\/$/,'');
  async function get(path){
    if(!base||!apiKey)throw new TenantProjectError('provider_not_configured','جرد الأدوات غير مهيأ.',503);
    const response=await fetchImpl(base+path,{headers:{Authorization:`Bearer ${apiKey}`}});
    if(!response.ok)throw new TenantProjectError('pilot_discovery_provider_error','تعذّر قراءة جرد الأدوات.',502);
    return response.json();
  }
  async function connections(projectId){
    const rows=[],seen=new Set();let cursor=null;
    for(let page=0;page<20;page++){
      const query=new URLSearchParams({projectId,scope:'PROJECT',limit:'100'});
      if(cursor)query.set('cursor',cursor);
      const result=await get(`/api/v1/app-connections?${query}`);
      if(!Array.isArray(result?.data))throw new TenantProjectError('pilot_connections_unknown','قائمة الاتصالات غير مكتملة.',502);
      for(const c of result.data){
        if(c?.scope!=='PROJECT'||!Array.isArray(c.projectIds)||c.projectIds.length!==1||c.projectIds[0]!==projectId)throw new TenantProjectError('connection_project_mismatch','رفضت سيادة اتصالًا لا يخص هذه الشركة وحدها.',403);
        if(!ID.test(field(c.id)))throw new TenantProjectError('pilot_connections_unknown','معرّف اتصال غير صالح.',502);
        rows.push(c);
      }
      if(!result.next)return rows;
      if(typeof result.next!=='string'||seen.has(result.next))break;
      seen.add(result.next);cursor=result.next;
    }
    throw new TenantProjectError('pilot_connections_unknown','قائمة الاتصالات غير مكتملة.',502);
  }
  async function inspect(tenantId){
    const projectId=await requireProject(tenantId);
    if(!ID.test(field(projectId)))throw new TenantProjectError('project_not_ready','مشروع العميل غير مجهز.',409);
    const scoped=await connections(projectId);
    const pieces=[];
    for(const config of PILOT_PIECES){
      const query=new URLSearchParams({searchQuery:config.name.replace('@activepieces/piece-',''),includeHidden:'true',limit:'20'});
      const result=await get(`/api/v1/pieces?${query}`);
      const rows=Array.isArray(result)?result:Array.isArray(result?.data)?result.data:null;
      if(!rows)throw new TenantProjectError('pilot_piece_lookup_unknown','تعذّر التحقق من تعريف الأداة.',502);
      const found=rows.find(p=>p?.name===config.name);
      if(!found){pieces.push(pieceResult(config,null,null,scoped));continue;}
      const version=field(found.version);
      const detail=version?await get(`/api/v1/pieces/${config.name}?version=${encodeURIComponent(version)}`):null;
      pieces.push(pieceResult(config,found,isObject(detail)?detail:null,scoped));
    }
    return {status:'read_only_inventory',projectScoped:true,searchSource:'exact_piece_lookup',semanticSearch:'not_checked',pieces};
  }
  return {inspect};
}
