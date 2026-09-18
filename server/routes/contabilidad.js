import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, entityBelongsToTenant, filaBelongsToTenant } from '../middleware/auth.js';

const router = Router();

// =========================================================================
// 💶 MOVIMIENTOS (ingresos / gastos)
// =========================================================================

router.get('/movimientos/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar la contabilidad de esta entidad.' });
  }

  try {
    const resultado = await query(
      `SELECT id, tipo, concepto, categoria, importe, fecha, notas, creado_en
       FROM movimientos_contables WHERE entity_id = $1::uuid ORDER BY fecha DESC, creado_en DESC`,
      [entityId]
    );
    res.status(200).json({ success: true, movimientos: resultado.rows });
  } catch (err) {
    console.error('Error al listar movimientos contables:', err.message);
    res.status(500).json({ error: `Fallo al consultar los movimientos: ${err.message}` });
  }
});

router.post('/movimientos/create', requireAuth, async (req, res) => {
  const { entity_id, tipo, concepto, categoria, importe, fecha, notas } = req.body;

  if (!entity_id || !tipo || !concepto || !importe || !fecha) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: entidad, tipo, concepto, importe y fecha.' });
  }

  if (!['ingreso', 'gasto'].includes(tipo)) {
    return res.status(400).json({ error: 'El tipo de movimiento debe ser ingreso o gasto.' });
  }

  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para registrar movimientos en esta entidad.' });
  }

  try {
    const resultado = await query(
      `INSERT INTO movimientos_contables (entity_id, tipo, concepto, categoria, importe, fecha, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tipo, concepto, categoria, importe, fecha, notas, creado_en`,
      [entity_id, tipo, concepto, categoria || null, importe, fecha, notas || null]
    );
    res.status(201).json({ success: true, mensaje: 'Movimiento registrado correctamente.', movimiento: resultado.rows[0] });
  } catch (err) {
    console.error('Error al crear movimiento contable:', err.message);
    res.status(500).json({ error: `Fallo al guardar el movimiento: ${err.message}` });
  }
});

router.delete('/movimientos/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('movimientos_contables', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar este movimiento.' });
  }

  try {
    const resultado = await query('DELETE FROM movimientos_contables WHERE id = $1', [id]);
    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Movimiento eliminado correctamente.' });
    } else {
      res.status(404).json({ error: 'Movimiento no encontrado.' });
    }
  } catch (err) {
    console.error('Error al eliminar movimiento contable:', err.message);
    res.status(500).json({ error: `Fallo al eliminar el movimiento: ${err.message}` });
  }
});

// =========================================================================
// 📊 PRESUPUESTOS
// =========================================================================

router.get('/presupuestos/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar los presupuestos de esta entidad.' });
  }

  try {
    const resultado = await query(
      `SELECT id, nombre, anio, importe_previsto, notas, creado_en
       FROM presupuestos WHERE entity_id = $1::uuid ORDER BY anio DESC, creado_en DESC`,
      [entityId]
    );
    res.status(200).json({ success: true, presupuestos: resultado.rows });
  } catch (err) {
    console.error('Error al listar presupuestos:', err.message);
    res.status(500).json({ error: `Fallo al consultar los presupuestos: ${err.message}` });
  }
});

router.post('/presupuestos/create', requireAuth, async (req, res) => {
  const { entity_id, nombre, anio, importe_previsto, notas } = req.body;

  if (!entity_id || !nombre || !anio || !importe_previsto) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: entidad, nombre, año e importe previsto.' });
  }

  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para crear presupuestos en esta entidad.' });
  }

  try {
    const resultado = await query(
      `INSERT INTO presupuestos (entity_id, nombre, anio, importe_previsto, notas)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, anio, importe_previsto, notas, creado_en`,
      [entity_id, nombre, anio, importe_previsto, notas || null]
    );
    res.status(201).json({ success: true, mensaje: 'Presupuesto creado correctamente.', presupuesto: resultado.rows[0] });
  } catch (err) {
    console.error('Error al crear presupuesto:', err.message);
    res.status(500).json({ error: `Fallo al guardar el presupuesto: ${err.message}` });
  }
});

router.delete('/presupuestos/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('presupuestos', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar este presupuesto.' });
  }

  try {
    const resultado = await query('DELETE FROM presupuestos WHERE id = $1', [id]);
    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Presupuesto eliminado correctamente.' });
    } else {
      res.status(404).json({ error: 'Presupuesto no encontrado.' });
    }
  } catch (err) {
    console.error('Error al eliminar presupuesto:', err.message);
    res.status(500).json({ error: `Fallo al eliminar el presupuesto: ${err.message}` });
  }
});

// =========================================================================
// 🧾 LIQUIDACIONES (fotografía cerrada de un periodo)
// =========================================================================

router.get('/liquidaciones/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar las liquidaciones de esta entidad.' });
  }

  try {
    const resultado = await query(
      `SELECT id, periodo_inicio, periodo_fin, total_ingresos, total_gastos, saldo, notas, creado_en
       FROM liquidaciones WHERE entity_id = $1::uuid ORDER BY periodo_inicio DESC`,
      [entityId]
    );
    res.status(200).json({ success: true, liquidaciones: resultado.rows });
  } catch (err) {
    console.error('Error al listar liquidaciones:', err.message);
    res.status(500).json({ error: `Fallo al consultar las liquidaciones: ${err.message}` });
  }
});

router.post('/liquidaciones/create', requireAuth, async (req, res) => {
  const { entity_id, periodo_inicio, periodo_fin, notas } = req.body;

  if (!entity_id || !periodo_inicio || !periodo_fin) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: entidad y periodo.' });
  }

  if (periodo_fin < periodo_inicio) {
    return res.status(400).json({ error: 'El fin del periodo no puede ser anterior a su inicio.' });
  }

  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para liquidar esta entidad.' });
  }

  try {
    const sumas = await query(
      `SELECT
         COALESCE(SUM(importe) FILTER (WHERE tipo = 'ingreso'), 0) AS total_ingresos,
         COALESCE(SUM(importe) FILTER (WHERE tipo = 'gasto'), 0) AS total_gastos
       FROM movimientos_contables
       WHERE entity_id = $1::uuid AND fecha BETWEEN $2 AND $3`,
      [entity_id, periodo_inicio, periodo_fin]
    );

    const { total_ingresos, total_gastos } = sumas.rows[0];
    const saldo = Number(total_ingresos) - Number(total_gastos);

    const resultado = await query(
      `INSERT INTO liquidaciones (entity_id, periodo_inicio, periodo_fin, total_ingresos, total_gastos, saldo, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, periodo_inicio, periodo_fin, total_ingresos, total_gastos, saldo, notas, creado_en`,
      [entity_id, periodo_inicio, periodo_fin, total_ingresos, total_gastos, saldo, notas || null]
    );
    res.status(201).json({ success: true, mensaje: 'Liquidación calculada y cerrada correctamente.', liquidacion: resultado.rows[0] });
  } catch (err) {
    console.error('Error al crear liquidación:', err.message);
    res.status(500).json({ error: `Fallo al calcular la liquidación: ${err.message}` });
  }
});

router.delete('/liquidaciones/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('liquidaciones', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar esta liquidación.' });
  }

  try {
    const resultado = await query('DELETE FROM liquidaciones WHERE id = $1', [id]);
    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Liquidación eliminada correctamente.' });
    } else {
      res.status(404).json({ error: 'Liquidación no encontrada.' });
    }
  } catch (err) {
    console.error('Error al eliminar liquidación:', err.message);
    res.status(500).json({ error: `Fallo al eliminar la liquidación: ${err.message}` });
  }
});

export default router;
