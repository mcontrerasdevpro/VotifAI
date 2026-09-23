import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, entityBelongsToTenant, filaBelongsToTenant } from '../middleware/auth.js';
import { liquidacionQueCierra, mensajePeriodoCerrado } from '../lib/cierre.js';

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
      `SELECT id, tipo, concepto, categoria, importe, fecha, notas, origen, pago_id, creado_en
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
    const cierre = await liquidacionQueCierra(entity_id, fecha);
    if (cierre) return res.status(409).json({ error: mensajePeriodoCerrado(cierre) });

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
    // Los ingresos que vienen de cobrar una cuota van ligados al pago: se
    // anulan desde Cuotas (anulando el cobro), no sueltos, para que cuotas y
    // contabilidad no se descuadren.
    const origen = await query('SELECT origen, entity_id, fecha FROM movimientos_contables WHERE id = $1', [id]);
    if (origen.rows[0]?.origen === 'cuota') {
      return res.status(409).json({ error: 'Este ingreso viene del cobro de una cuota. Para retirarlo, anula el cobro desde Cuotas.' });
    }
    if (origen.rows[0]) {
      const cierre = await liquidacionQueCierra(origen.rows[0].entity_id, origen.rows[0].fecha);
      if (cierre) return res.status(409).json({ error: mensajePeriodoCerrado(cierre) });
    }
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
      `SELECT id, periodo_inicio, periodo_fin, total_ingresos, total_gastos, saldo, notas, creado_en, anulada_en, motivo_anulacion
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
    // Dos liquidaciones vigentes sobre las mismas fechas contarían dos veces
    // los mismos movimientos.
    const solapada = await query(
      `SELECT periodo_inicio, periodo_fin FROM liquidaciones
       WHERE entity_id = $1::uuid AND anulada_en IS NULL AND periodo_inicio <= $3::date AND periodo_fin >= $2::date LIMIT 1`,
      [entity_id, periodo_inicio, periodo_fin]
    );
    if (solapada.rows.length) {
      return res.status(409).json({ error: `Ese periodo se solapa con una liquidación vigente (${new Date(solapada.rows[0].periodo_inicio).toLocaleDateString('es-ES')} – ${new Date(solapada.rows[0].periodo_fin).toLocaleDateString('es-ES')}). Anúlala antes si quieres rehacerla.` });
    }

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

// Una liquidación no se borra: se anula (sigue en la lista con el motivo) y
// su periodo se reabre para poder corregir movimientos y volver a liquidar.
router.delete('/liquidaciones/delete/:id', requireAuth, (req, res) => {
  res.status(409).json({ error: 'Las liquidaciones no se borran: anúlala indicando el motivo, y seguirá constando en el historial.' });
});

router.post('/liquidaciones/:id/anular', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return res.status(400).json({ error: 'Indica el motivo de la anulación.' });
  if (!(await filaBelongsToTenant('liquidaciones', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para anular esta liquidación.' });
  }
  try {
    const r = await query(
      `UPDATE liquidaciones SET anulada_en = now(), motivo_anulacion = $2 WHERE id = $1::uuid AND anulada_en IS NULL RETURNING id`,
      [id, motivo]
    );
    if (r.rowCount === 0) return res.status(409).json({ error: 'Esta liquidación ya estaba anulada.' });
    res.json({ success: true, mensaje: 'Liquidación anulada. Su periodo vuelve a estar abierto.' });
  } catch (err) {
    console.error('Error al anular liquidación:', err.message);
    res.status(500).json({ error: 'No se pudo anular la liquidación.' });
  }
});

export default router;
