import test from 'node:test';
import assert from 'node:assert/strict';
import {createPilotToolDiscovery,PILOT_PIECES} from '../lib/pilot-tool-discovery.mjs';

const PROJECT='P'.repeat(21),FOREIGN='F'.repeat(21),CONNECTION='C'.repeat(21);
const reply=body=>({ok:true,json:async()=>body});
const operation={displayName:'Read record',description:'Read one record',classification:'READ',audience:'both',requireAuth:true,aiMetadata:{description:'Read the requested record',idempotent:true},props:{record:{type:'SHORT_TEXT',required:true},folder:{type:'DYNAMIC',required:false,secret:'do-not-return'}},outputSchema:{fields:[{key:'id',label:'Record ID'}]},secret:'do-not-return'};

function harness({foreign=false,shared=false,missing=false,drift=false,partial=false,loop=false,malformedPiece=false,missingSchemas=false,detailNameMismatch=false,detailVersionMismatch=false,connectionVersion='0.15.0'}={}){
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url,method:options.method||'GET'});
    const parsed=new URL(url);
    if(parsed.pathname.endsWith('/app-connections')){
      if(!parsed.searchParams.has('cursor'))return reply({data:[{id:CONNECTION,pieceName:PILOT_PIECES[0].name,pieceVersion:connectionVersion,scope:'PROJECT',projectIds:shared?[PROJECT,FOREIGN]:[foreign?FOREIGN:PROJECT],status:'ACTIVE',secret:'do-not-return'}],next:loop?'repeat':'second'});
      if(loop)return reply({data:[],next:'repeat'});
      return reply({data:partial?undefined:[],next:null});
    }
    if(parsed.pathname.includes('/pieces/')){
      const slug=parsed.pathname.split('piece-').at(-1),config=PILOT_PIECES.find(p=>p.name.endsWith(`piece-${slug}`));
      const requestedVersion=parsed.searchParams.get('version');
      const actions=slug==='gmail'?{read_record:operation}:slug==='google-calendar'?{send_message:{displayName:'Send',description:'Send a message',props:{to:{type:'SHORT_TEXT',required:true}},aiMetadata:{idempotent:false}}}:{};
      return reply({name:detailNameMismatch?'@activepieces/piece-other':config.name,version:detailVersionMismatch?'9.9.9':requestedVersion,auth:null,actions:missingSchemas?undefined:actions,triggers:missingSchemas?undefined:{new_record:{displayName:'New record',props:{},classification:'READ',outputSchema:{fields:[{key:'id'}]}}}});
    }
    if(parsed.pathname.endsWith('/pieces')){
      if(malformedPiece)return reply({error:'unavailable'});
      const slug=parsed.searchParams.get('searchQuery');
      if(missing&&slug==='google-calendar')return reply([{name:'@activepieces/piece-other',version:'1.0.0'}]);
      const config=PILOT_PIECES.find(p=>p.name.endsWith(`piece-${slug}`));
      return reply([{name:config.name,version:drift&&slug==='gmail'?'0.16.0':config.snapshotVersion,actions:slug==='gmail'?1:0,triggers:1}]);
    }
    throw new Error(`unexpected ${url}`);
  };
  const service=createPilotToolDiscovery({requireProject:async tenant=>tenant==='company-a'?PROJECT:FOREIGN,fetchImpl,activepiecesUrl:'https://ap.example',apiKey:'test-key'});
  return {service,calls};
}

test('pilot inventory reads three exact pieces and paginated tenant connections without running an action',async()=>{
  const {service,calls}=harness();const inventory=await service.inspect('company-a');
  assert.equal(inventory.status,'read_only_inventory');assert.equal(inventory.semanticSearch,'not_checked');
  assert.equal(inventory.pieces.length,3);assert.ok(calls.every(c=>c.method==='GET'));
  assert.ok(calls.every(c=>new URL(c.url).pathname.includes('/pieces')||new URL(c.url).searchParams.get('projectId')===PROJECT));
  assert.equal(calls.filter(c=>new URL(c.url).pathname.includes('/pieces/')).length,3);
  const gmail=inventory.pieces[0],read=gmail.operations.find(x=>x.name==='read_record');
  assert.equal(gmail.status,'observed');assert.equal(gmail.connections[0].versionMatches,true);
  assert.equal(gmail.summaryCounts.actions,1);assert.equal(gmail.detailSource,'activepieces.piece_detail');
  assert.equal(read.inputs.find(p=>p.name==='record').required,true);
  assert.equal(read.inputs.find(p=>p.name==='folder').dynamic,true);
  assert.equal(read.idempotent,true);assert.equal(read.outputSource,'activepieces.piece_detail.operation.outputSchema');
  assert.equal(read.connectionRequired,true);assert.equal(read.sources.connectionRequired,'activepieces.piece_detail.operation.requireAuth');
  assert.equal(read.eligibleForExecution,false);assert.ok(!JSON.stringify(inventory).includes('do-not-return'));
  const send=inventory.pieces[1].operations.find(x=>x.name==='send_message');
  assert.equal(send.status,'unknown');assert.equal(send.outputSource,'unknown');assert.equal(send.classification,'unknown');
  assert.equal(send.idempotent,false);
});

test('a piece absent from exact provider results is no-match; changed version remains a drift',async()=>{
  const {service}=harness({missing:true,drift:true,connectionVersion:'0.14.0'});const inventory=await service.inspect('company-a');
  assert.equal(inventory.pieces[0].status,'version_drift');
  assert.equal(inventory.pieces[0].connections[0].versionMatches,false);
  assert.equal(inventory.pieces[1].status,'no_match');
  assert.deepEqual(inventory.pieces[1].operations,[]);
  assert.equal(inventory.pieces[0].liveVersion,'0.16.0');
  assert.ok(inventory.pieces.every(p=>p.eligibleForExecution!==true));
});

test('foreign connection is rejected even when returned under the requested project filter',async()=>{
  const {service,calls}=harness({foreign:true});
  await assert.rejects(()=>service.inspect('company-a'),error=>error.code==='connection_project_mismatch'&&error.status===403);
  assert.equal(calls.some(c=>c.url.includes('/pieces')),false);
});

test('a connection shared with another project is not counted as company-owned',async()=>{
  const {service}=harness({shared:true});
  await assert.rejects(()=>service.inspect('company-a'),error=>error.code==='connection_project_mismatch'&&error.status===403);
});

test('incomplete or looping connection pages never become an empty-connection assertion',async()=>{
  for(const config of [{partial:true},{loop:true}]){
    const {service}=harness(config);
    await assert.rejects(()=>service.inspect('company-a'),error=>error.code==='pilot_connections_unknown');
  }
});

test('malformed piece response is unknown, not a false no-match',async()=>{
  const {service}=harness({malformedPiece:true});
  await assert.rejects(()=>service.inspect('company-a'),error=>error.code==='pilot_piece_lookup_unknown');
});

test('detail name or version mismatch is rejected before its schema is shown',async()=>{
  for(const config of [{detailNameMismatch:true},{detailVersionMismatch:true}]){
    const {service}=harness(config);
    await assert.rejects(()=>service.inspect('company-a'),error=>error.code==='pilot_piece_detail_mismatch');
  }
});

test('count-only list and detail without operation schemas stays unknown',async()=>{
  const {service}=harness({missingSchemas:true});const inventory=await service.inspect('company-a');
  assert.equal(inventory.pieces[0].summaryCounts.actions,1);
  assert.equal(inventory.pieces[0].schemaStatus,'unknown');
  assert.equal(inventory.pieces[0].status,'unknown');
  assert.deepEqual(inventory.pieces[0].operations,[]);
});
