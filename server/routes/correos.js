import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query, withTransaction } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { cifrar, descifrar } from '../lib/cifrado.js';
import { AREAS, PROVEEDORES, probarBuzon, explicarErrorSmtp } from '../lib/correoDespacho.js';

// =========================================================================
// ✉️ BUZONES DEL DESPACHO — "Mi despacho" → Correo de envío.
// Cada buzón se prueba (conexión + email a sí mismo) antes de guardarse, y
// la contraseña nunca sale del servidor: se guarda cifrada y las
// respuestas solo dicen si hay una puesta.
// =========================================================================

const router = Router();

// Cada prueba abre una conexión SMTP real contra el proveedor del despacho.
const pruebasLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiadas pruebas de conexión. Espera unos minutos.' }
});

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const texto = (v) => String(v ?? '').trim();
const COLUMNAS = 'id, etiqueta, email, nombre_remitente, proveedor, smtp_host, smtp_puerto, smtp_seguro, smtp_usuario, areas, principal, verificado_en, ultimo_error, ultimo_error_en, creado_en';

function validar(body, { passwordObligatoria }) {
  const datos = {
    etiqueta: texto(body.etiqueta) || 'Principal',
    email: texto(body.email).toLowerCase(),
    nombre_remitente: texto(body.nombre_remitente),
    proveedor: PROVEEDORES.includes(body.proveedor) ? body.proveedor : 'otro',
    smtp_host: texto(body.smtp_host).toLowerCase(),
    smtp_puerto: Number.parseInt(body.smtp_puerto, 10),
    smtp_seguro: body.smtp_seguro !== false,
    smtp_usuario: texto(body.smtp_usuario) || texto(body.email).toLowerCase(),
    smtp_password: typeof body.smtp_password === 'string' ? body.smtp_password : '',
    areas: [...new Set((Array.isArray(body.areas) ? body.areas : []).filter((a) => Object.hasOwn(AREAS, a)))],
    principal: body.principal === true
  };
  if (!EMAIL_VALIDO.test(datos.email)) return { error: 'El email del buzón no es válido.' };
  if (!datos.nombre_remitente) return { error: 'Indica el nombre que verán los vecinos como remitente (por ejemplo, el de tu despacho).' };
  if (datos.etiqueta.length > 80 || datos.nombre_remitente.length > 160) return { error: 'El nombre o la etiqueta son demasiado largos.' };
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(datos.smtp_host)) return { error: 'El servidor SMTP no es válido (por ejemplo, smtp.gmail.com).' };
  if (!Number.isInteger(datos.smtp_puerto) || datos.smtp_puerto < 1 || datos.smtp_puerto > 65535) return { error: 'El puerto SMTP no es válido (normalmente 465 o 587).' };
  if (passwordObligatoria && !datos.smtp_password) return { error: 'Falta la contraseña del buzón.' };
  return { datos };
}

// Un área solo sale de un buzón y solo hay un principal por despacho.
async function aplicarAreasYPrincipal(tx, tenantId, id, { areas, principal }) {
  if (areas.length) {
    await tx(
      `UPDATE correos_despacho SET areas = ARRAY(SELECT unnest(areas) EXCEPT SELECT unnest($2::text[]))
       WHERE tenant_id = $1 AND id <> $3::uuid`,
      [tenantId, areas, id]
    );
  }
  if (principal) {
    await tx('UPDATE correos_despacho SET principal = false WHERE tenant_id = $1 AND id <> $2::uuid', [tenantId, id]);
  }
  await tx('UPDATE correos_despacho SET areas = $2::text[], principal = $3 WHERE id = $1::uuid', [id, areas, principal]);
}

