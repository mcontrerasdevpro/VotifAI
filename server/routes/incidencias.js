import { Router } from 'express';
import { query } from '../db.js';
import {
  requireAuth,
  entityBelongsToTenant,
  filaBelongsToTenant,
  filaBelongsToTenantDirecto
} from '../middleware/auth.js';

const router = Router();

// =========================================================================
// 🛠️ PROVEEDORES (catálogo a nivel de tenant, no de entidad)
// =========================================================================

router.get('/proveedores/lista', requireAuth, async (req, res) => {
  try {
    const resultado = await query(
      `SELECT id, nombre, categoria, telefono, email, cif, notas, activo, creado_en
       FROM proveedores WHERE tenant_id = $1 ORDER BY nombre ASC`,
      [req.tenantId]
    );
    res.status(200).json({ success: true, proveedores: resultado.rows });
  } catch (err) {
    console.error('Error al listar proveedores:', err.message);
    res.status(500).json({ error: `Fallo al consultar proveedores: ${err.message}` });
  }
});

router.post('/proveedores/create', requireAuth, async (req, res) => {
  const { nombre, categoria, telefono, email, cif, notas } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del proveedor es obligatorio.' });
  }

  try {
    const resultado = await query(
      `INSERT INTO proveedores (tenant_id, nombre, categoria, telefono, email, cif, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nombre, categoria, telefono, email, cif, notas, activo, creado_en`,
      [req.tenantId, nombre, categoria || null, telefono || null, email || null, cif || null, notas || null]
    );
    res.status(201).json({ success: true, mensaje: 'Proveedor añadido correctamente.', proveedor: resultado.rows[0] });
  } catch (err) {
    console.error('Error al crear proveedor:', err.message);
    res.status(500).json({ error: `Fallo al guardar el proveedor: ${err.message}` });
  }
});

router.put('/proveedores/update/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  const { nombre, categoria, telefono, email, cif, notas, activo } = req.body;

  if (!(await filaBelongsToTenantDirecto('proveedores', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para modificar este proveedor.' });
  }

  try {
    const resultado = await query(
      `UPDATE proveedores SET nombre = $1, categoria = $2, telefono = $3, email = $4, cif = $5, notas = $6, activo = $7
       WHERE id = $8
       RETURNING id, nombre, categoria, telefono, email, cif, notas, activo, creado_en`,
      [nombre, categoria || null, telefono || null, email || null, cif || null, notas || null, activo !== false, id]
    );
    res.status(200).json({ success: true, mensaje: 'Proveedor actualizado correctamente.', proveedor: resultado.rows[0] });
  } catch (err) {
    console.error('Error al actualizar proveedor:', err.message);
    res.status(500).json({ error: `Fallo al actualizar el proveedor: ${err.message}` });
  }
});

router.delete('/proveedores/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenantDirecto('proveedores', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar este proveedor.' });
  }

  try {
    const resultado = await query('DELETE FROM proveedores WHERE id = $1', [id]);
    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Proveedor eliminado correctamente.' });
    } else {
      res.status(404).json({ error: 'Proveedor no encontrado.' });
    }
  } catch (err) {
    console.error('Error al eliminar proveedor:', err.message);
    res.status(500).json({ error: `Fallo al eliminar el proveedor: ${err.message}` });
  }
});

// =========================================================================
// 🔧 INCIDENCIAS
// =========================================================================

router.get('/incidencias/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar las incidencias de esta entidad.' });
  }

  try {
    const resultado = await query(
      `SELECT i.id, i.titulo, i.descripcion, i.categoria, i.ubicacion, i.prioridad, i.estado,
              i.coste_estimado, i.coste_final, i.fecha_apertura, i.fecha_cierre,
              i.propietario_id, p.nombre_completo AS propietario_nombre, p.propiedad_detalle,
              i.proveedor_id, pr.nombre AS proveedor_nombre
       FROM incidencias i
       LEFT JOIN propietarios p ON i.propietario_id = p.id
       LEFT JOIN proveedores pr ON i.proveedor_id = pr.id
       WHERE i.entity_id = $1::uuid
       ORDER BY i.fecha_apertura DESC`,
      [entityId]
    );
    res.status(200).json({ success: true, incidencias: resultado.rows });
  } catch (err) {
    console.error('Error al listar incidencias:', err.message);
    res.status(500).json({ error: `Fallo al consultar incidencias: ${err.message}` });
  }
});

router.post('/incidencias/create', requireAuth, async (req, res) => {
  const { entity_id, propietario_id, titulo, descripcion, categoria, ubicacion, prioridad, coste_estimado } = req.body;

  if (!entity_id || !titulo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: entidad y título.' });
  }

  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para crear incidencias en esta entidad.' });
  }

  try {
    const resultado = await query(
      `INSERT INTO incidencias (entity_id, propietario_id, titulo, descripcion, categoria, ubicacion, prioridad, coste_estimado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, titulo, descripcion, categoria, ubicacion, prioridad, estado, coste_estimado, fecha_apertura`,
      [
        entity_id,
        propietario_id || null,
        titulo,
        descripcion || null,
        categoria || 'general',
        ubicacion || null,
        prioridad || 'media',
        coste_estimado || null
      ]
    );

    const incidencia = resultado.rows[0];
    await query(
      `INSERT INTO incidencia_eventos (incidencia_id, tipo_evento, estado_nuevo, mensaje)
       VALUES ($1, 'cambio_estado', 'abierta', 'Incidencia registrada.')`,
      [incidencia.id]
    );

    res.status(201).json({ success: true, mensaje: 'Incidencia registrada correctamente.', incidencia });
  } catch (err) {
    console.error('Error al crear incidencia:', err.message);
    res.status(500).json({ error: `Fallo al registrar la incidencia: ${err.message}` });
  }
});

