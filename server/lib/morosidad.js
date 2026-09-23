import { query } from '../db.js';

// Morosidad de la comunidad: la usan las cuotas (estado de cada cuota y
// marca es_moroso del propietario) y las juntas (relación de deudores en la
// convocatoria, art. 16.2 LPH, y privación del voto, art. 15.2 LPH).

// Cuotas vencidas (pendiente/parcial cuya fecha de vencimiento ya pasó) se
// marcan como 'impagada' de forma perezosa — no hay ningún cron en este
// proyecto, así que se recalcula cuando se consulta (listar cuotas,
// convocar o iniciar una junta).
export async function marcarVencidas(entityId) {
  const vencidas = await query(
    `UPDATE cuotas SET estado = 'impagada'
     WHERE entity_id = $1::uuid AND estado IN ('pendiente', 'parcial') AND fecha_vencimiento < CURRENT_DATE
     RETURNING propietario_id`,
    [entityId]
  );
  const propietariosAfectados = [...new Set(vencidas.rows.map((r) => r.propietario_id))];
  for (const propietarioId of propietariosAfectados) {
    await recalcularMorosidad(propietarioId);
  }
}

// Un propietario es moroso si tiene al menos una cuota impagada.
export async function recalcularMorosidad(propietarioId) {
  const impagadas = await query(
    `SELECT COUNT(*) AS total FROM cuotas WHERE propietario_id = $1 AND estado = 'impagada'`,
    [propietarioId]
  );
  const esMoroso = parseInt(impagadas.rows[0].total, 10) > 0;
  await query('UPDATE propietarios SET es_moroso = $1 WHERE id = $2', [esMoroso, propietarioId]);
  return esMoroso;
}

// Propietarios de la finca con deudas vencidas, con lo que deben (importe
// de sus cuotas impagadas menos lo ya pagado de ellas).
export async function deudoresVencidos(entityId) {
  await marcarVencidas(entityId);
  const resultado = await query(
    `SELECT p.id AS propietario_id, p.nombre_completo, p.propiedad_detalle, p.coeficiente,
            SUM(c.importe - COALESCE((SELECT SUM(pg.importe) FROM pagos pg WHERE pg.cuota_id = c.id), 0)) AS deuda
     FROM cuotas c JOIN propietarios p ON p.id = c.propietario_id
     WHERE c.entity_id = $1::uuid AND c.estado = 'impagada'
     GROUP BY p.id
     HAVING SUM(c.importe - COALESCE((SELECT SUM(pg.importe) FROM pagos pg WHERE pg.cuota_id = c.id), 0)) > 0
     ORDER BY p.propiedad_detalle ASC NULLS LAST, p.nombre_completo ASC`,
    [String(entityId).trim()]
  );
  return resultado.rows;
}
