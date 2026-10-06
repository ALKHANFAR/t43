import {TenantProjectError} from './tenant-projects.mjs';

// This legacy REST inventory is deliberately closed. The chat already discovers
// tools and operation fields through its company-scoped native MCP session.
export function createPilotToolDiscovery({requireProject}){
  if(typeof requireProject!=='function')throw new TypeError('requireProject is required');
  async function inspect(tenantId){
    await requireProject(tenantId);
    throw new TenantProjectError('native_mcp_discovery_required','جرد الأدوات القديم غير متاح.',409);
  }
  return {inspect};
}
