import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../db.js';
import { issueVoterSessionCookie, clearVoterSessionCookie, requireVoterAuth } from '../middleware/auth.js';
import { notificar } from '../lib/notificaciones.js';

const router = Router();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim());

// =========================================================================
// 🏘️ AUTENTICACIÓN DE VECINOS (registro real con email + contraseña,
// verificado con el código de acceso de la finca — no hay DNI en el
// censo, así que la identidad se ancla a email+contraseña propios del
// vecino, no a un documento oficial)
// =========================================================================

// Resuelve el código de acceso humano (VAI-XXXX-X) que reparte el
// administrador al entity_id real, para poder enlazar desde /login/comunidad
// sin que el vecino tenga que conocer un UUID.
router.post('/vecinos/resolver-codigo', async (req, res) => {
  const codigo = String(req.body.codigo || '').trim().toUpperCase();
  if (!codigo) {
    return res.status(400).json({ error: 'Introduce el código de acceso de tu comunidad.' });
  }

  try {
    const resultado = await query(`SELECT id, nombre FROM entities WHERE codigo_acceso = $1`, [codigo]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'No se ha encontrado ninguna comunidad con ese código.' });
    }
    res.status(200).json({ success: true, entity_id: resultado.rows[0].id, nombre: resultado.rows[0].nombre });
  } catch (err) {
    console.error('Error al resolver código de acceso:', err.message);
    res.status(500).json({ error: `Fallo al comprobar el código: ${err.message}` });
  }
});

// Censo mínimo para que el vecino identifique cuál de las filas es él
// durante el registro — expone solo nombre/propiedad y si esa fila ya
// tiene cuenta creada, nunca email/teléfono de terceros.
router.get('/vecinos/censo/:entityId', async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  try {
    const resultado = await query(
      `SELECT id, nombre_completo, propiedad_detalle, (password_hash IS NOT NULL) AS tiene_cuenta
       FROM propietarios WHERE entity_id = $1::uuid ORDER BY propiedad_detalle ASC`,
      [entityId]
    );
    res.status(200).json({ success: true, propietarios: resultado.rows });
  } catch (err) {
    console.error('Error al listar censo de vecinos:', err.message);
    res.status(500).json({ error: `Fallo al consultar el censo: ${err.message}` });
  }
});

router.post('/vecinos/registro', async (req, res) => {
  const { entity_id, propietario_id, codigo_acceso, email, password } = req.body;

  if (!entity_id || !propietario_id || !codigo_acceso || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para completar el registro.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const entidad = await query(`SELECT codigo_acceso FROM entities WHERE id = $1::uuid`, [entity_id]);
    if (entidad.rows.length === 0 || entidad.rows[0].codigo_acceso !== String(codigo_acceso).trim().toUpperCase()) {
      return res.status(403).json({ error: 'El código de acceso no coincide con el de esta comunidad.' });
    }

    const propietario = await query(
      `SELECT id, entity_id, nombre_completo, password_hash FROM propietarios WHERE id = $1::uuid AND entity_id = $2::uuid`,
      [propietario_id, entity_id]
    );
    if (propietario.rows.length === 0) {
      return res.status(404).json({ error: 'No se encuentra ese propietario en el censo de la finca.' });
    }
    if (propietario.rows[0].password_hash) {
      return res.status(409).json({ error: 'Este propietario ya tiene una cuenta creada. Inicia sesión en su lugar.' });
    }

    // Excluye la propia fila: el despacho suele precargar el email del
    // propietario al darlo de alta en el censo (para notificaciones), así
    // que esa misma fila ya tiene ese email antes de que exista ninguna
    // cuenta — sin el filtro, el propietario nunca podría auto-registrarse.
    const emailExistente = await query(`SELECT id FROM propietarios WHERE email = $1 AND id != $2::uuid`, [email, propietario_id]);
    if (emailExistente.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const actualizado = await query(
      `UPDATE propietarios SET email = $1, password_hash = $2 WHERE id = $3 RETURNING id, entity_id, nombre_completo, propiedad_detalle`,
      [email, passwordHash, propietario_id]
    );

    const vecino = actualizado.rows[0];
    issueVoterSessionCookie(res, vecino);

    res.status(201).json({ success: true, mensaje: 'Cuenta creada correctamente.', vecino });
  } catch (err) {
    console.error('Error al registrar vecino:', err.message);
    res.status(500).json({ error: `Fallo al crear la cuenta: ${err.message}` });
  }
});

router.post('/vecinos/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Introduce tu correo y contraseña.' });
  }

  try {
    const resultado = await query(
      `SELECT id, entity_id, nombre_completo, propiedad_detalle, password_hash FROM propietarios WHERE email = $1`,
      [email]
    );
    if (resultado.rows.length === 0 || !resultado.rows[0].password_hash) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const vecino = resultado.rows[0];
    const passwordValido = await bcrypt.compare(password, vecino.password_hash);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    issueVoterSessionCookie(res, vecino);
    res.status(200).json({
      success: true,
      mensaje: 'Sesión iniciada correctamente.',
      vecino: { id: vecino.id, entity_id: vecino.entity_id, nombre_completo: vecino.nombre_completo, propiedad_detalle: vecino.propiedad_detalle }
    });
  } catch (err) {
    console.error('Error al iniciar sesión de vecino:', err.message);
    res.status(500).json({ error: `Fallo al iniciar sesión: ${err.message}` });
  }
});

