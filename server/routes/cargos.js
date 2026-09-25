import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, entityBelongsToTenant } from '../middleware/auth.js';

// =========================================================================
// 🏛️ JUNTA DE GOBIERNO (art. 13 LPH)
// Presidente (obligatorio), vicepresidentes, secretario, tesorero y vocales
// de cada comunidad, elegidos entre los propietarios del censo. Mandato de
// un año salvo que los estatutos digan otra cosa (art. 13.7). Nombrar un
// nuevo presidente, secretario o tesorero cesa al anterior; los cesados
// quedan como historial.
// =========================================================================

const router = Router();

export const CARGOS = {
  presidente: { nombre: 'Presidente', unico: true },
  vicepresidente: { nombre: 'Vicepresidente', unico: false },
  secretario: { nombre: 'Secretario', unico: true },
  tesorero: { nombre: 'Tesorero', unico: true },
  vocal: { nombre: 'Vocal', unico: false }
};
const ORDEN = Object.keys(CARGOS);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const COLUMNAS = `id, propietario_id, cargo, nombre, propiedad, to_char(desde, 'YYYY-MM-DD') AS desde, to_char(hasta, 'YYYY-MM-DD') AS hasta,
  to_char(cesado_en, 'YYYY-MM-DD') AS cesado_en, motivo_cese, creado_en`;

async function cargoDelDespacho(cargoId, tenantId) {
  const r = await query(
    `SELECT c.id, c.entity_id FROM cargos_comunidad c JOIN entities e ON e.id = c.entity_id
     WHERE c.id = $1::uuid AND e.tenant_id = $2`,
    [cargoId, tenantId]
  );
  return r.rows[0] || null;
}

router.get('/entities/:entityId/cargos', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();
  try {
    if (!(await entityBelongsToTenant(entityId, req.tenantId))) return res.status(403).json({ error: 'No autorizado para consultar esta comunidad.' });
    const r = await query(`SELECT ${COLUMNAS} FROM cargos_comunidad WHERE entity_id = $1::uuid ORDER BY desde DESC, creado_en DESC`, [entityId]);
    const porOrden = (a, b) => ORDEN.indexOf(a.cargo) - ORDEN.indexOf(b.cargo) || a.desde.localeCompare(b.desde);
    res.status(200).json({
      success: true,
      vigentes: r.rows.filter((c) => !c.cesado_en).sort(porOrden),
      historial: r.rows.filter((c) => c.cesado_en),
      cargos: Object.entries(CARGOS).map(([id, c]) => ({ id, ...c }))
    });
  } catch (err) {
    console.error('Error al consultar los cargos:', err.message);
    res.status(500).json({ error: `Fallo al consultar los cargos: ${err.message}` });
  }
});

router.post('/entities/:entityId/cargos', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();
  const { propietario_id: propietarioId, cargo } = req.body || {};
  const desde = FECHA.test(req.body?.desde || '') ? req.body.desde : new Date().toISOString().slice(0, 10);
  const hasta = FECHA.test(req.body?.hasta || '') ? req.body.hasta : null;

  if (!CARGOS[cargo]) return res.status(400).json({ error: 'Cargo no válido.' });
  if (!propietarioId) return res.status(400).json({ error: 'Elige el propietario que ocupará el cargo.' });
  if (hasta && hasta <= desde) return res.status(400).json({ error: 'El fin del mandato debe ser posterior al nombramiento.' });

  try {
    if (!(await entityBelongsToTenant(entityId, req.tenantId))) return res.status(403).json({ error: 'No autorizado para modificar esta comunidad.' });

    // Los cargos se eligen entre los propietarios de la comunidad (art. 13.2).
    const p = await query('SELECT id, nombre_completo, propiedad_detalle FROM propietarios WHERE id = $1::uuid AND entity_id = $2::uuid', [propietarioId, entityId]);
    const propietario = p.rows[0];
    if (!propietario) return res.status(400).json({ error: 'Ese propietario no está en el censo de esta comunidad.' });

    const creado = await withTransaction(async (tx) => {
      if (CARGOS[cargo].unico) {
        await tx(
          `UPDATE cargos_comunidad SET cesado_en = $3::date, motivo_cese = 'Nombramiento de un nuevo titular del cargo'
           WHERE entity_id = $1::uuid AND cargo = $2 AND cesado_en IS NULL`,
          [entityId, cargo, desde]
        );
      } else {
        const ya = await tx('SELECT 1 FROM cargos_comunidad WHERE entity_id = $1::uuid AND cargo = $2 AND propietario_id = $3::uuid AND cesado_en IS NULL', [entityId, cargo, propietarioId]);
        if (ya.rows.length) return { duplicado: true };
      }
      const r = await tx(
        `INSERT INTO cargos_comunidad (entity_id, propietario_id, cargo, nombre, propiedad, desde, hasta)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::date, COALESCE($7::date, $6::date + INTERVAL '1 year'))
         RETURNING ${COLUMNAS}`,
        [entityId, propietarioId, cargo, propietario.nombre_completo, propietario.propiedad_detalle, desde, hasta]
      );
      return { cargo: r.rows[0] };
    });

    if (creado.duplicado) return res.status(409).json({ error: `${propietario.nombre_completo} ya es ${CARGOS[cargo].nombre.toLowerCase()} de esta comunidad.` });
    res.status(201).json({ success: true, cargo: creado.cargo });
  } catch (err) {
    console.error('Error al nombrar el cargo:', err.message);
    res.status(500).json({ error: `Fallo al nombrar el cargo: ${err.message}` });
  }
});

router.post('/cargos/:id/cesar', requireAuth, async (req, res) => {
  const fecha = FECHA.test(req.body?.fecha || '') ? req.body.fecha : new Date().toISOString().slice(0, 10);
  const motivo = String(req.body?.motivo || '').trim().slice(0, 255) || 'Cese';
  try {
    const c = await cargoDelDespacho(req.params.id, req.tenantId);
    if (!c) return res.status(404).json({ error: 'Cargo no encontrado.' });
    await query('UPDATE cargos_comunidad SET cesado_en = $2::date, motivo_cese = $3 WHERE id = $1::uuid AND cesado_en IS NULL', [c.id, fecha, motivo]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error al cesar el cargo:', err.message);
    res.status(500).json({ error: `Fallo al cesar el cargo: ${err.message}` });
  }
});

// Corregir fechas de un cargo vigente (p. ej., renovar el mandato).
router.put('/cargos/:id', requireAuth, async (req, res) => {
  const { desde, hasta } = req.body || {};
  if (!FECHA.test(desde || '') || !FECHA.test(hasta || '')) return res.status(400).json({ error: 'Indica las fechas de nombramiento y de fin del mandato.' });
  if (hasta <= desde) return res.status(400).json({ error: 'El fin del mandato debe ser posterior al nombramiento.' });
  try {
    const c = await cargoDelDespacho(req.params.id, req.tenantId);
    if (!c) return res.status(404).json({ error: 'Cargo no encontrado.' });
    const r = await query(`UPDATE cargos_comunidad SET desde = $2::date, hasta = $3::date WHERE id = $1::uuid RETURNING ${COLUMNAS}`, [c.id, desde, hasta]);
    res.status(200).json({ success: true, cargo: r.rows[0] });
  } catch (err) {
    console.error('Error al actualizar el cargo:', err.message);
    res.status(500).json({ error: `Fallo al actualizar el cargo: ${err.message}` });
  }
});

export default router;
