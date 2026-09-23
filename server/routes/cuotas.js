import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, entityBelongsToTenant, propietarioBelongsToTenant, filaBelongsToTenant } from '../middleware/auth.js';
import { marcarVencidas, recalcularMorosidad } from '../lib/morosidad.js';
import { repartirImporte, generarPeriodos, MESES_POR_FRECUENCIA } from '../lib/reparto.js';

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

// =========================================================================
// 📨 EMISIÓN MASIVA — una cuota ordinaria o una derrama para toda la
// comunidad de una vez, repartida por coeficiente o a partes iguales, para
// uno o varios periodos. `previsualizar` calcula sin guardar nada;
// `emision` guarda todas las cuotas en una sola transacción (o ninguna).
// =========================================================================

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

async function prepararEmision(body, tenantId) {
  const entityId = String(body.entity_id || '').trim();
  const concepto = String(body.concepto || '').trim();
  const tipo = body.tipo === 'derrama' ? 'derrama' : 'ordinaria';
  const reparto = body.reparto === 'partes_iguales' ? 'partes_iguales' : 'coeficiente';
  const importePorPeriodo = Math.round(Number(body.importe_por_periodo) * 100) / 100;
  const frecuencia = MESES_POR_FRECUENCIA[body.frecuencia] ? body.frecuencia : 'unica';
  const numero = frecuencia === 'unica' ? 1 : Math.min(24, Math.max(1, parseInt(body.numero_periodos, 10) || 1));
  const primerVencimiento = String(body.primer_vencimiento || '').trim();
  const excluidos = new Set((Array.isArray(body.excluidos) ? body.excluidos : []).map(String));

  if (!entityId || !concepto) return { error: 'Indica la finca y el concepto.', status: 400 };
  if (!(importePorPeriodo > 0)) return { error: 'El importe a repartir tiene que ser mayor que cero.', status: 400 };
  if (!FECHA_ISO.test(primerVencimiento)) return { error: 'Indica la fecha de vencimiento.', status: 400 };
  if (!(await entityBelongsToTenant(entityId, tenantId))) return { error: 'No autorizado para emitir cuotas en esta finca.', status: 403 };

  const censo = await query(
    `SELECT id, nombre_completo, propiedad_detalle, coeficiente FROM propietarios
     WHERE entity_id = $1::uuid ORDER BY propiedad_detalle ASC NULLS LAST, nombre_completo ASC`,
    [entityId]
  );
  const incluidos = censo.rows.filter((p) => !excluidos.has(p.id));
  const repartos = repartirImporte(importePorPeriodo, incluidos, reparto);
  if (repartos.length === 0) {
    return { error: reparto === 'coeficiente' ? 'Los propietarios incluidos no tienen coeficiente: no se puede repartir por coeficiente.' : 'No hay propietarios a los que repartir.', status: 400 };
  }

  const periodos = frecuencia === 'unica'
    ? [{ fecha_vencimiento: primerVencimiento, periodo: String(body.periodo || '').trim() || null }]
    : generarPeriodos({ frecuencia, numero, primerVencimiento });

  const avisos = [];
  const sumaCoef = censo.rows.reduce((t, p) => t + Number(p.coeficiente || 0), 0);
  if (reparto === 'coeficiente' && Math.abs(sumaCoef - 100) > 0.01) {
    avisos.push(`Los coeficientes del censo suman ${sumaCoef.toFixed(4)} % en lugar de 100 %. El reparto se hace en proporción, pero conviene revisar el censo.`);
  }
  if (excluidos.size > 0) avisos.push(`${censo.rows.length - incluidos.length} propietario(s) excluido(s) de esta emisión.`);

  const porId = new Map(incluidos.map((p) => [p.id, p]));
  return {
    entityId, concepto, tipo, reparto, importePorPeriodo, frecuencia, numero, primerVencimiento, excluidos: [...excluidos],
    periodos,
    avisos,
    repartos: repartos.map((r) => ({ ...r, nombre_completo: porId.get(r.propietario_id).nombre_completo, propiedad_detalle: porId.get(r.propietario_id).propiedad_detalle, coeficiente: porId.get(r.propietario_id).coeficiente }))
  };
}

router.post('/cuotas/emision/previsualizar', requireAuth, async (req, res) => {
  try {
    const e = await prepararEmision(req.body, req.tenantId);
    if (e.error) return res.status(e.status).json({ error: e.error });
    res.json({
      success: true,
      periodos: e.periodos,
      repartos: e.repartos,
      avisos: e.avisos,
      totalPorPeriodo: e.importePorPeriodo,
      totalEmision: Math.round(e.importePorPeriodo * e.periodos.length * 100) / 100,
      cuotasAEmitir: e.repartos.length * e.periodos.length
    });
  } catch (err) {
    console.error('Error al previsualizar la emisión:', err.message);
    res.status(500).json({ error: 'No se pudo calcular la emisión.' });
  }
});

