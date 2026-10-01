export async function inventoryLegacyFlows({projects,employees,listFlows}){
  const linked=new Set(employees.filter(row=>row.activepieces_flow_id).map(row=>`${row.company_id}:${row.activepieces_flow_id}`));
  const unadopted=[];
  let scannedFlows=0;
  for(const project of projects){
    const flows=await listFlows(project.activepieces_project_id);
    if(!Array.isArray(flows)||flows.length>=100)throw new Error('legacy_flow_inventory_incomplete');
    for(const flow of flows){
      if(typeof flow.id!=='string'||flow.projectId!==project.activepieces_project_id)throw new Error('legacy_flow_project_mismatch');
      scannedFlows++;
      if(!linked.has(`${project.tenant_id}:${flow.id}`))unadopted.push({companyId:project.tenant_id,flowId:flow.id});
    }
  }
  return {projects:projects.length,scannedFlows,unadopted};
}
