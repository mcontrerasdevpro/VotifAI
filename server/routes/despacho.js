import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

// =========================================================================
// 🏢 PERFIL DEL DESPACHO — datos de la cuenta (los mismos que salen en el
// membrete del acta en PDF), email de acceso y contraseña.
// =========================================================================

const router = Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Cambiar email o contraseña exige la contraseña actual: es un objetivo de
// fuerza bruta igual que el login, con el mismo límite.
const credencialesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.' }
});

const CAMPOS_PERFIL = 'id, nombre_entidad, email_maestro, tipo_organizacion, plan_suscripcion, cif, telefono, direccion, nombre_responsable';
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const texto = (valor) => String(valor ?? '').trim();

async function passwordCorrecta(tenantId, password) {
  const resultado = await query('SELECT password_hash FROM tenants WHERE id = $1', [tenantId]);
  const hash = resultado.rows[0]?.password_hash;
  return Boolean(hash && password && (await bcrypt.compare(String(password), hash)));
}

router.get('/despacho/perfil', requireAuth, async (req, res) => {
  try {
    const resultado = await query(`SELECT ${CAMPOS_PERFIL} FROM tenants WHERE id = $1`, [req.tenantId]);
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Despacho no encontrado.' });
    res.json({ success: true, perfil: resultado.rows[0] });
  } catch (err) {
    console.error('Error al leer el perfil del despacho:', err.message);
    res.status(500).json({ error: 'No se pudo cargar el perfil del despacho.' });
  }
});

router.put('/despacho/perfil', requireAuth, async (req, res) => {
  const nombreEntidad = texto(req.body.nombreEntidad);
  if (!nombreEntidad) {
    return res.status(400).json({ error: 'El nombre del despacho es obligatorio.' });
  }

  try {
    const resultado = await query(
      `UPDATE tenants
       SET nombre_entidad = $1, nombre_responsable = $2, cif = $3, telefono = $4, direccion = $5
       WHERE id = $6
       RETURNING ${CAMPOS_PERFIL}, proveedor_cliente_id`,
      [
        nombreEntidad,
        texto(req.body.nombreResponsable) || null,
        texto(req.body.cif).toUpperCase() || null,
        texto(req.body.telefono) || null,
        texto(req.body.direccion) || null,
        req.tenantId
      ]
    );
    const { proveedor_cliente_id: customerId, ...perfil } = resultado.rows[0];

    // Best-effort: que las próximas facturas de Stripe salgan con el nombre
    // nuevo. Si Stripe falla, el perfil ya está guardado igualmente.
    if (stripe && customerId) {
      await stripe.customers.update(customerId, { name: perfil.nombre_entidad }).catch((err) => {
        console.error('Perfil guardado, pero no se pudo actualizar el cliente de Stripe:', err.message);
      });
    }

    res.json({ success: true, mensaje: 'Datos del despacho actualizados.', perfil });
  } catch (err) {
    console.error('Error al actualizar el perfil del despacho:', err.message);
    res.status(500).json({ error: 'No se pudieron guardar los datos del despacho.' });
  }
});

router.put('/despacho/email', requireAuth, credencialesLimiter, async (req, res) => {
  const email = texto(req.body.email).toLowerCase();
  if (!EMAIL_VALIDO.test(email)) {
    return res.status(400).json({ error: 'Introduce un email válido.' });
  }

  try {
    if (!(await passwordCorrecta(req.tenantId, req.body.passwordActual))) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    }

    const enUso = await query('SELECT id FROM tenants WHERE LOWER(email_maestro) = $1 AND id != $2', [email, req.tenantId]);
    if (enUso.rows.length > 0) {
      return res.status(409).json({ error: 'Ese email ya está en uso por otra cuenta.' });
    }

    const resultado = await query(
      `UPDATE tenants SET email_maestro = $1 WHERE id = $2 RETURNING ${CAMPOS_PERFIL}, proveedor_cliente_id`,
      [email, req.tenantId]
    );
    const { proveedor_cliente_id: customerId, ...perfil } = resultado.rows[0];

    if (stripe && customerId) {
      await stripe.customers.update(customerId, { email }).catch((err) => {
        console.error('Email guardado, pero no se pudo actualizar el cliente de Stripe:', err.message);
      });
    }

    res.json({ success: true, mensaje: 'Email de acceso actualizado. Úsalo a partir de ahora para iniciar sesión.', perfil });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese email ya está en uso por otra cuenta.' });
    console.error('Error al cambiar el email del despacho:', err.message);
    res.status(500).json({ error: 'No se pudo cambiar el email.' });
  }
});

router.put('/despacho/password', requireAuth, credencialesLimiter, async (req, res) => {
  const passwordNueva = String(req.body.passwordNueva || '');
  if (passwordNueva.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    if (!(await passwordCorrecta(req.tenantId, req.body.passwordActual))) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    }

    const hash = await bcrypt.hash(passwordNueva, 10);
    // Invalida también cualquier enlace de "olvidé mi contraseña" pendiente.
    await query('UPDATE tenants SET password_hash = $1, reset_token = NULL, reset_token_expira = NULL WHERE id = $2', [hash, req.tenantId]);
    res.json({ success: true, mensaje: 'Contraseña actualizada.' });
  } catch (err) {
    console.error('Error al cambiar la contraseña del despacho:', err.message);
    res.status(500).json({ error: 'No se pudo cambiar la contraseña.' });
  }
});

export default router;
