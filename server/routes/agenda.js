import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, entityBelongsToTenant, filaBelongsToTenantDirecto } from '../middleware/auth.js';

const router = Router();

// =========================================================================
// 📅 AGENDA DEL DESPACHO (calendario único a nivel de tenant)
// =========================================================================

router.get('/agenda/lista', requireAuth, async (req, res) => {
  try {
    const resultado = await query(
      `SELECT a.id, a.titulo, a.descripcion, a.tipo, a.fecha, a.hora, a.entity_id, e.nombre AS finca_nombre
       FROM agenda_eventos a
       LEFT JOIN entities e ON a.entity_id = e.id
       WHERE a.tenant_id = $1
       ORDER BY a.fecha ASC, a.hora ASC NULLS LAST`,
      [req.tenantId]
    );
    res.status(200).json({ success: true, eventos: resultado.rows });
  } catch (err) {
    console.error('Error al listar la agenda:', err.message);
    res.status(500).json({ error: `Fallo al consultar la agenda: ${err.message}` });
  }
});

router.post('/agenda/create', requireAuth, async (req, res) => {
  const { entity_id, titulo, descripcion, tipo, fecha, hora } = req.body;

  if (!titulo || !fecha) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: título y fecha.' });
  }

  if (entity_id && !(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'La finca indicada no pertenece a tu despacho.' });
  }

  try {
    const resultado = await query(
      `INSERT INTO agenda_eventos (tenant_id, entity_id, titulo, descripcion, tipo, fecha, hora)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, titulo, descripcion, tipo, fecha, hora, entity_id`,
      [req.tenantId, entity_id || null, titulo, descripcion || null, tipo || 'otro', fecha, hora || null]
    );
    res.status(201).json({ success: true, mensaje: 'Evento añadido correctamente.', evento: resultado.rows[0] });
  } catch (err) {
    console.error('Error al crear evento de agenda:', err.message);
    res.status(500).json({ error: `Fallo al guardar el evento: ${err.message}` });
  }
});

router.delete('/agenda/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenantDirecto('agenda_eventos', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar este evento.' });
  }

  try {
    const resultado = await query('DELETE FROM agenda_eventos WHERE id = $1', [id]);
    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Evento eliminado correctamente.' });
    } else {
      res.status(404).json({ error: 'Evento no encontrado.' });
    }
  } catch (err) {
    console.error('Error al eliminar evento de agenda:', err.message);
    res.status(500).json({ error: `Fallo al eliminar el evento: ${err.message}` });
  }
});

export default router;
