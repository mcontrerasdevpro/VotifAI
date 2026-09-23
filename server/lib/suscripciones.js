import { query } from '../db.js';
import { obtenerPlan } from './planes.js';

// Decide si un despacho puede seguir trabajando (crear/modificar datos) o
// queda en solo lectura hasta que pague. `past_due` mantiene el acceso:
// Stripe reintenta el cobro durante unos días y, si al final no lo
// consigue, manda customer.subscription.deleted → `canceled`. `incomplete`
// (primer pago pendiente) no le quita al despacho lo que le quede de prueba.
export function calcularAcceso({ suscripcion_estado: estado, trial_fin: trialFin }, ahora = new Date()) {
  const trialVigente = trialFin ? new Date(trialFin) > ahora : false;

  if (estado === 'active' || estado === 'past_due') return { estado, accesoCompleto: true };
  if (estado === 'trialing' || estado === 'incomplete') {
    if (trialVigente) return { estado, accesoCompleto: true };
    return { estado: estado === 'trialing' ? 'expired' : estado, accesoCompleto: false };
  }
  return { estado, accesoCompleto: false };
}

// Límites de la prueba gratuita: suficiente para celebrar dos juntas reales
// completas, sin que una prueba pueda generar un gasto de transcripción
// (OpenAI) sin techo. Solo aplican mientras no hay suscripción pagada.
export const LIMITES_PRUEBA = Object.freeze({ juntas: 2, horasVozPorJunta: 3 });

const esPrueba = (estado) => estado !== 'active' && estado !== 'past_due';

// Juntas "celebradas" = las que se llegaron a iniciar. Convocar o programar
// no cuenta. Sale del contador de la cuenta (tenants.juntas_iniciadas), que
// solo sube: contar las juntas existentes se reiniciaba borrando la finca.
async function contarJuntasIniciadas(tenantId) {
  const resultado = await query('SELECT juntas_iniciadas FROM tenants WHERE id = $1', [tenantId]);
  return resultado.rows[0]?.juntas_iniciadas ?? 0;
}

// `conPrueba`: añade el uso de la prueba (juntas celebradas). Solo lo pide
// la pantalla de plan; el middleware de solo lectura no lo necesita y se
// ahorra la consulta en cada escritura.
export async function obtenerEstadoSuscripcion(tenantId, { conPrueba = false } = {}) {
  const [tenantResult, entidadesResult] = await Promise.all([
    query(
      `SELECT plan_suscripcion, suscripcion_estado, trial_inicio, trial_fin, suscripcion_periodo_fin, proveedor_cliente_id
       FROM tenants WHERE id = $1`,
      [tenantId]
    ),
    query('SELECT COUNT(*)::int AS total FROM entities WHERE tenant_id = $1', [tenantId])
  ]);

  const tenant = tenantResult.rows[0];
  if (!tenant) return null;

  const plan = obtenerPlan(tenant.plan_suscripcion);
  const { estado, accesoCompleto } = calcularAcceso(tenant);
  const fincasUsadas = entidadesResult.rows[0].total;
  const prueba = conPrueba && esPrueba(tenant.suscripcion_estado)
    ? { juntasCelebradas: await contarJuntasIniciadas(tenantId), maxJuntas: LIMITES_PRUEBA.juntas, horasVozPorJunta: LIMITES_PRUEBA.horasVozPorJunta }
    : null;

  return {
    plan: tenant.plan_suscripcion,
    nombrePlan: plan.nombre,
    estado,
    accesoCompleto,
    trialInicio: tenant.trial_inicio,
    trialFin: tenant.trial_fin,
    periodoFin: tenant.suscripcion_periodo_fin,
    uso: { fincas: fincasUsadas },
    limites: { fincas: plan.maxFincas, propietariosPorFinca: plan.maxPropietariosPorFinca },
    transcripcionVoz: plan.transcripcionVoz,
    // Pagado de verdad (no prueba): decide si el plan cuenta como "actual"
    // en la pantalla de planes y si se ofrece el portal de Stripe.
    suscripcionPagada: estado === 'active' || estado === 'past_due',
    tieneClienteStripe: Boolean(tenant.proveedor_cliente_id),
    prueba,
    puedeCrearFinca: accesoCompleto && (plan.maxFincas === null || fincasUsadas < plan.maxFincas)
  };
}

export const MENSAJE_SIN_ACCESO = {
  expired: 'Tu periodo de prueba ha terminado. Elige un plan para seguir trabajando; tus datos siguen disponibles en modo consulta.',
  canceled: 'Tu suscripción está cancelada. Reactívala para seguir trabajando; tus datos siguen disponibles en modo consulta.',
  incomplete: 'El pago de tu suscripción no se ha completado. Complétalo para seguir trabajando; tus datos siguen disponibles en modo consulta.'
};

export async function exigirCapacidadFinca(tenantId) {
  const estado = await obtenerEstadoSuscripcion(tenantId);
  if (!estado) return { ok: false, status: 404, error: 'Despacho no encontrado.' };
  if (!estado.accesoCompleto) {
    return { ok: false, status: 402, error: MENSAJE_SIN_ACCESO[estado.estado] || MENSAJE_SIN_ACCESO.canceled };
  }
  if (!estado.puedeCrearFinca) {
    return { ok: false, status: 402, error: `Has alcanzado el límite de fincas del plan ${estado.nombrePlan}.` };
  }
  return { ok: true, estado };
}

