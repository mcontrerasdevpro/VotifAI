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
// 📁 DOCUMENTOS
// =========================================================================

// Lista sin el base64 del archivo (puede ser pesado); para verlo/descargarlo
// se usa el endpoint de detalle.
router.get('/documentos/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar los documentos de esta entidad.' });
  }

  try {
    const resultado = await query(
      `SELECT id, titulo, descripcion, categoria, archivo_nombre, archivo_mime, visibilidad, creado_en
       FROM documentos WHERE entity_id = $1::uuid ORDER BY creado_en DESC`,
      [entityId]
    );
    res.status(200).json({ success: true, documentos: resultado.rows });
  } catch (err) {
    console.error('Error al listar documentos:', err.message);
    res.status(500).json({ error: `Fallo al consultar documentos: ${err.message}` });
  }
});

router.get('/documentos/archivo/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('documentos', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para descargar este documento.' });
  }

  try {
    const resultado = await query(
      `SELECT id, titulo, archivo_nombre, archivo_mime, archivo_base64 FROM documentos WHERE id = $1::uuid`,
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado.' });
    }
    res.status(200).json({ success: true, documento: resultado.rows[0] });
  } catch (err) {
    console.error('Error al recuperar documento:', err.message);
    res.status(500).json({ error: `Fallo al recuperar el documento: ${err.message}` });
  }
});

router.post('/documentos/create', requireAuth, async (req, res) => {
  const { entity_id, titulo, descripcion, categoria, archivo_nombre, archivo_mime, archivo_base64, visibilidad } = req.body;

  if (!entity_id || !titulo || !archivo_base64) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: entidad, título y archivo.' });
  }

  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para subir documentos a esta entidad.' });
  }

  try {
    const resultado = await query(
      `INSERT INTO documentos (entity_id, titulo, descripcion, categoria, archivo_nombre, archivo_mime, archivo_base64, visibilidad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, titulo, descripcion, categoria, archivo_nombre, archivo_mime, visibilidad, creado_en`,
      [
        String(entity_id).trim(),
        titulo,
        descripcion || null,
        categoria || 'general',
        archivo_nombre || null,
        archivo_mime || null,
        archivo_base64,
        visibilidad === 'solo_admin' ? 'solo_admin' : 'publico'
      ]
    );
    res.status(201).json({ success: true, mensaje: 'Documento subido correctamente.', documento: resultado.rows[0] });
  } catch (err) {
    console.error('Error al crear documento:', err.message);
    res.status(500).json({ error: `Fallo al guardar el documento: ${err.message}` });
  }
});

router.delete('/documentos/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('documentos', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar este documento.' });
  }

  try {
    const resultado = await query('DELETE FROM documentos WHERE id = $1', [id]);
    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Documento eliminado correctamente.' });
    } else {
      res.status(404).json({ error: 'Documento no encontrado.' });
    }
  } catch (err) {
    console.error('Error al eliminar documento:', err.message);
    res.status(500).json({ error: `Fallo al eliminar el documento: ${err.message}` });
  }
});

// =========================================================================
// 📢 COMUNICADOS
// =========================================================================

router.get('/comunicados/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar los comunicados de esta entidad.' });
  }

  try {
    const resultado = await query(
      `SELECT id, titulo, cuerpo, fijado, fecha_publicacion, fecha_caducidad, creado_en
       FROM comunicados WHERE entity_id = $1::uuid
       ORDER BY fijado DESC, fecha_publicacion DESC`,
      [entityId]
    );
    res.status(200).json({ success: true, comunicados: resultado.rows });
  } catch (err) {
    console.error('Error al listar comunicados:', err.message);
    res.status(500).json({ error: `Fallo al consultar comunicados: ${err.message}` });
  }
});

