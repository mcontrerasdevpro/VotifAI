import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const COOKIE_NAME = 'votifai_session';
const VOTER_COOKIE_NAME = 'votifai_voter_session';

export function issueSessionCookie(res, tenant) {
  const token = jwt.sign(
    { tenantId: tenant.id, tipoOrganizacion: tenant.tipo_organizacion },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'Sesión no iniciada o expirada.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.tenantId = payload.tenantId;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
}

// =========================================================================
// 🏘️ SESIÓN DE VECINO (propietario autenticado con email+contraseña,
// separada de la sesión de despacho — cookie y payload distintos, mismo
// JWT_SECRET para no duplicar configuración).
// =========================================================================

export function issueVoterSessionCookie(res, propietario) {
  const token = jwt.sign(
    { propietarioId: propietario.id, entityId: propietario.entity_id },
    process.env.JWT_SECRET,
    { expiresIn: '180d' }
  );

  res.cookie(VOTER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 180 * 24 * 60 * 60 * 1000
  });
}

export function clearVoterSessionCookie(res) {
  res.clearCookie(VOTER_COOKIE_NAME);
}

export function requireVoterAuth(req, res, next) {
  const token = req.cookies?.[VOTER_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'Sesión de vecino no iniciada o expirada.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.propietarioId = payload.propietarioId;
    req.voterEntityId = payload.entityId;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión de vecino inválida o expirada.' });
  }
}

export async function entityBelongsToTenant(entityId, tenantId) {
  if (!entityId || !tenantId) return false;
  const resultado = await query('SELECT id FROM entities WHERE id = $1::uuid AND tenant_id = $2', [String(entityId).trim(), tenantId]);
  return resultado.rows.length > 0;
}

export async function propietarioBelongsToTenant(propietarioId, tenantId) {
  if (!propietarioId || !tenantId) return false;
  const resultado = await query(
    `SELECT p.id FROM propietarios p
     JOIN entities e ON p.entity_id = e.id
     WHERE p.id = $1::uuid AND e.tenant_id = $2`,
    [String(propietarioId).trim(), tenantId]
  );
  return resultado.rows.length > 0;
}

// Helper genérico para cualquier tabla con columna entity_id (documentos,
// comunicados, y los módulos de negocio que se vayan añadiendo). `tabla`
// nunca viene de input de usuario, siempre se pasa como literal desde el
// código de las rutas, así que interpolarla en el SQL es seguro.
export async function filaBelongsToTenant(tabla, filaId, tenantId) {
  if (!filaId || !tenantId) return false;
  const resultado = await query(
    `SELECT f.id FROM ${tabla} f
     JOIN entities e ON f.entity_id = e.id
     WHERE f.id = $1::uuid AND e.tenant_id = $2`,
    [String(filaId).trim(), tenantId]
  );
  return resultado.rows.length > 0;
}

// Igual que filaBelongsToTenant, pero para tablas que cuelgan directamente
// del tenant (columna tenant_id, sin pasar por entities) — es el caso de
// proveedores, que se comparten entre todas las fincas del mismo despacho.
export async function filaBelongsToTenantDirecto(tabla, filaId, tenantId) {
  if (!filaId || !tenantId) return false;
  const resultado = await query(
    `SELECT id FROM ${tabla} WHERE id = $1::uuid AND tenant_id = $2`,
    [String(filaId).trim(), tenantId]
  );
  return resultado.rows.length > 0;
}