router.get('/despacho/correos', requireAuth, async (req, res) => {
  try {
    const r = await query(`SELECT ${COLUMNAS} FROM correos_despacho WHERE tenant_id = $1 ORDER BY principal DESC, creado_en`, [req.tenantId]);
    res.status(200).json({
      success: true,
      correos: r.rows,
      areas: Object.entries(AREAS).map(([id, descripcion]) => ({ id, descripcion })),
      cifrado_disponible: (process.env.CORREOS_CLAVE_CIFRADO || '').length >= 32
    });
  } catch (err) {
    console.error('Error al listar los buzones del despacho:', err.message);
    res.status(500).json({ error: `Fallo al consultar los buzones: ${err.message}` });
  }
});

router.post('/despacho/correos', requireAuth, pruebasLimiter, async (req, res) => {
  const { datos, error } = validar(req.body || {}, { passwordObligatoria: true });
  if (error) return res.status(400).json({ error });

  try {
    const duplicado = await query('SELECT id FROM correos_despacho WHERE tenant_id = $1 AND LOWER(email) = $2', [req.tenantId, datos.email]);
    if (duplicado.rows.length) return res.status(409).json({ error: 'Ese buzón ya está conectado. Edítalo en vez de añadirlo otra vez.' });

    const passwordCifrada = cifrar(datos.smtp_password);
    try {
      await probarBuzon(datos, datos.smtp_password);
    } catch (errSmtp) {
      return res.status(400).json({ error: explicarErrorSmtp(errSmtp) });
    }

    const creado = await withTransaction(async (tx) => {
      const hay = await tx('SELECT COUNT(*)::int AS total FROM correos_despacho WHERE tenant_id = $1', [req.tenantId]);
      const r = await tx(
        `INSERT INTO correos_despacho (tenant_id, etiqueta, email, nombre_remitente, proveedor, smtp_host, smtp_puerto, smtp_seguro, smtp_usuario, smtp_password_cifrada, verificado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
         RETURNING id`,
        [req.tenantId, datos.etiqueta, datos.email, datos.nombre_remitente, datos.proveedor, datos.smtp_host, datos.smtp_puerto, datos.smtp_seguro, datos.smtp_usuario, passwordCifrada]
      );
      // El primer buzón es el principal: cubre todas las áreas.
      await aplicarAreasYPrincipal(tx, req.tenantId, r.rows[0].id, { areas: datos.areas, principal: datos.principal || hay.rows[0].total === 0 });
      return (await tx(`SELECT ${COLUMNAS} FROM correos_despacho WHERE id = $1::uuid`, [r.rows[0].id])).rows[0];
    });

    res.status(201).json({ success: true, correo: creado, mensaje: `Buzón conectado. Te hemos enviado un email de prueba a ${datos.email}.` });
  } catch (err) {
    console.error('Error al conectar un buzón del despacho:', err.message);
    res.status(500).json({ error: `Fallo al guardar el buzón: ${err.message}` });
  }
});

