import { query } from '../db.js';
import { obtenerPlan } from './planes.js';

export async function obtenerEstadoSuscripcion(tenantId) {
  const [tenantResult, entidadesResult] = await Promise.all([
    query(
      `SELECT plan_suscripcion, suscripcion_estado, trial_inicio, trial_fin, suscripcion_periodo_fin
       FROM tenants WHERE id = $1`,
      [tenantId]
    ),
    query('SELECT COUNT(*)::int AS total FROM entities WHERE tenant_id = $1', [tenantId])
  ]);

  const tenant = tenantResult.rows[0];
  if (!tenant) return null;

  const plan = obtenerPlan(tenant.plan_suscripcion);
  const finTrial = tenant.trial_fin ? new Date(tenant.trial_fin) : null;
  const trialCaducado = tenant.suscripcion_estado === 'trialing' && finTrial && finTrial < new Date();
  const fincasUsadas = entidadesResult.rows[0].total;

  return {
    plan: tenant.plan_suscripcion,
    nombrePlan: plan.nombre,
    estado: trialCaducado ? 'expired' : tenant.suscripcion_estado,
    trialInicio: tenant.trial_inicio,
    trialFin: tenant.trial_fin,
    periodoFin: tenant.suscripcion_periodo_fin,
    uso: { fincas: fincasUsadas },
    limites: { fincas: plan.maxFincas, propietariosPorFinca: plan.maxPropietariosPorFinca },
    puedeCrearFinca: !trialCaducado && (plan.maxFincas === null || fincasUsadas < plan.maxFincas)
  };
}

export async function exigirCapacidadFinca(tenantId) {
  const estado = await obtenerEstadoSuscripcion(tenantId);
  if (!estado) return { ok: false, status: 404, error: 'Despacho no encontrado.' };
  if (estado.estado === 'expired') {
    return { ok: false, status: 402, error: 'Tu periodo de prueba ha terminado. Elige un plan para continuar.' };
  }
  if (!estado.puedeCrearFinca) {
    return { ok: false, status: 402, error: `Has alcanzado el límite de fincas del plan ${estado.nombrePlan}.` };
  }
  return { ok: true, estado };
}