router.post('/comunicados/create', requireAuth, async (req, res) => {
  const { entity_id, titulo, cuerpo, fijado, fecha_caducidad } = req.body;

  if (!entity_id || !titulo || !cuerpo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: entidad, título y cuerpo del comunicado.' });
  }

  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para publicar comunicados en esta entidad.' });
  }

  try {
    const resultado = await query(
      `INSERT INTO comunicados (entity_id, titulo, cuerpo, fijado, fecha_caducidad)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, titulo, cuerpo, fijado, fecha_publicacion, fecha_caducidad, creado_en`,
      [String(entity_id).trim(), titulo, cuerpo, !!fijado, fecha_caducidad || null]
    );
    res.status(201).json({ success: true, mensaje: 'Comunicado publicado correctamente.', comunicado: resultado.rows[0] });
  } catch (err) {
    console.error('Error al crear comunicado:', err.message);
    res.status(500).json({ error: `Fallo al publicar el comunicado: ${err.message}` });
  }
});

router.put('/comunicados/update/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  const { titulo, cuerpo, fijado, fecha_caducidad } = req.body;

  if (!(await filaBelongsToTenant('comunicados', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para modificar este comunicado.' });
  }

  try {
    const resultado = await query(
      `UPDATE comunicados SET titulo = $1, cuerpo = $2, fijado = $3, fecha_caducidad = $4
       WHERE id = $5
       RETURNING id, titulo, cuerpo, fijado, fecha_publicacion, fecha_caducidad, creado_en`,
      [titulo, cuerpo, !!fijado, fecha_caducidad || null, id]
    );
    res.status(200).json({ success: true, mensaje: 'Comunicado actualizado correctamente.', comunicado: resultado.rows[0] });
  } catch (err) {
    console.error('Error al actualizar comunicado:', err.message);
    res.status(500).json({ error: `Fallo al actualizar el comunicado: ${err.message}` });
  }
});

router.delete('/comunicados/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('comunicados', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar este comunicado.' });
  }

  try {
    const resultado = await query('DELETE FROM comunicados WHERE id = $1', [id]);
    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Comunicado eliminado correctamente.' });
    } else {
      res.status(404).json({ error: 'Comunicado no encontrado.' });
    }
  } catch (err) {
    console.error('Error al eliminar comunicado:', err.message);
    res.status(500).json({ error: `Fallo al eliminar el comunicado: ${err.message}` });
  }
});

// =========================================================================
// 📝 PLANTILLAS DE DOCUMENTO (catálogo a nivel de tenant, no de entidad)
// =========================================================================

router.get('/plantillas/lista', requireAuth, async (req, res) => {
  try {
    const resultado = await query(
      `SELECT id, nombre, descripcion, contenido, creado_en
       FROM plantillas_documento WHERE tenant_id = $1 ORDER BY nombre ASC`,
      [req.tenantId]
    );
    res.status(200).json({ success: true, plantillas: resultado.rows });
  } catch (err) {
    console.error('Error al listar plantillas:', err.message);
    res.status(500).json({ error: `Fallo al consultar plantillas: ${err.message}` });
  }
});

router.post('/plantillas/create', requireAuth, async (req, res) => {
  const { nombre, descripcion, contenido } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre de la plantilla es obligatorio.' });
  }

  try {
    const resultado = await query(
      `INSERT INTO plantillas_documento (tenant_id, nombre, descripcion, contenido)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, descripcion, contenido, creado_en`,
      [req.tenantId, nombre, descripcion || null, contenido || '']
    );
    res.status(201).json({ success: true, mensaje: 'Plantilla creada correctamente.', plantilla: resultado.rows[0] });
  } catch (err) {
    console.error('Error al crear plantilla:', err.message);
    res.status(500).json({ error: `Fallo al guardar la plantilla: ${err.message}` });
  }
});

