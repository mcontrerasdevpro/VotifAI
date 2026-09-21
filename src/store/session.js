export function normalizeTenant(tenant) {
  if (!tenant) return null;

  const admin = tenant.admin || {};

  return {
    tenantId: tenant.id || tenant.tenantId,
    nombreEntidad: tenant.nombre_entidad || tenant.nombreEntidad || 'Despacho Profesional',
    email: tenant.email_maestro || tenant.email || '',
    tipoOrganizacion: tenant.tipo_organizacion || tenant.tipoOrganizacion || 'administrador',
    plan: tenant.plan_suscripcion || tenant.plan || 'trial_15_dias',
    admin: {
      nombre: admin.nombre || tenant.nombre_responsable || tenant.admin_nombre || tenant.adminNombre || tenant.nombre || 'Admin General',
      despacho: admin.despacho || tenant.nombre_entidad || tenant.nombreEntidad || 'Despacho Administrador'
    },
    comunidades: tenant.comunidades || []
  };
}

export function hasActiveTenant(tenant) {
  if (!tenant) return false;
  if (tenant.tenantId || tenant.id) return true;
  if (tenant.admin && (tenant.admin.nombre || tenant.admin.despacho)) return true;
  return false;
}

export function loadStoredTenant() {
  const saved = globalThis.localStorage?.getItem('votifai_tenant');
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved);
    if (!parsed) return null;
    return normalizeTenant(parsed);
  } catch {
    return null;
  }
}
