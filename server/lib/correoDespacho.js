import nodemailer from 'nodemailer';
import { query } from '../db.js';
import { descifrar } from './cifrado.js';

// =========================================================================
// ✉️ ENVÍO DESDE EL BUZÓN DEL DESPACHO
// Los emails a los vecinos de un despacho salen de su propia cuenta de
// correo (SMTP), no de VotifAI: el remitente es su dirección real y las
// respuestas le llegan a su buzón. Cada tipo de email pertenece a un área;
// el despacho decide qué buzón usa cada área y el principal cubre el resto.
// =========================================================================

export const AREAS = {
  juntas: 'Juntas: convocatorias, actas y delegaciones de voto',
  accesos: 'Cuentas de vecinos: activación y recuperación de contraseña'
};

export const PROVEEDORES = ['gmail', 'microsoft365', 'outlook', 'hostinger', 'ionos', 'zoho', 'otro'];

export function crearTransporte({ smtp_host, smtp_puerto, smtp_seguro, smtp_usuario }, password, opciones = {}) {
  return nodemailer.createTransport({
    host: smtp_host,
    port: Number(smtp_puerto),
    secure: Boolean(smtp_seguro),
    auth: { user: smtp_usuario, pass: password },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    ...opciones
  });
}

// Traduce los errores SMTP más habituales a algo que el despacho entienda.
export function explicarErrorSmtp(err) {
  const msg = String(err?.message || err || '');
  if (err?.code === 'EAUTH' || /535|534|Invalid login|Username and Password not accepted|authentication/i.test(msg)) {
    return 'El servidor de correo ha rechazado el usuario o la contraseña. En Gmail y Microsoft hace falta una contraseña de aplicación, no la contraseña normal.';
  }
  if (['ENOTFOUND', 'EDNS'].includes(err?.code)) return 'No se encuentra ese servidor de correo. Revisa el servidor SMTP.';
  if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED'].includes(err?.code)) return 'No se ha podido conectar con el servidor de correo. Revisa el servidor, el puerto y la seguridad (SSL/STARTTLS).';
  return `El servidor de correo respondió: ${msg.slice(0, 200)}`;
}

// Buzón con el que se envía un área de un despacho: el asignado a esa área
// o, si no hay, el principal. Solo buzones verificados. `entityId` sirve
// cuando el aviso nace de una finca y no se tiene el tenant a mano.
export async function buzonParaEnvio({ tenantId, entityId, area }) {
  const r = await query(
    `SELECT c.*, t.nombre_entidad, t.telefono AS despacho_telefono, t.direccion AS despacho_direccion, t.cif AS despacho_cif
     FROM correos_despacho c JOIN tenants t ON t.id = c.tenant_id
     WHERE c.verificado_en IS NOT NULL
       AND c.tenant_id = COALESCE($1::uuid, (SELECT tenant_id FROM entities WHERE id = $2::uuid))
       AND ($3::text = ANY(c.areas) OR c.principal)
     ORDER BY ($3::text = ANY(c.areas)) DESC
     LIMIT 1`,
    [tenantId || null, entityId || null, area]
  );
  return r.rows[0] || null;
}

function firma(buzon) {
  const lineas = [buzon.nombre_entidad, [buzon.despacho_cif && `CIF ${buzon.despacho_cif}`, buzon.despacho_direccion].filter(Boolean).join(' · '), [buzon.despacho_telefono, buzon.email].filter(Boolean).join(' · ')];
  return `\n\n--\n${lineas.filter(Boolean).join('\n')}`;
}

// Un email por destinatario (nunca en copia: cada vecino solo ve su
// dirección). Devuelve cuántos salieron y cuáles fallaron.
export async function enviarConBuzon(buzon, { mensaje, destinatarios, archivo_adjunto }) {
  const transporte = crearTransporte(buzon, descifrar(buzon.smtp_password_cifrada), { pool: true, maxConnections: 2 });
  const adjuntos = archivo_adjunto?.contenido_base64
    ? [{ filename: archivo_adjunto.nombre, content: Buffer.from(archivo_adjunto.contenido_base64, 'base64'), contentType: archivo_adjunto.tipo }]
    : [];
  const cuerpo = `${mensaje.cuerpo}${firma(buzon)}`;
  const fallidos = [];
  let enviados = 0;

  try {
    for (const d of destinatarios) {
      try {
        await transporte.sendMail({
          from: { name: buzon.nombre_remitente, address: buzon.email },
          to: d.nombre ? { name: d.nombre, address: d.email } : d.email,
          subject: mensaje.titulo,
          text: cuerpo,
          attachments: adjuntos
        });
        enviados++;
      } catch (err) {
        fallidos.push({ email: d.email, error: explicarErrorSmtp(err) });
        // Credenciales o conexión rotas: no tiene sentido seguir intentando.
        if (['EAUTH', 'ENOTFOUND', 'ECONNECTION', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err?.code)) {
          destinatarios.slice(destinatarios.indexOf(d) + 1).forEach((r) => fallidos.push({ email: r.email, error: explicarErrorSmtp(err) }));
          break;
        }
      }
    }
  } finally {
    transporte.close();
  }

  // El último fallo queda a la vista del despacho en "Mi despacho".
  const registro = fallidos.length
    ? query('UPDATE correos_despacho SET ultimo_error = $2, ultimo_error_en = now() WHERE id = $1', [buzon.id, fallidos[0].error])
    : query('UPDATE correos_despacho SET ultimo_error = NULL, ultimo_error_en = NULL WHERE id = $1', [buzon.id]);
  await registro.catch(() => {});

  return { enviados, fallidos };
}

// Comprueba la conexión y manda un email de prueba al propio buzón: si
// llega, el despacho sabe que sus vecinos lo recibirán igual.
export async function probarBuzon(datos, password) {
  const transporte = crearTransporte(datos, password);
  try {
    await transporte.verify();
    await transporte.sendMail({
      from: { name: datos.nombre_remitente, address: datos.email },
      to: datos.email,
      subject: 'VotifAI: tu buzón está conectado',
      text: `Este es un email de prueba de VotifAI.\n\nSi lo estás leyendo, el buzón ${datos.email} ya está conectado: las convocatorias, actas y avisos a tus vecinos saldrán desde esta cuenta y sus respuestas te llegarán aquí.`
    });
  } finally {
    transporte.close();
  }
}
