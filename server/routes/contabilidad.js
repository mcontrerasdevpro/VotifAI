import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, entityBelongsToTenant, filaBelongsToTenant } from '../middleware/auth.js';
import { liquidacionQueCierra, mensajePeriodoCerrado } from '../lib/cierre.js';
import { calcularEjecucion, estadoFondo } from '../lib/presupuestos.js';
import { repartirImporte } from '../lib/reparto.js';
import { datosDocumento, enviarPdf } from '../lib/datosDocumento.js';
import { generarLiquidacionPdf } from '../lib/pdfDocumentos.js';

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
      `SELECT pr.id, pr.nombre, pr.anio, pr.tipo, pr.importe_previsto, pr.notas, pr.creado_en,
              COALESCE((SELECT json_agg(json_build_object('id', pp.id, 'nombre', pp.nombre, 'importe_previsto', pp.importe_previsto) ORDER BY pp.orden)
                        FROM presupuesto_partidas pp WHERE pp.presupuesto_id = pr.id), '[]') AS partidas
       FROM presupuestos pr WHERE pr.entity_id = $1::uuid ORDER BY pr.anio DESC, pr.creado_en DESC`,
      [entityId]
    );
    res.status(200).json({ success: true, presupuestos: resultado.rows });
  } catch (err) {
    console.error('Error al listar presupuestos:', err.message);
    res.status(500).json({ error: `Fallo al consultar los presupuestos: ${err.message}` });
  }
});

// Presupuesto ordinario o extraordinario, con partidas opcionales. Con
// partidas, el importe previsto es su suma (no se puede desalinear).
router.post('/presupuestos/create', requireAuth, async (req, res) => {
  const { entity_id, nombre, anio, notas } = req.body;
  const tipo = req.body.tipo === 'extraordinario' ? 'extraordinario' : 'ordinario';
  const partidas = (Array.isArray(req.body.partidas) ? req.body.partidas : [])
    .map((p) => ({ nombre: String(p?.nombre || '').trim(), importe: Math.round(Number(p?.importe_previsto) * 100) / 100 }))
    .filter((p) => p.nombre && p.importe >= 0);
  const importePrevisto = partidas.length
    ? Math.round(partidas.reduce((t, p) => t + p.importe * 100, 0)) / 100
    : Math.round(Number(req.body.importe_previsto) * 100) / 100;

  if (!entity_id || !nombre || !anio || !(importePrevisto > 0)) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, año y el importe previsto (o sus partidas).' });
  }
  const nombres = partidas.map((p) => p.nombre.toLowerCase());
  if (new Set(nombres).size !== nombres.length) {
    return res.status(400).json({ error: 'Hay partidas repetidas: cada partida debe tener un nombre distinto.' });
  }
  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para crear presupuestos en esta entidad.' });
  }

  try {
    const presupuesto = await withTransaction(async (tx) => {
      const r = await tx(
        `INSERT INTO presupuestos (entity_id, nombre, anio, tipo, importe_previsto, notas)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, nombre, anio, tipo, importe_previsto, notas, creado_en`,
        [entity_id, nombre, anio, tipo, importePrevisto, notas || null]
      );
      for (let i = 0; i < partidas.length; i++) {
        await tx(
          'INSERT INTO presupuesto_partidas (presupuesto_id, nombre, importe_previsto, orden) VALUES ($1, $2, $3, $4)',
          [r.rows[0].id, partidas[i].nombre, partidas[i].importe, i]
        );
      }
      return r.rows[0];
    });
    res.status(201).json({ success: true, mensaje: 'Presupuesto creado correctamente.', presupuesto });
  } catch (err) {
    console.error('Error al crear presupuesto:', err.message);
    res.status(500).json({ error: `Fallo al guardar el presupuesto: ${err.message}` });
  }
});

