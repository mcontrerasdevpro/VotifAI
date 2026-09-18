import { Router } from 'express';
import { query } from '../db.js';
import {
  requireAuth,
  entityBelongsToTenant,
  propietarioBelongsToTenant,
  filaBelongsToTenant
} from '../middleware/auth.js';

const router = Router();

// =========================================================================
// 🏊 ZONAS COMUNES
// =========================================================================

router.get('/zonas-comunes/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar las zonas comunes de esta entidad.' });
  }

  try {
    const resultado = await query(
      `SELECT id, nombre, tipo, capacidad_maxima, requiere_aprobacion, horario_apertura, horario_cierre,
              duracion_maxima_minutos, reglas, activa, creado_en
       FROM zonas_comunes WHERE entity_id = $1::uuid ORDER BY nombre ASC`,
      [entityId]
    );
    res.status(200).json({ success: true, zonas: resultado.rows });
  } catch (err) {
    console.error('Error al listar zonas comunes:', err.message);
    res.status(500).json({ error: `Fallo al consultar zonas comunes: ${err.message}` });
  }
});

router.post('/zonas-comunes/create', requireAuth, async (req, res) => {
  const { entity_id, nombre, tipo, capacidad_maxima, requiere_aprobacion, horario_apertura, horario_cierre, duracion_maxima_minutos, reglas } = req.body;

  if (!entity_id || !nombre) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: entidad y nombre de la zona.' });
  }

  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para crear zonas comunes en esta entidad.' });
  }

  try {
    const resultado = await query(
      `INSERT INTO zonas_comunes (entity_id, nombre, tipo, capacidad_maxima, requiere_aprobacion, horario_apertura, horario_cierre, duracion_maxima_minutos, reglas)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::time, '08:00'), COALESCE($7::time, '22:00'), COALESCE($8::int, 120), $9)
       RETURNING id, nombre, tipo, capacidad_maxima, requiere_aprobacion, horario_apertura, horario_cierre, duracion_maxima_minutos, reglas, activa`,
      [
        entity_id, nombre, tipo || null, capacidad_maxima || null, !!requiere_aprobacion,
        horario_apertura || null, horario_cierre || null, duracion_maxima_minutos || null, reglas || null
      ]
    );
    res.status(201).json({ success: true, mensaje: 'Zona común creada correctamente.', zona: resultado.rows[0] });
  } catch (err) {
    console.error('Error al crear zona común:', err.message);
    res.status(500).json({ error: `Fallo al crear la zona común: ${err.message}` });
  }
});

router.delete('/zonas-comunes/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('zonas_comunes', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar esta zona común.' });
  }

  try {
    const resultado = await query('DELETE FROM zonas_comunes WHERE id = $1', [id]);
    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Zona común eliminada correctamente.' });
    } else {
      res.status(404).json({ error: 'Zona común no encontrada.' });
    }
  } catch (err) {
    console.error('Error al eliminar zona común:', err.message);
    res.status(500).json({ error: `Fallo al eliminar la zona común: ${err.message}` });
  }
});

// =========================================================================
// 📅 RESERVAS
// =========================================================================

router.get('/reservas/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar las reservas de esta entidad.' });
  }

  try {
    const resultado = await query(
      `SELECT r.id, r.zona_id, z.nombre AS zona_nombre, r.propietario_id, p.nombre_completo AS propietario_nombre,
              p.propiedad_detalle, r.fecha, r.hora_inicio, r.hora_fin, r.estado, r.notas, r.creado_en
       FROM reservas r
       JOIN zonas_comunes z ON r.zona_id = z.id
       JOIN propietarios p ON r.propietario_id = p.id
       WHERE r.entity_id = $1::uuid
       ORDER BY r.fecha DESC, r.hora_inicio DESC`,
      [entityId]
    );
    res.status(200).json({ success: true, reservas: resultado.rows });
  } catch (err) {
    console.error('Error al listar reservas:', err.message);
    res.status(500).json({ error: `Fallo al consultar reservas: ${err.message}` });
  }
});

