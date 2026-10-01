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
    connectionRequired:definition.auth!=null||pieceAuth!=null?true:definition.auth===null&&pieceAuth===null?false:null,
    inputs:props?Object.entries(props).map(([key,p])=>({name:key,type:field(p?.type)||'unknown',required:typeof p?.required==='boolean'?p.required:null,dynamic:p?.type==='DYNAMIC'||p?.type==='STATIC_DROPDOWN'&&p?.options?.type==='DYNAMIC'})):null,
    outputFields:output?output.fields.filter(p=>isObject(p)&&typeof p.key==='string').map(p=>({key:p.key,label:field(p.label)||null,value:field(p.value)||null})):[],
    outputSource:output?'piece.outputSchema':'unknown',
    sources:{inputs:props?'piece.operation.props':'unknown',aiMetadata:metadata?'piece.operation.aiMetadata':'unknown',classification:classification==='unknown'?'unknown':'piece.operation.classification',audience:type==='trigger'?null:['human','ai','both'].includes(definition.audience)?'piece.operation.audience':'unknown'},
    status:props&&output?.fields.length&&classification!=='unknown'?'described':'unknown',
    eligibleForExecution:false,
  };
}

function pieceResult(config,metadata,connections){
  if(!metadata)return {pieceName:config.name,snapshotVersion:config.snapshotVersion,status:'no_match',source:'activepieces.pieces',operations:[],connections:[]};
  if(metadata.name!==config.name)throw new TenantProjectError('pilot_piece_mismatch','أعاد مزود الأدوات قطعة أخرى.',502);
  const version=field(metadata.version),versionDrift=!!version&&version!==config.snapshotVersion;
  const actions=isObject(metadata.actions)?metadata.actions:null,triggers=isObject(metadata.triggers)?metadata.triggers:null;
  const owned=connections.filter(c=>c.pieceName===config.name).map(c=>({id:c.id,status:c.status,pieceVersion:field(c.pieceVersion)||null,versionMatches:!!version&&c.pieceVersion===version}));
  const operations=[...(actions?Object.entries(actions).filter(([,v])=>isObject(v)).map(([n,v])=>operation(n,v,'action',metadata.auth)):[]),...(triggers?Object.entries(triggers).filter(([,v])=>isObject(v)).map(([n,v])=>operation(n,v,'trigger',metadata.auth)):[])];
  return {pieceName:config.name,snapshotVersion:config.snapshotVersion,snapshotSource:'pieces.js',liveVersion:version||null,status:!version?'unknown':versionDrift?'version_drift':actions&&triggers?'observed':'unknown',source:'activepieces.pieces',operations,connections:owned,connectionsSource:'activepieces.project_connections',eligibleForExecution:false};
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
        if(c?.scope!=='PROJECT'||!Array.isArray(c.projectIds)||!c.projectIds.includes(projectId))throw new TenantProjectError('connection_project_mismatch','رفضت سيادة اتصالًا لا يخص هذه الشركة.',403);
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
      pieces.push(pieceResult(config,found,scoped));
    }
    return {status:'read_only_inventory',projectScoped:true,searchSource:'exact_piece_lookup',semanticSearch:'not_checked',pieces};
  }
  return {inspect};
}
