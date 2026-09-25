import { query } from '../db.js';
import { buzonParaEnvio, enviarConBuzon } from './correoDespacho.js';

// Capa de salida de las notificaciones.
//
// - Emails de un despacho a sus vecinos (llevan `envio: { area, tenantId |
//   entityId }`): si el despacho tiene conectado su buzón, salen desde su
//   propia cuenta por SMTP (lib/correoDespacho.js) y las respuestas le
//   llegan a él. Si aún no lo ha conectado, van por n8n con el nombre del
//   despacho como remitente y su email como dirección de respuesta.
// - WhatsApp y los emails propios de VotifAI (bienvenida, avisos, demo)
//   van siempre por el webhook de n8n, que decide el canal de cada
//   destinatario.
//
// Sin N8N_WEBHOOK_URL configurada, lo que iría a n8n solo se anota en el
// log (simulado) para no romper nada mientras no haya flujo montado.

const quiereWhatsapp = (d) => Boolean(d.telefono) && ['whatsapp', 'ambos'].includes(d.canal_preferido);

async function remitenteDespacho({ tenantId, entityId }) {
  const r = await query(
    `SELECT nombre_entidad, email_maestro FROM tenants
     WHERE id = COALESCE($1::uuid, (SELECT tenant_id FROM entities WHERE id = $2::uuid))`,
    [tenantId || null, entityId || null]
  );
  const t = r.rows[0];
  return t ? { nombre: t.nombre_entidad, responder_a: t.email_maestro } : null;
}

async function enviarAN8n(payload) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`\n📲 [Simulado — falta N8N_WEBHOOK_URL] Notificación "${payload.tipo}" para ${payload.finca?.nombre || 'finca'}:`);
    payload.destinatarios.forEach((d) => {
      console.log(`   ➔ ${d.nombre} (${d.propiedad || 's/p'}) — tel: ${d.telefono || '—'} · email: ${d.email || '—'}`);
    });
    if (payload.archivo_adjunto) console.log(`   📎 Adjunto: ${payload.archivo_adjunto.nombre}`);
    return false;
  }

  const respuesta = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`n8n respondió ${respuesta.status}: ${detalle.slice(0, 200)}`);
  }
  return true;
}

export async function notificar({ tipo, despacho, finca, mensaje, destinatarios, archivo_adjunto, envio }) {
  let paraN8n = destinatarios;
  let remitente = null;
  let propio = null;

  if (envio?.area) {
    const buzon = await buzonParaEnvio(envio);
    if (buzon) {
      const conEmail = destinatarios.filter((d) => d.email);
      const resultado = conEmail.length ? await enviarConBuzon(buzon, { mensaje, destinatarios: conEmail, archivo_adjunto }) : { enviados: 0, fallidos: [] };
      propio = { desde: buzon.email, ...resultado };
      // A n8n solo le queda el WhatsApp, sin email para que no lo duplique.
      paraN8n = destinatarios.filter(quiereWhatsapp).map((d) => ({ ...d, email: null }));
    } else {
      remitente = await remitenteDespacho(envio);
    }
  }

  let real = Boolean(propio);
  if (paraN8n.length) {
    const payload = { tipo, despacho, finca, mensaje, destinatarios: paraN8n, remitente, archivo_adjunto: archivo_adjunto || null, disparado_en: new Date().toISOString() };
    real = (await enviarAN8n(payload)) || real;
  }

  if (propio && propio.enviados === 0 && propio.fallidos.length) {
    throw new Error(`No se pudo enviar desde ${propio.desde}: ${propio.fallidos[0].error}`);
  }

  return { enviado: true, real, desde: propio?.desde || null, fallidos: propio?.fallidos || [] };
}
