export async function inventoryLegacyFlows({projects,employees,accounts,profiles,listFlows}){
  if(!Array.isArray(projects)||!Array.isArray(employees)||!Array.isArray(accounts)||!Array.isArray(profiles)||typeof listFlows!=='function')throw new Error('legacy_flow_ownership_incomplete');
  const linked=new Set(employees.filter(row=>row.activepieces_flow_id).map(row=>`${row.company_id}:${row.activepieces_flow_id}`));
  const accountCompanies=new Set(accounts.map(row=>row.company_id));
  const unadopted=[];
  let scannedFlows=0,customerProjects=0,orphanProjects=0,orphanProjectFlows=0;
  for(const project of projects){
    const byCompany=profiles.filter(row=>row.company_id===project.tenant_id);
    const byProject=profiles.filter(row=>row.activepieces_project_id===project.activepieces_project_id);
    if(byProject.some(row=>row.company_id!==project.tenant_id)||byCompany.some(row=>row.activepieces_project_id&&row.activepieces_project_id!==project.activepieces_project_id))throw new Error('legacy_flow_project_profile_mismatch');
    const customerOwned=accountCompanies.has(project.tenant_id)||byCompany.length>0||byProject.length>0;
    if(customerOwned)customerProjects++;else orphanProjects++;
    const flows=await listFlows(project.activepieces_project_id);
    if(!Array.isArray(flows)||flows.length>=100)throw new Error('legacy_flow_inventory_incomplete');
    for(const flow of flows){
      if(typeof flow.id!=='string'||flow.projectId!==project.activepieces_project_id)throw new Error('legacy_flow_project_mismatch');
      scannedFlows++;
      if(!customerOwned){
        if(linked.has(`${project.tenant_id}:${flow.id}`))throw new Error('legacy_flow_ownership_incomplete');
        orphanProjectFlows++;
        continue;
      }
      if(!linked.has(`${project.tenant_id}:${flow.id}`))unadopted.push({companyId:project.tenant_id,flowId:flow.id});
    }
  }
  return {projects:projects.length,customerProjects,orphanProjects,scannedFlows,orphanProjectFlows,unadopted};
}