router.post('/vecinos/olvide-password', async (req, res) => {
  const email = String(req.body.email || '').trim();

  const respuestaGenerica = { success: true, mensaje: 'Si ese correo está registrado, recibirás un enlace para restablecer tu contraseña.' };
  if (!email) return res.status(200).json(respuestaGenerica);

  try {
    const resultado = await query(
      `SELECT id, nombre_completo, propiedad_detalle FROM propietarios WHERE email = $1 AND password_hash IS NOT NULL`,
      [email]
    );
    if (resultado.rows.length === 0) return res.status(200).json(respuestaGenerica);

    const vecino = resultado.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    await query(
      `UPDATE propietarios SET reset_token = $1, reset_token_expira = NOW() + INTERVAL '1 hour' WHERE id = $2`,
      [token, vecino.id]
    );

    const enlace = `${allowedOrigins[0]}/restablecer-password/comunidad?token=${token}`;
    await notificar({
      tipo: 'reset_password_vecino',
      finca: { nombre: vecino.propiedad_detalle },
      mensaje: { titulo: 'Restablecer tu contraseña de VotifAI', cuerpo: `Solicitaste restablecer tu contraseña. Este enlace caduca en 1 hora: ${enlace}` },
      destinatarios: [{ nombre: vecino.nombre_completo, propiedad: vecino.propiedad_detalle, email }]
    });

    res.status(200).json(respuestaGenerica);
  } catch (err) {
    console.error('Error al solicitar recuperación de contraseña de vecino:', err.message);
    res.status(200).json(respuestaGenerica);
  }
});

router.post('/vecinos/restablecer-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Faltan datos para restablecer la contraseña.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const resultado = await query(
      `SELECT id FROM propietarios WHERE reset_token = $1 AND reset_token_expira > NOW()`,
      [token]
    );
    if (resultado.rows.length === 0) {
      return res.status(400).json({ error: 'El enlace no es válido o ha caducado. Solicita uno nuevo.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      `UPDATE propietarios SET password_hash = $1, reset_token = NULL, reset_token_expira = NULL WHERE id = $2`,
      [passwordHash, resultado.rows[0].id]
    );

    res.status(200).json({ success: true, mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('Error al restablecer contraseña de vecino:', err.message);
    res.status(500).json({ error: `Fallo al restablecer la contraseña: ${err.message}` });
  }
});

router.post('/vecinos/logout', (req, res) => {
  clearVoterSessionCookie(res);
  res.status(200).json({ success: true, mensaje: 'Sesión cerrada correctamente.' });
});

router.get('/vecinos/sesion', requireVoterAuth, async (req, res) => {
  try {
    const resultado = await query(
      `SELECT id, entity_id, nombre_completo, propiedad_detalle FROM propietarios WHERE id = $1::uuid`,
      [req.propietarioId]
    );
    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'La cuenta de este vecino ya no existe.' });
    }
    res.status(200).json({ success: true, vecino: resultado.rows[0] });
  } catch (err) {
    console.error('Error al recuperar la sesión de vecino:', err.message);
    res.status(500).json({ error: `Fallo al recuperar la sesión: ${err.message}` });
  }
});

export default router;
