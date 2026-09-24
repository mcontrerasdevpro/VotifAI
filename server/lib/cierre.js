import { query } from '../db.js';
import { fechaES } from './fechas.js';

// Periodo cerrado: una liquidación vigente (no anulada) congela su periodo.
// Devuelve la liquidación que cubre esa fecha, o null si el periodo está
// abierto. `fecha` en 'YYYY-MM-DD' o Date.
export async function liquidacionQueCierra(entityId, fecha) {
  const dia = fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha).slice(0, 10);
  const r = await query(
    `SELECT id, periodo_inicio, periodo_fin FROM liquidaciones
     WHERE entity_id = $1::uuid AND anulada_en IS NULL AND $2::date BETWEEN periodo_inicio AND periodo_fin
     LIMIT 1`,
    [String(entityId).trim(), dia]
  );
  return r.rows[0] || null;
}

const fmt = (d) => fechaES(d);

export function mensajePeriodoCerrado(liq) {
  return `Esa fecha está dentro de un periodo ya liquidado (${fmt(liq.periodo_inicio)} – ${fmt(liq.periodo_fin)}). Para corregirlo, anula antes esa liquidación en Contabilidad y vuelve a generarla.`;
}
