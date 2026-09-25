import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, entityBelongsToTenant } from '../middleware/auth.js';
import { exigirCapacidadPropietarios } from '../lib/suscripciones.js';
import { validarFilasCenso, sumaCoeficientes } from '../lib/importarCenso.js';

const router = Router();

// =========================================================================
// 📥 POST /api/propietarios/importar
// Alta masiva del censo desde Excel/CSV. Con `simular: true` solo valida y
// devuelve el resumen (la pantalla lo usa como vista previa); sin él,
// inserta todo o nada: si una sola fila tiene un error no se importa
// ninguna, para no dejar un censo a medias.
// =========================================================================
router.post('/propietarios/importar', requireAuth, async (req, res) => {
  const { entity_id: entityId, propietarios, simular } = req.body;
  if (!entityId) return res.status(400).json({ error: 'Falta la comunidad.' });

  try {
    if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
      return res.status(403).json({ error: 'No autorizado para añadir propietarios a esta entidad.' });
    }

    const { validas, errores } = validarFilasCenso(propietarios);

    // Emails que ya usa otro propietario (el email es único en toda la base:
    // es con lo que el vecino inicia sesión).
    const emails = validas.map((f) => f.email).filter(Boolean);
    if (emails.length) {
      const existentes = await query(
        `SELECT LOWER(p.email) AS email, e.nombre AS finca
         FROM propietarios p JOIN entities e ON e.id = p.entity_id
         WHERE LOWER(p.email) = ANY($1::text[])`,
        [emails]
      );
      const enUso = new Map(existentes.rows.map((r) => [r.email, r.finca]));
      for (const f of validas) {
        if (f.email && enUso.has(f.email)) {
          errores.push({ fila: f.fila, mensaje: `El email ${f.email} ya lo tiene otro propietario${enUso.get(f.email) ? ` (${enUso.get(f.email)})` : ''}.` });
        }
      }
    }
    errores.sort((a, b) => (a.fila ?? 0) - (b.fila ?? 0));

    const actual = await query(
      'SELECT COUNT(*)::int AS total, COALESCE(SUM(coeficiente), 0)::float AS suma FROM propietarios WHERE entity_id = $1::uuid',
      [String(entityId).trim()]
    );
    const sumaNueva = sumaCoeficientes(validas);
    const sumaTotal = Math.round((actual.rows[0].suma + sumaNueva) * 10000) / 10000;

    const avisos = [];
    if (sumaTotal > 100.01) {
      errores.push({ fila: null, mensaje: `Los coeficientes sumarían ${sumaTotal.toLocaleString('es-ES')} % en la comunidad (el máximo es 100 %). Revisa el archivo${actual.rows[0].total ? ' o los propietarios que ya están en el censo' : ''}.` });
    } else if (sumaTotal < 99.99) {
      avisos.push(`Los coeficientes de la comunidad sumarán ${sumaTotal.toLocaleString('es-ES')} %. Deberían sumar 100 % para que las mayorías y los repartos sean correctos.`);
    }

    const capacidad = await exigirCapacidadPropietarios(req.tenantId, entityId, validas.length);
    if (!capacidad.ok) {
      if (capacidad.status === 402) errores.push({ fila: null, mensaje: capacidad.error });
      else return res.status(capacidad.status).json({ error: capacidad.error });
    }

    const resumen = {
      filas: Array.isArray(propietarios) ? propietarios.length : 0,
      validas: validas.length,
      ya_en_censo: actual.rows[0].total,
      suma_coeficientes: sumaTotal,
      errores,
      avisos
    };

    if (simular || errores.length) {
      return res.status(errores.length && !simular ? 422 : 200).json({ success: errores.length === 0, ...resumen });
    }

    // Una sola sentencia: o entran todas las filas o ninguna.
    await query(
      `INSERT INTO propietarios (entity_id, nombre_completo, propiedad_detalle, telefono, email, coeficiente)
       SELECT $1::uuid, n, p, t, e, c
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::numeric[]) AS x(n, p, t, e, c)`,
      [
        String(entityId).trim(),
        validas.map((f) => f.nombre),
        validas.map((f) => f.propiedad),
        validas.map((f) => f.telefono),
        validas.map((f) => f.email),
        validas.map((f) => f.coeficiente)
      ]
    );

    res.status(201).json({ success: true, importados: validas.length, ...resumen });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Algún email del archivo acaba de darse de alta en otro propietario. Vuelve a revisar la importación.' });
    }
    console.error('Error al importar el censo:', err.message);
    res.status(500).json({ error: `Fallo al importar el censo: ${err.message}` });
  }
});

export default router;