// Ejecución: previsto frente a gastado por partida, con los gastos del año
// del presupuesto agrupados por categoría.
router.get('/presupuestos/:id/ejecucion', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  if (!(await filaBelongsToTenant('presupuestos', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar este presupuesto.' });
  }
  try {
    const pr = await query('SELECT id, entity_id, nombre, anio, tipo, importe_previsto FROM presupuestos WHERE id = $1::uuid', [id]);
    const presupuesto = pr.rows[0];
    const [partidas, gastos] = await Promise.all([
      query('SELECT nombre, importe_previsto FROM presupuesto_partidas WHERE presupuesto_id = $1::uuid ORDER BY orden', [id]),
      query(
        `SELECT categoria, SUM(importe) AS total FROM movimientos_contables
         WHERE entity_id = $1::uuid AND tipo = 'gasto' AND EXTRACT(YEAR FROM fecha) = $2
         GROUP BY categoria`,
        [presupuesto.entity_id, presupuesto.anio]
      )
    ]);
    // Sin partidas, el presupuesto entero es una sola "partida" frente a todo el gasto del año.
    const lineas = partidas.rows.length ? partidas.rows : [];
    const ejecucion = lineas.length
      ? calcularEjecucion(lineas, gastos.rows)
      : calcularEjecucion([{ nombre: '__total__', importe_previsto: presupuesto.importe_previsto }], gastos.rows.map((g) => ({ categoria: '__total__', total: g.total })));
    res.json({ success: true, presupuesto, conPartidas: lineas.length > 0, ...ejecucion });
  } catch (err) {
    console.error('Error al calcular la ejecución del presupuesto:', err.message);
    res.status(500).json({ error: 'No se pudo calcular la ejecución del presupuesto.' });
  }
});

// =========================================================================
// 🏦 FONDO DE RESERVA (art. 9.1.f LPH)
// =========================================================================

async function resumenFondo(entityId, hasta = null) {
  const [saldo, presupuesto] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(CASE WHEN tipo = 'aportacion' THEN importe ELSE -importe END), 0) AS saldo
       FROM fondo_reserva_movimientos WHERE entity_id = $1::uuid ${hasta ? 'AND fecha <= $2::date' : ''}`,
      hasta ? [entityId, hasta] : [entityId]
    ),
    query(
      `SELECT id, nombre, anio, importe_previsto FROM presupuestos
       WHERE entity_id = $1::uuid AND tipo = 'ordinario' ORDER BY anio DESC, creado_en DESC LIMIT 1`,
      [entityId]
    )
  ]);
  return estadoFondo(saldo.rows[0].saldo, presupuesto.rows[0] || null);
}

router.get('/fondo-reserva/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();
  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar esta entidad.' });
  }
  try {
    const [estado, movimientos] = await Promise.all([
      resumenFondo(entityId),
      query('SELECT id, tipo, concepto, importe, fecha, notas FROM fondo_reserva_movimientos WHERE entity_id = $1::uuid ORDER BY fecha DESC, creado_en DESC', [entityId])
    ]);
    res.json({ success: true, ...estado, movimientos: movimientos.rows });
  } catch (err) {
    console.error('Error al consultar el fondo de reserva:', err.message);
    res.status(500).json({ error: 'No se pudo consultar el fondo de reserva.' });
  }
});

router.post('/fondo-reserva/create', requireAuth, async (req, res) => {
  const { entity_id, concepto, fecha, notas } = req.body;
  const tipo = req.body.tipo === 'disposicion' ? 'disposicion' : 'aportacion';
  const importe = Math.round(Number(req.body.importe) * 100) / 100;
  if (!entity_id || !concepto || !fecha || !(importe > 0)) {
    return res.status(400).json({ error: 'Indica concepto, fecha e importe.' });
  }
  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para esta entidad.' });
  }
  try {
    if (tipo === 'disposicion') {
      const { saldo } = await resumenFondo(entity_id);
      if (importe > saldo + 0.001) {
        return res.status(400).json({ error: `El fondo de reserva solo tiene ${saldo.toFixed(2)} €: no se puede disponer de ${importe.toFixed(2)} €.` });
      }
    }
    const r = await query(
      `INSERT INTO fondo_reserva_movimientos (entity_id, tipo, concepto, importe, fecha, notas)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [entity_id, tipo, String(concepto).trim(), importe, fecha, notas || null]
    );
    res.status(201).json({ success: true, id: r.rows[0].id, ...(await resumenFondo(entity_id)) });
  } catch (err) {
    console.error('Error al registrar movimiento del fondo:', err.message);
    res.status(500).json({ error: 'No se pudo registrar el movimiento del fondo.' });
  }
});

