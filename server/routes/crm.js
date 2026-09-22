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
// 🎧 CRM / ATENCIÓN AL CLIENTE (solicitudes de propietarios al despacho)
// =========================================================================

router.get('/crm/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar las solicitudes de esta entidad.' });
  }

  try {
    const resultado = await query(
      `SELECT s.id, s.titulo, s.descripcion, s.categoria, s.canal, s.prioridad, s.estado,
              s.fecha_apertura, s.fecha_cierre,
              s.propietario_id, p.nombre_completo AS propietario_nombre, p.propiedad_detalle
       FROM solicitudes_crm s
       LEFT JOIN propietarios p ON s.propietario_id = p.id
       WHERE s.entity_id = $1::uuid
       ORDER BY s.fecha_apertura DESC`,
      [entityId]
    );
    res.status(200).json({ success: true, solicitudes: resultado.rows });
  } catch (err) {
    console.error('Error al listar solicitudes CRM:', err.message);
    res.status(500).json({ error: `Fallo al consultar las solicitudes: ${err.message}` });
  }
});

router.post('/crm/create', requireAuth, async (req, res) => {
  const { entity_id, propietario_id, titulo, descripcion, categoria, canal, prioridad } = req.body;

  if (!entity_id || !titulo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: entidad y título.' });
  }

  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para crear solicitudes en esta entidad.' });
  }

  if (propietario_id && !(await propietarioBelongsToTenant(propietario_id, req.tenantId))) {
    return res.status(403).json({ error: 'El propietario indicado no pertenece a esta entidad.' });
  }

  try {
    const resultado = await query(
      `INSERT INTO solicitudes_crm (entity_id, propietario_id, titulo, descripcion, categoria, canal, prioridad)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, titulo, descripcion, categoria, canal, prioridad, estado, fecha_apertura`,
      [
        entity_id,
        propietario_id || null,
        titulo,
        descripcion || null,
        categoria || 'consulta',
        canal || 'telefono',
        prioridad || 'media'
      ]
    );

    const solicitud = resultado.rows[0];
    await query(
      `INSERT INTO solicitud_crm_eventos (solicitud_id, tipo_evento, estado_nuevo, mensaje)
       VALUES ($1, 'cambio_estado', 'abierta', 'Solicitud registrada.')`,
      [solicitud.id]
    );

    res.status(201).json({ success: true, mensaje: 'Solicitud registrada correctamente.', solicitud });
  } catch (err) {
    console.error('Error al crear solicitud CRM:', err.message);
    res.status(500).json({ error: `Fallo al registrar la solicitud: ${err.message}` });
  }
});

router.put('/crm/:id/estado', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  const { estado, mensaje } = req.body;

  if (!['abierta', 'en_curso', 'resuelta', 'cerrada'].includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido.' });
  }

  if (!(await filaBelongsToTenant('solicitudes_crm', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para modificar esta solicitud.' });
  }

  try {
    const actual = await query('SELECT estado FROM solicitudes_crm WHERE id = $1', [id]);
    if (actual.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }
    const estadoAnterior = actual.rows[0].estado;

    const cierraAhora = estado === 'cerrada' || estado === 'resuelta';
    await query(
      `UPDATE solicitudes_crm SET estado = $1, actualizado_en = now(), fecha_cierre = CASE WHEN $2 THEN now() ELSE fecha_cierre END
       WHERE id = $3`,
      [estado, cierraAhora, id]
    );

    await query(
      `INSERT INTO solicitud_crm_eventos (solicitud_id, tipo_evento, estado_anterior, estado_nuevo, mensaje)
       VALUES ($1, 'cambio_estado', $2, $3, $4)`,
      [id, estadoAnterior, estado, mensaje || null]
    );

    res.status(200).json({ success: true, mensaje: 'Estado actualizado correctamente.' });
  } catch (err) {
    console.error('Error al cambiar estado de solicitud CRM:', err.message);
    res.status(500).json({ error: `Fallo al cambiar el estado: ${err.message}` });
  }
});

router.post('/crm/:id/comentario', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  const { mensaje } = req.body;

  if (!mensaje) {
    return res.status(400).json({ error: 'El comentario no puede estar vacío.' });
  }

  if (!(await filaBelongsToTenant('solicitudes_crm', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para comentar esta solicitud.' });
  }

  try {
    await query(
      `INSERT INTO solicitud_crm_eventos (solicitud_id, tipo_evento, mensaje) VALUES ($1, 'comentario', $2)`,
      [id, mensaje]
    );
    res.status(201).json({ success: true, mensaje: 'Comentario añadido correctamente.' });
  } catch (err) {
    console.error('Error al comentar solicitud CRM:', err.message);
    res.status(500).json({ error: `Fallo al añadir el comentario: ${err.message}` });
  }
});

router.get('/crm/:id/eventos', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('solicitudes_crm', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar el historial de esta solicitud.' });
  }

  try {
    const resultado = await query(
      `SELECT id, tipo_evento, estado_anterior, estado_nuevo, mensaje, creado_en
       FROM solicitud_crm_eventos WHERE solicitud_id = $1 ORDER BY creado_en ASC`,
      [id]
    );
    res.status(200).json({ success: true, eventos: resultado.rows });
  } catch (err) {
    console.error('Error al listar eventos de solicitud CRM:', err.message);
    res.status(500).json({ error: `Fallo al consultar el historial: ${err.message}` });
  }
});

router.delete('/crm/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('solicitudes_crm', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar esta solicitud.' });
  }

  try {
    const resultado = await query('DELETE FROM solicitudes_crm WHERE id = $1', [id]);
    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Solicitud eliminada correctamente.' });
    } else {
      res.status(404).json({ error: 'Solicitud no encontrada.' });
    }
  } catch (err) {
    console.error('Error al eliminar solicitud CRM:', err.message);
    res.status(500).json({ error: `Fallo al eliminar la solicitud: ${err.message}` });
  }
});

export default router;