export async function exigirCapacidadPropietarios(tenantId, entityId, nuevos = 1) {
  const [tenantResult, censoResult] = await Promise.all([
    query('SELECT plan_suscripcion FROM tenants WHERE id = $1', [tenantId]),
    query('SELECT COUNT(*)::int AS total FROM propietarios WHERE entity_id = $1::uuid', [String(entityId).trim()])
  ]);
  const tenant = tenantResult.rows[0];
  if (!tenant) return { ok: false, status: 404, error: 'Despacho no encontrado.' };

  const plan = obtenerPlan(tenant.plan_suscripcion);
  if (plan.maxPropietariosPorFinca !== null && censoResult.rows[0].total + nuevos > plan.maxPropietariosPorFinca) {
    return {
      ok: false,
      status: 402,
      error: `El plan ${plan.nombre} admite hasta ${plan.maxPropietariosPorFinca} propietarios por finca. Mejora tu plan para ampliar el censo.`
    };
  }
  return { ok: true };
}

// Lado vecino: la transcripción la paga el despacho de la finca, así que se
// decide con su plan (y con que su suscripción siga activa), no con nada
// que dependa del propio vecino.
export async function fincaPermiteTranscripcion(entityId) {
  const resultado = await query(
    `SELECT t.plan_suscripcion, t.suscripcion_estado, t.trial_fin
     FROM entities e JOIN tenants t ON t.id = e.tenant_id
     WHERE e.id = $1::uuid`,
    [String(entityId).trim()]
  );
  const tenant = resultado.rows[0];
  if (!tenant) return false;
  return obtenerPlan(tenant.plan_suscripcion).transcripcionVoz && calcularAcceso(tenant).accesoCompleto;
}

// Se llama dentro de la transacción que inicia la junta (`tx`): bloquea la
// fila del despacho (FOR UPDATE) para que dos juntas iniciadas a la vez no
// puedan pasar las dos el límite, y suma la junta al contador.
export async function reservarJuntaIniciada(tenantId, tx) {
  const resultado = await tx('SELECT suscripcion_estado, juntas_iniciadas FROM tenants WHERE id = $1 FOR UPDATE', [tenantId]);
  const tenant = resultado.rows[0];
  if (!tenant) return { ok: false, status: 404, error: 'Despacho no encontrado.' };

  if (esPrueba(tenant.suscripcion_estado) && tenant.juntas_iniciadas >= LIMITES_PRUEBA.juntas) {
    return {
      ok: false,
      status: 402,
      error: `La prueba gratuita incluye ${LIMITES_PRUEBA.juntas} juntas y ya las has celebrado. Contrata un plan para seguir celebrando juntas.`
    };
  }

  await tx('UPDATE tenants SET juntas_iniciadas = juntas_iniciadas + 1 WHERE id = $1', [tenantId]);
  return { ok: true };
}

// Lado vecino: toda intervención de voz pertenece a la junta en curso de
// la finca (y al punto del orden del día abierto en ese momento, si lo hay),
// así el panel y el acta muestran solo las de esa junta. Sin junta en curso
// no se graba. En prueba, además, la voz se limita a las primeras horas de
// la junta; la junta sigue (votos, cierre, acta), solo se corta la
// transcripción, que es lo que tiene coste por minuto.
export async function juntaParaVoz(entityId) {
  const id = String(entityId).trim();
  const [juntaResult, tenantResult] = await Promise.all([
    query(
      `SELECT m.id, m.iniciada_en,
              (SELECT p.id FROM meeting_puntos p WHERE p.meeting_id = m.id AND p.estado = 'votando'
               ORDER BY p.abierto_en DESC NULLS LAST LIMIT 1) AS punto_id
       FROM meetings m WHERE m.entity_id = $1::uuid AND m.estado = 'en_curso'
       ORDER BY m.iniciada_en DESC LIMIT 1`,
      [id]
    ),
    query('SELECT t.suscripcion_estado FROM entities e JOIN tenants t ON t.id = e.tenant_id WHERE e.id = $1::uuid', [id])
  ]);

  const junta = juntaResult.rows[0];
  if (!junta) {
    return { ok: false, codigo: 'SIN_JUNTA_EN_CURSO', error: 'Solo se pueden grabar intervenciones durante una junta en curso.' };
  }

  const tenant = tenantResult.rows[0];
  const limiteMs = LIMITES_PRUEBA.horasVozPorJunta * 3600 * 1000;
  if (tenant && esPrueba(tenant.suscripcion_estado) && Date.now() - new Date(junta.iniciada_en).getTime() > limiteMs) {
    return {
      ok: false,
      codigo: 'VOZ_LIMITE_PRUEBA',
      error: `Durante la prueba gratuita, la transcripción de voz está disponible en las ${LIMITES_PRUEBA.horasVozPorJunta} primeras horas de cada junta. La junta puede continuar con normalidad.`
    };
  }

  return { ok: true, meetingId: junta.id, puntoId: junta.punto_id || null };
}
