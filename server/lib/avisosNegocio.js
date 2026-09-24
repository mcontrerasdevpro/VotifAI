import { query } from '../db.js';
import { notificar } from './notificaciones.js';
import { obtenerPlan } from './planes.js';
import { fechaES } from './fechas.js';

// =========================================================================
// 📣 AVISOS DE NEGOCIO
// - Al despacho: bienvenida al registrarse y recordatorio antes de que
//   acabe la prueba.
// - A NexuraIA (ALERTAS_EMAIL): registro, pago, cambio de plan y
//   cancelación, para hacer seguimiento comercial.
// Todos son de cortesía: si fallan se anotan en el log y no interrumpen el
// registro, el pago ni nada de lo que los provoca.
// =========================================================================

const emailAlertas = () => process.env.ALERTAS_EMAIL || process.env.DEMO_NOTIFICATION_EMAIL || 'contacto@nexuraia.com';
const urlApp = () => (process.env.CORS_ORIGIN || 'https://votifai.nexuraia.com').split(',')[0].trim();

async function enviar(tipo, destinatario, titulo, cuerpo) {
  try {
    await notificar({ tipo, mensaje: { titulo, cuerpo }, destinatarios: [{ ...destinatario, canal_preferido: 'email' }] });
  } catch (err) {
    console.error(`Aviso de negocio "${tipo}" no enviado:`, err.message);
  }
}

function fichaDespacho(t) {
  return [
    `Despacho: ${t.nombre_entidad}`,
    `Responsable: ${t.nombre_responsable || '—'}`,
    `Email: ${t.email_maestro}`,
    `Teléfono: ${t.telefono || '—'}`,
    `CIF/NIF: ${t.cif || '—'}`,
    `Plan: ${obtenerPlan(t.plan_suscripcion).nombre}`
  ].join('\n');
}

async function despacho(tenantId) {
  const r = await query(
    `SELECT id, nombre_entidad, nombre_responsable, email_maestro, telefono, cif, plan_suscripcion, trial_fin
     FROM tenants WHERE id = $1`,
    [tenantId]
  );
  return r.rows[0] || null;
}

export async function avisarRegistro(tenantId) {
  const t = await despacho(tenantId);
  if (!t) return;
  const plan = obtenerPlan(t.plan_suscripcion).nombre;
  const fin = t.trial_fin ? fechaES(t.trial_fin) : 'dentro de 15 días';

  await Promise.all([
    enviar(
      'bienvenida_despacho',
      { nombre: t.nombre_responsable || t.nombre_entidad, email: t.email_maestro },
      'Bienvenido a VotifAI',
      `Hola ${t.nombre_responsable || ''},\n\n` +
        `Tu despacho ${t.nombre_entidad} ya está dado de alta en VotifAI. Tienes 15 días de prueba gratuita del plan ${plan}, hasta el ${fin}, sin necesidad de tarjeta.\n\n` +
        `Para empezar:\n` +
        `1. Da de alta tu primera comunidad (botón "Dar de alta nueva finca").\n` +
        `2. Completa su censo de propietarios con sus coeficientes.\n` +
        `3. Comparte con los vecinos el código de acceso de la comunidad para que creen su cuenta.\n` +
        `4. Convoca tu primera junta desde "Junta en vivo".\n\n` +
        `Entra en ${urlApp()} con tu email y tu contraseña. Si tienes cualquier duda, responde a este correo y te ayudamos.\n\n` +
        `Un saludo,\nEl equipo de VotifAI`
    ),
    enviar(
      'alerta_registro',
      { nombre: 'Equipo VotifAI', email: emailAlertas() },
      `Nuevo despacho registrado — ${t.nombre_entidad}`,
      `Se ha registrado un nuevo despacho (prueba del plan ${plan} hasta el ${fin}).\n\n${fichaDespacho(t)}`
    )
  ]);
}

export async function avisarPago(tenantId, plan) {
  const t = await despacho(tenantId);
  if (!t) return;
  await enviar(
    'alerta_pago',
    { nombre: 'Equipo VotifAI', email: emailAlertas() },
    `💶 Nueva suscripción — ${t.nombre_entidad} (${obtenerPlan(plan || t.plan_suscripcion).nombre})`,
    `Un despacho ha contratado VotifAI.\n\n${fichaDespacho({ ...t, plan_suscripcion: plan || t.plan_suscripcion })}`
  );
}

export async function avisarCambioPlan(tenantId, planAnterior, planNuevo) {
  const t = await despacho(tenantId);
  if (!t) return;
  await enviar(
    'alerta_cambio_plan',
    { nombre: 'Equipo VotifAI', email: emailAlertas() },
    `Cambio de plan — ${t.nombre_entidad}: ${obtenerPlan(planAnterior).nombre} → ${obtenerPlan(planNuevo).nombre}`,
    `Un despacho ha cambiado de plan.\n\n${fichaDespacho({ ...t, plan_suscripcion: planNuevo })}`
  );
}

export async function avisarCancelacion(tenantId) {
  const t = await despacho(tenantId);
  if (!t) return;
  await enviar(
    'alerta_cancelacion',
    { nombre: 'Equipo VotifAI', email: emailAlertas() },
    `⚠️ Suscripción cancelada — ${t.nombre_entidad}`,
    `Un despacho ha cancelado su suscripción (o Stripe la ha cancelado por impago). Pasa a modo consulta.\n\n${fichaDespacho(t)}`
  );
}

// Recordatorio a los despachos en prueba cuyo periodo termina en los
// próximos 3 días y aún no lo han recibido. Pensado para ejecutarse una vez
// al día (n8n → Schedule → POST /api/tareas/recordatorios-prueba).
export async function enviarRecordatoriosPrueba() {
  const r = await query(
    `SELECT id FROM tenants
     WHERE suscripcion_estado = 'trialing'
       AND trial_fin > now() AND trial_fin <= now() + INTERVAL '3 days'
       AND recordatorio_prueba_enviado_en IS NULL`
  );
  let enviados = 0;
  for (const { id } of r.rows) {
    const t = await despacho(id);
    const plan = obtenerPlan(t.plan_suscripcion).nombre;
    await enviar(
      'recordatorio_fin_prueba',
      { nombre: t.nombre_responsable || t.nombre_entidad, email: t.email_maestro },
      'Tu prueba de VotifAI termina pronto',
      `Hola ${t.nombre_responsable || ''},\n\n` +
        `Tu periodo de prueba del plan ${plan} termina el ${fechaES(t.trial_fin)}. Para seguir trabajando con normalidad, elige un plan en "Mi plan" (${urlApp()}/billing).\n\n` +
        `Si no contratas ningún plan, tus datos no se pierden: la cuenta pasa a modo consulta y podrás seguir viéndolos y descargarlos, pero no crear ni modificar nada hasta que actives un plan.\n\n` +
        `Si tienes dudas sobre qué plan te conviene, responde a este correo.\n\nUn saludo,\nEl equipo de VotifAI`
    );
    await query('UPDATE tenants SET recordatorio_prueba_enviado_en = now() WHERE id = $1', [id]);
    enviados++;
  }
  return enviados;
}
