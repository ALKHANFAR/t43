const PROJECT_ID=/^[0-9A-Za-z]{21}$/;
const TENANT_ID=/^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;

export class TenantProjectError extends Error{
  constructor(code,message,status=500){super(message);this.name='TenantProjectError';this.code=code;this.status=status;}
}

function cleanName(value){
  const name=String(value||'').trim().replace(/[./]/g,'-').slice(0,120);
  if(!name)throw new TenantProjectError('invalid_display_name','اسم العميل مطلوب.',400);
  return name;
}

function projectFrom(body,externalId){
  const rows=Array.isArray(body?.data)?body.data:[];
  const exact=rows.find(project=>project?.externalId===externalId);
  if(!exact)return null;
  if(!PROJECT_ID.test(String(exact.id||'')))throw new TenantProjectError('invalid_provider_project','أعاد Activepieces مشروعًا غير صالح.',502);
  return exact;
}

export function createTenantProjectService({query,fetchImpl=fetch,activepiecesUrl,apiKey}){
  const base=String(activepiecesUrl||'').replace(/\/$/,'');
  const inFlight=new Map();
  if(typeof query!=='function')throw new TypeError('query is required');

  async function provider(path,options={}){
    if(!base||!apiKey)throw new TenantProjectError('provider_not_configured','بوابة Activepieces غير مهيأة.',503);
    const response=await fetchImpl(base+path,{...options,headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json',...(options.headers||{})}});
    const body=await response.json().catch(()=>({}));
    if(!response.ok){
      if(response.status===401)throw new TenantProjectError('provider_unauthorized','مفتاح Activepieces مرفوض.',502);
      if(response.status===402||response.status===403)throw new TenantProjectError('team_plan_required','تفعيل باقة Team مطلوب لإنشاء مشاريع العملاء.',409);
      throw new TenantProjectError('provider_error','تعذّر تنفيذ طلب Activepieces.',502);
    }
    return body;
  }

  async function init(){
    await query(`CREATE TABLE IF NOT EXISTS siyadah_tenant_projects (
      tenant_id varchar(128) PRIMARY KEY,
      external_id varchar(160) UNIQUE NOT NULL,
      activepieces_project_id varchar(21) UNIQUE,
      display_name varchar(120) NOT NULL,
      provision_status varchar(24) NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async function read(tenantId){
    if(!TENANT_ID.test(String(tenantId||'')))throw new TenantProjectError('invalid_tenant','معرّف العميل غير صالح.',400);
    const result=await query('SELECT tenant_id, external_id, activepieces_project_id, display_name, provision_status FROM siyadah_tenant_projects WHERE tenant_id=$1',[tenantId]);
    return result.rows?.[0]||null;
  }

  async function save({tenantId,externalId,projectId,displayName}){
    const result=await query(`INSERT INTO siyadah_tenant_projects
      (tenant_id,external_id,activepieces_project_id,display_name,provision_status)
      VALUES ($1,$2,$3,$4,'ready')
      ON CONFLICT (tenant_id) DO UPDATE SET
        external_id=EXCLUDED.external_id,
        activepieces_project_id=EXCLUDED.activepieces_project_id,
        display_name=EXCLUDED.display_name,
        provision_status='ready',
        updated_at=now()
      RETURNING tenant_id,external_id,activepieces_project_id,display_name,provision_status`,[tenantId,externalId,projectId,displayName]);
    return result.rows[0];
  }

  async function ensureOnce({tenantId,displayName}){
    if(!TENANT_ID.test(String(tenantId||'')))throw new TenantProjectError('invalid_tenant','معرّف العميل غير صالح.',400);
    const name=cleanName(displayName), externalId=`siyadah:${tenantId}`;
    const existing=await read(tenantId);
    if(existing?.provision_status==='ready'&&PROJECT_ID.test(String(existing.activepieces_project_id||'')))return {...existing,created:false};

    const listed=await provider(`/api/v1/projects?externalId=${encodeURIComponent(externalId)}&limit=2`);
    let project=projectFrom(listed,externalId),created=false;
    if(!project){
      project=await provider('/api/v1/projects',{method:'POST',body:JSON.stringify({displayName:name,externalId,metadata:{owner:'siyadah',tenantId}})});
      if(project.externalId!==externalId||!PROJECT_ID.test(String(project.id||'')))throw new TenantProjectError('invalid_provider_project','لم يؤكد Activepieces المشروع المطلوب.',502);
      created=true;
    }
    const row=await save({tenantId,externalId,projectId:project.id,displayName:name});
    return {...row,created};
  }

  function ensure(input){
    const key=String(input?.tenantId||'');
    if(inFlight.has(key))return inFlight.get(key);
    const pending=ensureOnce(input).finally(()=>inFlight.delete(key));
    inFlight.set(key,pending);return pending;
  }

  async function requireProject(tenantId){
    const row=await read(tenantId);
    if(!row||row.provision_status!=='ready'||!PROJECT_ID.test(String(row.activepieces_project_id||'')))throw new TenantProjectError('project_not_ready','مشروع العميل غير مجهز.',409);
    return row.activepieces_project_id;
  }

  return {init,read,ensure,requireProject};
}