router.delete('/fondo-reserva/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  if (!(await filaBelongsToTenant('fondo_reserva_movimientos', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar este movimiento.' });
  }
  try {
    const mov = await query('SELECT entity_id, tipo, importe FROM fondo_reserva_movimientos WHERE id = $1::uuid', [id]);
    const m = mov.rows[0];
    // Quitar una aportación no puede dejar el fondo en negativo.
    if (m?.tipo === 'aportacion') {
      const { saldo } = await resumenFondo(m.entity_id);
      if (saldo - Number(m.importe) < -0.001) {
        return res.status(409).json({ error: 'Quitar esta aportación dejaría el fondo en negativo: elimina antes las disposiciones que la usan.' });
      }
    }
    await query('DELETE FROM fondo_reserva_movimientos WHERE id = $1::uuid', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error al eliminar movimiento del fondo:', err.message);
    res.status(500).json({ error: 'No se pudo eliminar el movimiento.' });
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

router.get('/liquidaciones/:id/pdf', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  if (!(await filaBelongsToTenant('liquidaciones', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar esta liquidación.' });
  }
  try {
    const lq = await query('SELECT * FROM liquidaciones WHERE id = $1::uuid', [id]);
    const liquidacion = lq.rows[0];
    const params = [liquidacion.entity_id, liquidacion.periodo_inicio, liquidacion.periodo_fin];
    const [porCategoria, censo, cuotasPeriodo, documento, fondo] = await Promise.all([
      query(
        `SELECT tipo, categoria, SUM(importe) AS total FROM movimientos_contables
         WHERE entity_id = $1::uuid AND fecha BETWEEN $2 AND $3 GROUP BY tipo, categoria ORDER BY SUM(importe) DESC`,
        params
      ),
      query('SELECT id, nombre_completo, propiedad_detalle, coeficiente FROM propietarios WHERE entity_id = $1::uuid ORDER BY propiedad_detalle ASC NULLS LAST, nombre_completo ASC', [liquidacion.entity_id]),
      query(
        `SELECT c.propietario_id, SUM(c.importe) AS emitido,
                SUM(COALESCE((SELECT SUM(pg.importe) FROM pagos pg WHERE pg.cuota_id = c.id), 0)) AS cobrado
         FROM cuotas c
         WHERE c.entity_id = $1::uuid AND c.estado <> 'anulada' AND c.fecha_vencimiento BETWEEN $2 AND $3
         GROUP BY c.propietario_id`,
        params
      ),
      datosDocumento(liquidacion.entity_id),
      resumenFondo(liquidacion.entity_id, liquidacion.periodo_fin)
    ]);

    // Parte de los gastos (congelados en la liquidación) por coeficiente,
    // cuadrando al céntimo con el total.
    const partes = new Map(repartirImporte(liquidacion.total_gastos, censo.rows).map((p) => [p.propietario_id, p.importe]));
    const cuotas = new Map(cuotasPeriodo.rows.map((c) => [c.propietario_id, c]));
    const reparto = censo.rows.map((p) => {
      const c = cuotas.get(p.id);
      const emitido = Number(c?.emitido || 0);
      const cobrado = Number(c?.cobrado || 0);
      return { ...p, parte_gastos: partes.get(p.id) || 0, emitido, cobrado, pendiente: Math.max(0, Math.round((emitido - cobrado) * 100) / 100) };
    });

    const pdf = await generarLiquidacionPdf({
      despacho: documento.despacho,
      finca: documento.finca,
      liquidacion,
      gastosPorCategoria: porCategoria.rows.filter((r) => r.tipo === 'gasto'),
      ingresosPorCategoria: porCategoria.rows.filter((r) => r.tipo === 'ingreso'),
      reparto,
      fondo
    });
    const fechaISO = (d) => new Date(d).toISOString().slice(0, 10);
    enviarPdf(res, pdf, `Liquidación ${documento.finca.nombre} ${fechaISO(liquidacion.periodo_inicio)} a ${fechaISO(liquidacion.periodo_fin)}.pdf`);
  } catch (err) {
    console.error('Error al generar el PDF de la liquidación:', err.message);
    res.status(500).json({ error: 'No se pudo generar la liquidación en PDF.' });
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