router.put('/despacho/correos/:id', requireAuth, pruebasLimiter, async (req, res) => {
  const { datos, error } = validar(req.body || {}, { passwordObligatoria: false });
  if (error) return res.status(400).json({ error });

  try {
    const actual = await query('SELECT * FROM correos_despacho WHERE id = $1::uuid AND tenant_id = $2', [req.params.id, req.tenantId]);
    const buzon = actual.rows[0];
    if (!buzon) return res.status(404).json({ error: 'Buzón no encontrado.' });

    const duplicado = await query('SELECT id FROM correos_despacho WHERE tenant_id = $1 AND LOWER(email) = $2 AND id <> $3::uuid', [req.tenantId, datos.email, buzon.id]);
    if (duplicado.rows.length) return res.status(409).json({ error: 'Ya tienes otro buzón conectado con ese email.' });

    // Si cambia algo de la conexión se vuelve a probar antes de guardar.
    const cambiaConexion = datos.smtp_password || ['email', 'smtp_host', 'smtp_puerto', 'smtp_seguro', 'smtp_usuario'].some((c) => String(datos[c]) !== String(buzon[c]));
    const password = datos.smtp_password || descifrar(buzon.smtp_password_cifrada);
    if (cambiaConexion) {
      try {
        await probarBuzon(datos, password);
      } catch (errSmtp) {
        return res.status(400).json({ error: explicarErrorSmtp(errSmtp) });
      }
    }

    const actualizado = await withTransaction(async (tx) => {
      await tx(
        `UPDATE correos_despacho SET etiqueta = $2, email = $3, nombre_remitente = $4, proveedor = $5, smtp_host = $6, smtp_puerto = $7,
           smtp_seguro = $8, smtp_usuario = $9, smtp_password_cifrada = $10,
           verificado_en = CASE WHEN $11::boolean THEN now() ELSE verificado_en END,
           ultimo_error = CASE WHEN $11::boolean THEN NULL ELSE ultimo_error END
         WHERE id = $1::uuid`,
        [buzon.id, datos.etiqueta, datos.email, datos.nombre_remitente, datos.proveedor, datos.smtp_host, datos.smtp_puerto, datos.smtp_seguro, datos.smtp_usuario,
          datos.smtp_password ? cifrar(datos.smtp_password) : buzon.smtp_password_cifrada, cambiaConexion]
      );
      await aplicarAreasYPrincipal(tx, req.tenantId, buzon.id, { areas: datos.areas, principal: datos.principal || buzon.principal });
      return (await tx(`SELECT ${COLUMNAS} FROM correos_despacho WHERE id = $1::uuid`, [buzon.id])).rows[0];
    });

    res.status(200).json({ success: true, correo: actualizado, mensaje: cambiaConexion ? `Cambios guardados. Te hemos enviado un email de prueba a ${datos.email}.` : 'Cambios guardados.' });
  } catch (err) {
    console.error('Error al actualizar un buzón del despacho:', err.message);
    res.status(500).json({ error: `Fallo al guardar el buzón: ${err.message}` });
  }
});

router.post('/despacho/correos/:id/probar', requireAuth, pruebasLimiter, async (req, res) => {
  try {
    const r = await query('SELECT * FROM correos_despacho WHERE id = $1::uuid AND tenant_id = $2', [req.params.id, req.tenantId]);
    const buzon = r.rows[0];
    if (!buzon) return res.status(404).json({ error: 'Buzón no encontrado.' });
    try {
      await probarBuzon(buzon, descifrar(buzon.smtp_password_cifrada));
    } catch (errSmtp) {
      const explicacion = explicarErrorSmtp(errSmtp);
      await query('UPDATE correos_despacho SET ultimo_error = $2, ultimo_error_en = now() WHERE id = $1::uuid', [buzon.id, explicacion]);
      return res.status(400).json({ error: explicacion });
    }
    await query('UPDATE correos_despacho SET verificado_en = now(), ultimo_error = NULL, ultimo_error_en = NULL WHERE id = $1::uuid', [buzon.id]);
    res.status(200).json({ success: true, mensaje: `Conexión correcta. Te hemos enviado un email de prueba a ${buzon.email}.` });
  } catch (err) {
    console.error('Error al probar un buzón del despacho:', err.message);
    res.status(500).json({ error: `Fallo al probar el buzón: ${err.message}` });
  }
});

router.delete('/despacho/correos/:id', requireAuth, async (req, res) => {
  try {
    const borrado = await withTransaction(async (tx) => {
      const r = await tx('DELETE FROM correos_despacho WHERE id = $1::uuid AND tenant_id = $2 RETURNING principal', [req.params.id, req.tenantId]);
      if (!r.rows.length) return null;
      // Si se borra el principal, pasa a serlo el buzón más antiguo.
      if (r.rows[0].principal) {
        await tx(
          `UPDATE correos_despacho SET principal = true
           WHERE id = (SELECT id FROM correos_despacho WHERE tenant_id = $1 ORDER BY creado_en LIMIT 1)`,
          [req.tenantId]
        );
      }
      return true;
    });
    if (!borrado) return res.status(404).json({ error: 'Buzón no encontrado.' });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error al desconectar un buzón del despacho:', err.message);
    res.status(500).json({ error: `Fallo al desconectar el buzón: ${err.message}` });
  }
});

export default router;