router.put('/plantillas/update/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  const { nombre, descripcion, contenido } = req.body;

  if (!(await filaBelongsToTenantDirecto('plantillas_documento', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para modificar esta plantilla.' });
  }

  try {
    const resultado = await query(
      `UPDATE plantillas_documento SET nombre = $1, descripcion = $2, contenido = $3
       WHERE id = $4
       RETURNING id, nombre, descripcion, contenido, creado_en`,
      [nombre, descripcion || null, contenido || '', id]
    );
    res.status(200).json({ success: true, mensaje: 'Plantilla actualizada correctamente.', plantilla: resultado.rows[0] });
  } catch (err) {
    console.error('Error al actualizar plantilla:', err.message);
    res.status(500).json({ error: `Fallo al actualizar la plantilla: ${err.message}` });
  }
});

router.delete('/plantillas/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenantDirecto('plantillas_documento', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar esta plantilla.' });
  }

  try {
    const resultado = await query('DELETE FROM plantillas_documento WHERE id = $1', [id]);
    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Plantilla eliminada correctamente.' });
    } else {
      res.status(404).json({ error: 'Plantilla no encontrada.' });
    }
  } catch (err) {
    console.error('Error al eliminar plantilla:', err.message);
    res.status(500).json({ error: `Fallo al eliminar la plantilla: ${err.message}` });
  }
});

// =========================================================================
// ✍️ DOCUMENTOS DE TEXTO (redactados en el editor, por entidad)
// =========================================================================

router.get('/documentos-editor/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar los documentos de esta entidad.' });
  }

  try {
    const resultado = await query(
      `SELECT id, titulo, contenido, plantilla_id, creado_en, actualizado_en
       FROM documentos_editor WHERE entity_id = $1::uuid ORDER BY actualizado_en DESC`,
      [entityId]
    );
    res.status(200).json({ success: true, documentos: resultado.rows });
  } catch (err) {
    console.error('Error al listar documentos redactados:', err.message);
    res.status(500).json({ error: `Fallo al consultar documentos: ${err.message}` });
  }
});

router.post('/documentos-editor/create', requireAuth, async (req, res) => {
  const { entity_id, plantilla_id, titulo, contenido } = req.body;

  if (!entity_id || !titulo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: entidad y título.' });
  }

  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para crear documentos en esta entidad.' });
  }

  if (plantilla_id && !(await filaBelongsToTenantDirecto('plantillas_documento', plantilla_id, req.tenantId))) {
    return res.status(403).json({ error: 'La plantilla indicada no pertenece a tu despacho.' });
  }

  try {
    const resultado = await query(
      `INSERT INTO documentos_editor (entity_id, plantilla_id, titulo, contenido)
       VALUES ($1, $2, $3, $4)
       RETURNING id, titulo, contenido, plantilla_id, creado_en, actualizado_en`,
      [entity_id, plantilla_id || null, titulo, contenido || '']
    );
    res.status(201).json({ success: true, mensaje: 'Documento creado correctamente.', documento: resultado.rows[0] });
  } catch (err) {
    console.error('Error al crear documento redactado:', err.message);
    res.status(500).json({ error: `Fallo al crear el documento: ${err.message}` });
  }
});

router.put('/documentos-editor/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  const { titulo, contenido } = req.body;

  if (!(await filaBelongsToTenant('documentos_editor', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para modificar este documento.' });
  }

  try {
    const resultado = await query(
      `UPDATE documentos_editor SET titulo = $1, contenido = $2, actualizado_en = now()
       WHERE id = $3
       RETURNING id, titulo, contenido, plantilla_id, creado_en, actualizado_en`,
      [titulo, contenido || '', id]
    );
    res.status(200).json({ success: true, mensaje: 'Documento actualizado correctamente.', documento: resultado.rows[0] });
  } catch (err) {
    console.error('Error al actualizar documento redactado:', err.message);
    res.status(500).json({ error: `Fallo al actualizar el documento: ${err.message}` });
  }
});

router.delete('/documentos-editor/delete/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id).trim();

  if (!(await filaBelongsToTenant('documentos_editor', id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para eliminar este documento.' });
  }

  try {
    const resultado = await query('DELETE FROM documentos_editor WHERE id = $1', [id]);
    if (resultado.rowCount > 0) {
      res.status(200).json({ success: true, mensaje: 'Documento eliminado correctamente.' });
    } else {
      res.status(404).json({ error: 'Documento no encontrado.' });
    }
  } catch (err) {
    console.error('Error al eliminar documento redactado:', err.message);
    res.status(500).json({ error: `Fallo al eliminar el documento: ${err.message}` });
  }
});

export default router;