router.post('/cuotas/emision', requireAuth, async (req, res) => {
  try {
    const e = await prepararEmision(req.body, req.tenantId);
    if (e.error) return res.status(e.status).json({ error: e.error });

    const emision = await withTransaction(async (tx) => {
      const creada = await tx(
        `INSERT INTO cuotas_emisiones (entity_id, concepto, tipo, reparto, importe_por_periodo, frecuencia, numero_periodos, primer_vencimiento, excluidos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid[])
         RETURNING id`,
        [e.entityId, e.concepto, e.tipo, e.reparto, e.importePorPeriodo, e.frecuencia, e.periodos.length, e.primerVencimiento, e.excluidos]
      );
      const emisionId = creada.rows[0].id;
      // Una sola sentencia por periodo (unnest de los repartos): con fincas
      // grandes y 12 mensualidades son miles de cuotas.
      const conImporte = e.repartos.filter((r) => r.importe > 0);
      for (const periodo of e.periodos) {
        await tx(
          `INSERT INTO cuotas (entity_id, propietario_id, concepto, periodo, importe, fecha_emision, fecha_vencimiento, emision_id, tipo)
           SELECT $1::uuid, r.propietario_id, $2, $3, r.importe, CURRENT_DATE, $4::date, $5::uuid, $6
           FROM unnest($7::uuid[], $8::numeric[]) AS r(propietario_id, importe)`,
          [e.entityId, e.concepto, periodo.periodo, periodo.fecha_vencimiento, emisionId, e.tipo, conImporte.map((r) => r.propietario_id), conImporte.map((r) => r.importe)]
        );
      }
      return emisionId;
    });

    const emitidas = e.repartos.filter((r) => r.importe > 0).length * e.periodos.length;
    res.status(201).json({ success: true, emision_id: emision, cuotasEmitidas: emitidas, mensaje: `Se han emitido ${emitidas} cuotas.` });
  } catch (err) {
    console.error('Error al emitir cuotas:', err.message);
    res.status(500).json({ error: 'No se pudieron emitir las cuotas.' });
  }
});

router.get('/cuotas/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar las cuotas de esta entidad.' });
  }

  try {
    await marcarVencidas(entityId);

    const resultado = await query(
      `SELECT c.id, c.propietario_id, p.nombre_completo, p.propiedad_detalle, c.concepto, c.periodo, c.tipo, c.emision_id,
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
    const cuota = await query(
      `SELECT c.propietario_id, c.entity_id, c.concepto, c.periodo, c.tipo, c.importe, c.estado, p.propiedad_detalle, p.nombre_completo,
              COALESCE((SELECT SUM(importe) FROM pagos WHERE cuota_id = c.id), 0) AS pagado
       FROM cuotas c JOIN propietarios p ON p.id = c.propietario_id WHERE c.id = $1`,
      [cuotaId]
    );
    if (cuota.rows.length === 0) {
      return res.status(404).json({ error: 'Cuota no encontrada.' });
    }
    const c = cuota.rows[0];
    const propietarioId = c.propietario_id;

    if (c.estado === 'anulada') {
      return res.status(409).json({ error: 'Esta cuota está anulada y no admite cobros.' });
    }
    // Un cobro mayor que lo pendiente inflaría los ingresos de la
    // contabilidad con dinero que la comunidad no debía cobrar.
    const pendiente = Math.round((Number(c.importe) - Number(c.pagado)) * 100) / 100;
    if (Number(importe) > pendiente + 0.001) {
      return res.status(400).json({ error: `El pago supera lo pendiente de esta cuota (${pendiente.toFixed(2)} €).` });
    }

    // Pago e ingreso en contabilidad van juntos, o ninguno de los dos.
    await withTransaction(async (tx) => {
      const pago = await tx(
        `INSERT INTO pagos (cuota_id, importe, metodo_pago, fecha_pago, referencia, notas)
         VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6)
         RETURNING id, fecha_pago`,
        [cuotaId, importe, metodo_pago || null, fecha_pago || null, referencia || null, notas || null]
      );
      await tx(
        `INSERT INTO movimientos_contables (entity_id, tipo, concepto, categoria, importe, fecha, notas, pago_id, origen)
         VALUES ($1, 'ingreso', $2, $3, $4, $5, $6, $7, 'cuota')`,
        [
          c.entity_id,
          `Cobro ${c.concepto}${c.periodo ? ` (${c.periodo})` : ''} — ${c.propiedad_detalle || c.nombre_completo}`,
          c.tipo === 'derrama' ? 'Derramas' : 'Cuotas',
          importe,
          pago.rows[0].fecha_pago,
          referencia ? `Ref. ${referencia}` : null,
          pago.rows[0].id
        ]
      );
    });

    const nuevoEstado = await recalcularEstadoCuota(cuotaId);
    const esMoroso = await recalcularMorosidad(propietarioId);

    res.status(201).json({ success: true, mensaje: 'Pago registrado correctamente.', nuevoEstado, esMoroso });
  } catch (err) {
    console.error('Error al registrar pago:', err.message);
    res.status(500).json({ error: `Fallo al registrar el pago: ${err.message}` });
  }
});

// Anular un cobro registrado por error: quita el pago y, en cascada, su
// ingreso en contabilidad, y recalcula el estado de la cuota y la morosidad.
router.delete('/cuotas/pagos/:pagoId', requireAuth, async (req, res) => {
  const pagoId = String(req.params.pagoId).trim();

  try {
    const pago = await query(
      `SELECT pg.cuota_id, c.propietario_id FROM pagos pg
       JOIN cuotas c ON c.id = pg.cuota_id
       JOIN entities e ON e.id = c.entity_id
       WHERE pg.id = $1::uuid AND e.tenant_id = $2`,
      [pagoId, req.tenantId]
    );
    if (pago.rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado.' });
    const { cuota_id: cuotaId, propietario_id: propietarioId } = pago.rows[0];

    await query('DELETE FROM pagos WHERE id = $1::uuid', [pagoId]);
    const nuevoEstado = await recalcularEstadoCuota(cuotaId);
    const esMoroso = await recalcularMorosidad(propietarioId);
    res.json({ success: true, mensaje: 'Cobro anulado. También se ha retirado su ingreso de la contabilidad.', nuevoEstado, esMoroso });
  } catch (err) {
    console.error('Error al anular el pago:', err.message);
    res.status(500).json({ error: 'No se pudo anular el cobro.' });
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