router.put('/incidencias/:id/estado', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  const { estado, mensaje } = req.body;

  if (!['abierta', 'en_curso', 'resuelta', 'cerrada'].includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido.' });
  }

  if (!(await filaBelongsToTenant('incidencias', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para modificar esta incidencia.' });
  }

  try {
    const actual = await query('SELECT estado FROM incidencias WHERE id = $1', [id]);
    if (actual.rows.length === 0) {
      return res.status(404).json({ error: 'Incidencia no encontrada.' });
    }
    const estadoAnterior = actual.rows[0].estado;

    const cierraAhora = estado === 'cerrada' || estado === 'resuelta';
    await query(
      `UPDATE incidencias SET estado = $1, actualizado_en = now(), fecha_cierre = CASE WHEN $2 THEN now() ELSE fecha_cierre END
       WHERE id = $3`,
      [estado, cierraAhora, id]
    );

    await query(
      `INSERT INTO incidencia_eventos (incidencia_id, tipo_evento, estado_anterior, estado_nuevo, mensaje)
       VALUES ($1, 'cambio_estado', $2, $3, $4)`,
      [id, estadoAnterior, estado, mensaje || null]
    );

    res.status(200).json({ success: true, mensaje: 'Estado actualizado correctamente.' });
  } catch (err) {
    console.error('Error al cambiar estado de incidencia:', err.message);
    res.status(500).json({ error: `Fallo al cambiar el estado: ${err.message}` });
  }
});

router.put('/incidencias/:id/asignar', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  const { proveedor_id, coste_estimado } = req.body;

  if (!(await filaBelongsToTenant('incidencias', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para modificar esta incidencia.' });
  }

  try {
    let nombreProveedor = null;
    if (proveedor_id) {
      if (!(await filaBelongsToTenantDirecto('proveedores', proveedor_id, req.tenantId))) {
        return res.status(403).json({ error: 'El proveedor indicado no pertenece a tu despacho.' });
      }
      const prov = await query('SELECT nombre FROM proveedores WHERE id = $1', [proveedor_id]);
      nombreProveedor = prov.rows[0]?.nombre;
    }

    await query(
      `UPDATE incidencias SET proveedor_id = $1, coste_estimado = COALESCE($2, coste_estimado), actualizado_en = now()
       WHERE id = $3`,
      [proveedor_id || null, coste_estimado || null, id]
    );

    await query(
      `INSERT INTO incidencia_eventos (incidencia_id, tipo_evento, mensaje)
       VALUES ($1, 'asignacion', $2)`,
      [id, proveedor_id ? `Asignada a ${nombreProveedor}.` : 'Proveedor desasignado.']
    );

    res.status(200).json({ success: true, mensaje: 'Incidencia asignada correctamente.' });
  } catch (err) {
    console.error('Error al asignar incidencia:', err.message);
    res.status(500).json({ error: `Fallo al asignar la incidencia: ${err.message}` });
  }
});

router.post('/incidencias/:id/comentario', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  const { mensaje } = req.body;

  if (!mensaje) {
    return res.status(400).json({ error: 'El comentario no puede estar vacío.' });
  }

  if (!(await filaBelongsToTenant('incidencias', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para comentar esta incidencia.' });
  }

  try {
    await query(
      `INSERT INTO incidencia_eventos (incidencia_id, tipo_evento, mensaje) VALUES ($1, 'comentario', $2)`,
      [id, mensaje]
    );
    res.status(201).json({ success: true, mensaje: 'Comentario añadido correctamente.' });
  } catch (err) {
    console.error('Error al comentar incidencia:', err.message);
    res.status(500).json({ error: `Fallo al añadir el comentario: ${err.message}` });
  }
});

router.get('/incidencias/:id/eventos', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('incidencias', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar el historial de esta incidencia.' });
  }

  try {
    const resultado = await query(
      `SELECT id, tipo_evento, estado_anterior, estado_nuevo, mensaje, creado_en
       FROM incidencia_eventos WHERE incidencia_id = $1 ORDER BY creado_en ASC`,
      [id]
    );
    res.status(200).json({ success: true, eventos: resultado.rows });
  } catch (err) {
    console.error('Error al listar eventos de incidencia:', err.message);
    res.status(500).json({ error: `Fallo al consultar el historial: ${err.message}` });
  }
});

router.delete('/incidencias/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('incidencias', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar esta incidencia.' });
  }

  try {
    const resultado = await query('DELETE FROM incidencias WHERE id = $1', [id]);
    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Incidencia eliminada correctamente.' });
    } else {
      res.status(404).json({ error: 'Incidencia no encontrada.' });
    }
  } catch (err) {
    console.error('Error al eliminar incidencia:', err.message);
    res.status(500).json({ error: `Fallo al eliminar la incidencia: ${err.message}` });
  }
});

export default router;