router.post('/reservas/create', requireAuth, async (req, res) => {
  const { entity_id, zona_id, propietario_id, fecha, hora_inicio, hora_fin, notas } = req.body;

  if (!entity_id || !zona_id || !propietario_id || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: entidad, zona, propietario, fecha y horario.' });
  }

  if (hora_fin <= hora_inicio) {
    return res.status(400).json({ error: 'La hora de fin debe ser posterior a la hora de inicio.' });
  }

  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para reservar en esta entidad.' });
  }
  if (!(await propietarioBelongsToTenant(propietario_id, req.tenantId))) {
    return res.status(403).json({ error: 'El propietario indicado no es válido para esta entidad.' });
  }
  if (!(await filaBelongsToTenant('zonas_comunes', zona_id, req.tenantId))) {
    return res.status(403).json({ error: 'La zona común indicada no es válida para esta entidad.' });
  }

  try {
    const zona = await query('SELECT requiere_aprobacion FROM zonas_comunes WHERE id = $1', [zona_id]);
    if (zona.rows.length === 0) {
      return res.status(404).json({ error: 'Zona común no encontrada.' });
    }

    // Comprobación de solape: cualquier reserva activa (pendiente o
    // confirmada) de la misma zona y fecha cuyo rango se cruce con el
    // solicitado se considera un conflicto. Se hace aquí, no solo en la
    // UI, para que sea imposible de saltarse con dos pestañas a la vez.
    const solapes = await query(
      `SELECT id FROM reservas
       WHERE zona_id = $1::uuid AND fecha = $2 AND estado IN ('pendiente', 'confirmada')
         AND NOT (hora_fin <= $3 OR hora_inicio >= $4)`,
      [zona_id, fecha, hora_inicio, hora_fin]
    );
    if (solapes.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una reserva que se solapa con ese horario en esta zona.' });
    }

    const estadoInicial = zona.rows[0].requiere_aprobacion ? 'pendiente' : 'confirmada';

    const resultado = await query(
      `INSERT INTO reservas (zona_id, entity_id, propietario_id, fecha, hora_inicio, hora_fin, estado, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, zona_id, propietario_id, fecha, hora_inicio, hora_fin, estado, notas`,
      [zona_id, entity_id, propietario_id, fecha, hora_inicio, hora_fin, estadoInicial, notas || null]
    );
    res.status(201).json({ success: true, mensaje: 'Reserva registrada correctamente.', reserva: resultado.rows[0] });
  } catch (err) {
    console.error('Error al crear reserva:', err.message);
    res.status(500).json({ error: `Fallo al crear la reserva: ${err.message}` });
  }
});

router.put('/reservas/:id/estado', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  const { estado } = req.body;

  if (!['confirmada', 'cancelada', 'rechazada'].includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido.' });
  }

  if (!(await filaBelongsToTenant('reservas', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para modificar esta reserva.' });
  }

  try {
    const resultado = await query('UPDATE reservas SET estado = $1 WHERE id = $2 RETURNING id, estado', [estado, id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }
    res.status(200).json({ success: true, mensaje: 'Estado de la reserva actualizado.', reserva: resultado.rows[0] });
  } catch (err) {
    console.error('Error al actualizar estado de reserva:', err.message);
    res.status(500).json({ error: `Fallo al actualizar la reserva: ${err.message}` });
  }
});

router.delete('/reservas/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('reservas', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar esta reserva.' });
  }

  try {
    const resultado = await query('DELETE FROM reservas WHERE id = $1', [id]);
    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Reserva eliminada correctamente.' });
    } else {
      res.status(404).json({ error: 'Reserva no encontrada.' });
    }
  } catch (err) {
    console.error('Error al eliminar reserva:', err.message);
    res.status(500).json({ error: `Fallo al eliminar la reserva: ${err.message}` });
  }
});

export default router;
