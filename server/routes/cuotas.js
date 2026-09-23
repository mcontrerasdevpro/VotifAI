import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, entityBelongsToTenant, propietarioBelongsToTenant, filaBelongsToTenant } from '../middleware/auth.js';
import { marcarVencidas, recalcularMorosidad } from '../lib/morosidad.js';

const router = Router();

async function recalcularEstadoCuota(cuotaId) {
  const cuota = await query('SELECT importe, fecha_vencimiento, estado FROM cuotas WHERE id = $1', [cuotaId]);
  if (cuota.rows.length === 0) return null;
  const { importe, fecha_vencimiento, estado } = cuota.rows[0];
  if (estado === 'anulada') return estado;

  const sumaPagos = await query('SELECT COALESCE(SUM(importe), 0) AS total FROM pagos WHERE cuota_id = $1', [cuotaId]);
  const totalPagado = parseFloat(sumaPagos.rows[0].total);
  const importeNum = parseFloat(importe);

  let nuevoEstado;
  if (totalPagado >= importeNum) {
    nuevoEstado = 'pagada';
  } else if (totalPagado > 0) {
    nuevoEstado = 'parcial';
  } else if (new Date(fecha_vencimiento) < new Date()) {
    nuevoEstado = 'impagada';
  } else {
    nuevoEstado = 'pendiente';
  }

  await query('UPDATE cuotas SET estado = $1 WHERE id = $2', [nuevoEstado, cuotaId]);
  return nuevoEstado;
}

router.get('/cuotas/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar las cuotas de esta entidad.' });
  }

  try {
    await marcarVencidas(entityId);

    const resultado = await query(
      `SELECT c.id, c.propietario_id, p.nombre_completo, p.propiedad_detalle, c.concepto, c.periodo,
              c.importe, c.fecha_emision, c.fecha_vencimiento, c.estado,
              COALESCE((SELECT SUM(importe) FROM pagos WHERE cuota_id = c.id), 0) AS total_pagado
       FROM cuotas c
       JOIN propietarios p ON c.propietario_id = p.id
       WHERE c.entity_id = $1::uuid
       ORDER BY c.fecha_vencimiento DESC`,
      [entityId]
    );
    res.status(200).json({ success: true, cuotas: resultado.rows });
  } catch (err) {
    console.error('Error al listar cuotas:', err.message);
    res.status(500).json({ error: `Fallo al consultar cuotas: ${err.message}` });
  }
});

router.post('/cuotas/create', requireAuth, async (req, res) => {
  const { entity_id, propietario_id, concepto, periodo, importe, fecha_emision, fecha_vencimiento } = req.body;

  if (!entity_id || !propietario_id || !concepto || !importe || !fecha_vencimiento) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: entidad, propietario, concepto, importe y fecha de vencimiento.' });
  }

  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para crear cuotas en esta entidad.' });
  }
  if (!(await propietarioBelongsToTenant(propietario_id, req.tenantId))) {
    return res.status(403).json({ error: 'El propietario indicado no es válido para esta entidad.' });
  }

  try {
    const resultado = await query(
      `INSERT INTO cuotas (entity_id, propietario_id, concepto, periodo, importe, fecha_emision, fecha_vencimiento)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE), $7)
       RETURNING id, propietario_id, concepto, periodo, importe, fecha_emision, fecha_vencimiento, estado`,
      [entity_id, propietario_id, concepto, periodo || null, importe, fecha_emision || null, fecha_vencimiento]
    );
    res.status(201).json({ success: true, mensaje: 'Cuota creada correctamente.', cuota: resultado.rows[0] });
  } catch (err) {
    console.error('Error al crear cuota:', err.message);
    res.status(500).json({ error: `Fallo al crear la cuota: ${err.message}` });
  }
});

router.post('/cuotas/:id/pagos', requireAuth, async (req, res) => {
  const cuotaId = String(req.params.id).trim();
  const { importe, metodo_pago, fecha_pago, referencia, notas } = req.body;

  if (!importe || parseFloat(importe) <= 0) {
    return res.status(400).json({ error: 'El importe del pago debe ser mayor que cero.' });
  }

  if (!(await filaBelongsToTenant('cuotas', cuotaId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para registrar pagos sobre esta cuota.' });
  }

  try {
    const cuota = await query('SELECT propietario_id FROM cuotas WHERE id = $1', [cuotaId]);
    if (cuota.rows.length === 0) {
      return res.status(404).json({ error: 'Cuota no encontrada.' });
    }
    const propietarioId = cuota.rows[0].propietario_id;

    await query(
      `INSERT INTO pagos (cuota_id, importe, metodo_pago, fecha_pago, referencia, notas)
       VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6)`,
      [cuotaId, importe, metodo_pago || null, fecha_pago || null, referencia || null, notas || null]
    );

    const nuevoEstado = await recalcularEstadoCuota(cuotaId);
    const esMoroso = await recalcularMorosidad(propietarioId);

    res.status(201).json({ success: true, mensaje: 'Pago registrado correctamente.', nuevoEstado, esMoroso });
  } catch (err) {
    console.error('Error al registrar pago:', err.message);
    res.status(500).json({ error: `Fallo al registrar el pago: ${err.message}` });
  }
});

router.get('/cuotas/:id/pagos', requireAuth, async (req, res) => {
  const cuotaId = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('cuotas', cuotaId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar los pagos de esta cuota.' });
  }

  try {
    const resultado = await query(
      'SELECT id, importe, metodo_pago, fecha_pago, referencia, notas, creado_en FROM pagos WHERE cuota_id = $1 ORDER BY fecha_pago DESC',
      [cuotaId]
    );
    res.status(200).json({ success: true, pagos: resultado.rows });
  } catch (err) {
    console.error('Error al listar pagos:', err.message);
    res.status(500).json({ error: `Fallo al consultar pagos: ${err.message}` });
  }
});

router.delete('/cuotas/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('cuotas', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar esta cuota.' });
  }

  try {
    const cuota = await query('SELECT propietario_id FROM cuotas WHERE id = $1', [id]);
    const propietarioId = cuota.rows[0]?.propietario_id;

    const resultado = await query('DELETE FROM cuotas WHERE id = $1', [id]);
    if (propietarioId) await recalcularMorosidad(propietarioId);

    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Cuota eliminada correctamente.' });
    } else {
      res.status(404).json({ error: 'Cuota no encontrada.' });
    }
  } catch (err) {
    console.error('Error al eliminar cuota:', err.message);
    res.status(500).json({ error: `Fallo al eliminar la cuota: ${err.message}` });
  }
});

export default router;
