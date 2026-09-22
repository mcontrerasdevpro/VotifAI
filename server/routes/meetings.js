import { Router } from 'express';
import { query } from '../db.js';
import { notificar } from '../lib/notificaciones.js';
import { generarActaPdf } from '../lib/pdfActa.js';
import {
  requireAuth,
  requireVoterAuth,
  entityBelongsToTenant,
  filaBelongsToTenant,
  puntoBelongsToTenant,
  puntoBelongsToEntity
} from '../middleware/auth.js';

const router = Router();

// =========================================================================
// 🏛️ JUNTAS (despacho) — convocatoria, orden del día e historial reales.
// Ciclo de vida: programada -> en_curso -> cerrada (o cancelada).
// =========================================================================

router.post('/meetings/create', requireAuth, async (req, res) => {
  const { entity_id, titulo, tipo, fecha_hora_prevista, puntos } = req.body;

  if (!entity_id || !titulo || !Array.isArray(puntos) || puntos.length === 0) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: finca, título y al menos un punto del orden del día.' });
  }

  if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para convocar juntas en esta finca.' });
  }

  const tipoJunta = tipo === 'extraordinaria' ? 'extraordinaria' : 'ordinaria';

  try {
    await query('BEGIN');

    // Se congela aquí el tamaño del censo (cabezas y coeficiente) para que
    // el cuórum de esta junta no cambie si el censo se edita más adelante.
    const censoResultado = await query(
      `SELECT COUNT(*)::int AS total, COALESCE(SUM(coeficiente), 0) AS coeficiente_total
       FROM propietarios WHERE entity_id = $1::uuid`,
      [entity_id]
    );

    const meetingResultado = await query(
      `INSERT INTO meetings (entity_id, titulo, tipo, fecha_hora_prevista, censo_total_propietarios, censo_total_coeficiente)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, entity_id, titulo, tipo, estado, fecha_hora_prevista, censo_total_propietarios, censo_total_coeficiente, creado_en`,
      [entity_id, titulo, tipoJunta, fecha_hora_prevista || null, censoResultado.rows[0].total, censoResultado.rows[0].coeficiente_total]
    );
    const junta = meetingResultado.rows[0];

    const puntosCreados = [];
    for (let i = 0; i < puntos.length; i++) {
      const texto = String(puntos[i]?.texto || '').trim();
      if (!texto) continue;
      const tipoPunto = puntos[i]?.tipo === 'informativo' ? 'informativo' : 'votacion';
      const puntoResultado = await query(
        `INSERT INTO meeting_puntos (meeting_id, orden, texto, tipo)
         VALUES ($1, $2, $3, $4)
         RETURNING id, orden, texto, tipo, estado`,
        [junta.id, i + 1, texto, tipoPunto]
      );
      puntosCreados.push(puntoResultado.rows[0]);
    }

    if (puntosCreados.length === 0) {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'El orden del día debe incluir al menos un punto con texto.' });
    }

    await query('COMMIT');
    res.status(201).json({ success: true, meeting: { ...junta, puntos: puntosCreados } });
  } catch (err) {
    await query('ROLLBACK').catch(() => {});
    console.error('Error al crear junta:', err.message);
    res.status(500).json({ error: `Fallo al crear la junta: ${err.message}` });
  }
});

router.get('/meetings/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar las juntas de esta entidad.' });
  }

  try {
    const resultado = await query(
      `SELECT m.id, m.titulo, m.tipo, m.estado, m.fecha_hora_prevista, m.convocada_en, m.iniciada_en, m.cerrada_en, m.creado_en,
        (SELECT COUNT(*) FROM meeting_puntos p WHERE p.meeting_id = m.id) AS total_puntos
       FROM meetings m
       WHERE m.entity_id = $1::uuid
       ORDER BY m.fecha_hora_prevista DESC NULLS LAST, m.creado_en DESC`,
      [entityId]
    );
    res.status(200).json({ success: true, meetings: resultado.rows });
  } catch (err) {
    console.error('Error al listar juntas:', err.message);
    res.status(500).json({ error: `Fallo al consultar el historial de juntas: ${err.message}` });
  }
});

router.get('/meetings/actual/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar esta entidad.' });
  }

  try {
    const resultado = await query(
      `SELECT id, titulo, tipo, estado, fecha_hora_prevista
       FROM meetings
       WHERE entity_id = $1::uuid AND estado IN ('en_curso', 'programada')
       ORDER BY (estado = 'en_curso') DESC, fecha_hora_prevista ASC NULLS LAST, creado_en DESC
       LIMIT 1`,
      [entityId]
    );
    res.status(200).json({ success: true, meeting: resultado.rows[0] || null });
  } catch (err) {
    console.error('Error al consultar la junta actual:', err.message);
    res.status(500).json({ error: `Fallo al consultar la junta actual: ${err.message}` });
  }
});

router.get('/meetings/detalle/:meetingId', requireAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();

  if (!(await filaBelongsToTenant('meetings', meetingId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar esta junta.' });
  }

  try {
    const meetingResultado = await query(
      `SELECT m.id, m.entity_id, m.titulo, m.tipo, m.estado, m.fecha_hora_prevista, m.convocada_en, m.iniciada_en, m.cerrada_en,
              m.acta_texto_final, m.censo_total_propietarios, m.censo_total_coeficiente, e.nombre AS finca_nombre
       FROM meetings m
       JOIN entities e ON m.entity_id = e.id
       WHERE m.id = $1::uuid`,
      [meetingId]
    );

    if (meetingResultado.rows.length === 0) {
      return res.status(404).json({ error: 'Junta no encontrada.' });
    }

    // Los recuentos se agregan en vivo desde meeting_votos en vez de
    // guardarse como columnas en meeting_puntos: con censos de este tamaño
    // (decenas/cientos de vecinos) es barato, y así el número mostrado
    // nunca puede desincronizarse de los votos reales.
    const puntosResultado = await query(
      `SELECT p.id, p.orden, p.texto, p.tipo, p.estado, p.abierto_en, p.cerrado_en,
        COALESCE(SUM(v.coeficiente_snapshot) FILTER (WHERE v.voto = 'si'), 0) AS coeficiente_si,
        COALESCE(SUM(v.coeficiente_snapshot) FILTER (WHERE v.voto = 'no'), 0) AS coeficiente_no,
        COALESCE(SUM(v.coeficiente_snapshot) FILTER (WHERE v.voto = 'abstencion'), 0) AS coeficiente_abstencion,
        COUNT(v.id) FILTER (WHERE v.voto = 'si') AS votos_si,
        COUNT(v.id) FILTER (WHERE v.voto = 'no') AS votos_no,
        COUNT(v.id) FILTER (WHERE v.voto = 'abstencion') AS votos_abstencion,
        COUNT(v.id) AS total_votantes
       FROM meeting_puntos p
       LEFT JOIN meeting_votos v ON v.punto_id = p.id
       WHERE p.meeting_id = $1::uuid
       GROUP BY p.id
       ORDER BY p.orden ASC`,
      [meetingId]
    );

    res.status(200).json({ success: true, meeting: meetingResultado.rows[0], puntos: puntosResultado.rows });
  } catch (err) {
    console.error('Error al consultar el detalle de la junta:', err.message);
    res.status(500).json({ error: `Fallo al consultar la junta: ${err.message}` });
  }
});

router.post('/meetings/:meetingId/convocar', requireAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();

  if (!(await filaBelongsToTenant('meetings', meetingId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para convocar esta junta.' });
  }

  try {
    const meetingResultado = await query(
      `SELECT m.id, m.titulo, m.tipo, m.fecha_hora_prevista, m.entity_id, e.nombre AS finca_nombre
       FROM meetings m JOIN entities e ON m.entity_id = e.id WHERE m.id = $1::uuid`,
      [meetingId]
    );
    if (meetingResultado.rows.length === 0) {
      return res.status(404).json({ error: 'Junta no encontrada.' });
    }
    const junta = meetingResultado.rows[0];

    const censoResultado = await query(
      `SELECT id, nombre_completo, propiedad_detalle, telefono, email, canal_notificacion FROM propietarios WHERE entity_id = $1::uuid`,
      [junta.entity_id]
    );
    const despachoResultado = await query('SELECT nombre_entidad FROM tenants WHERE id = $1', [req.tenantId]);

    const { resultadoEnvio, errorEnvio } = await intentarNotificar({
      tipo: 'convocatoria',
      despacho: { id: req.tenantId, nombre: despachoResultado.rows[0]?.nombre_entidad || null },
      finca: { id: junta.entity_id, nombre: junta.finca_nombre },
      mensaje: {
        titulo: `Convocatoria — ${junta.titulo}`,
        cuerpo: `Se convoca junta ${junta.tipo} "${junta.titulo}"${junta.fecha_hora_prevista ? ` para el ${new Date(junta.fecha_hora_prevista).toLocaleString('es-ES')}` : ''}. Consulta el orden del día en VotifAI.`
      },
      destinatarios: censoResultado.rows.map((p) => ({ nombre: p.nombre_completo, propiedad: p.propiedad_detalle, telefono: p.telefono, email: p.email, canal_preferido: p.canal_notificacion }))
    });

    await query('BEGIN');
    await query(`UPDATE meetings SET convocada_en = COALESCE(convocada_en, now()) WHERE id = $1::uuid`, [meetingId]);
    await registrarNotificaciones(meetingId, 'convocatoria', censoResultado.rows, resultadoEnvio);
    await query('COMMIT');

    res.status(200).json({
      success: true,
      mensaje: errorEnvio
        ? `Convocatoria registrada, pero falló el envío: ${errorEnvio}`
        : `Convocatoria enviada a ${censoResultado.rows.length} propietarios.`,
      resultado: resultadoEnvio
    });
  } catch (err) {
    await query('ROLLBACK').catch(() => {});
    console.error('Error al convocar junta:', err.message);
    res.status(500).json({ error: `Fallo al convocar la junta: ${err.message}` });
  }
});

router.post('/meetings/:meetingId/iniciar', requireAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();

  if (!(await filaBelongsToTenant('meetings', meetingId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para iniciar esta junta.' });
  }

  try {
    const resultado = await query(
      `UPDATE meetings SET estado = 'en_curso', iniciada_en = now()
       WHERE id = $1::uuid AND estado = 'programada'
       RETURNING id, estado, iniciada_en`,
      [meetingId]
    );
    if (resultado.rowCount === 0) {
      return res.status(409).json({ error: 'Solo se puede iniciar una junta que esté programada.' });
    }
    res.status(200).json({ success: true, meeting: resultado.rows[0] });
  } catch (err) {
    console.error('Error al iniciar junta:', err.message);
    res.status(500).json({ error: `Fallo al iniciar la junta: ${err.message}` });
  }
});

// Abrir/cerrar un punto marca cuál es el "actual" de la sala en vivo —
// aplica a cualquier tipo de punto (también a los informativos, como
// "Ruegos y Preguntas", que sirven para estructurar el tiempo de la sesión
// aunque no se vote). Solo la emisión de voto exige tipo='votacion'.
router.post('/meetings/:meetingId/puntos/:puntoId/abrir-votacion', requireAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();
  const puntoId = String(req.params.puntoId).trim();

  if (!(await puntoBelongsToTenant(puntoId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para gestionar este punto.' });
  }

  try {
    const meetingResultado = await query('SELECT estado FROM meetings WHERE id = $1::uuid', [meetingId]);
    if (meetingResultado.rows[0]?.estado !== 'en_curso') {
      return res.status(409).json({ error: 'La junta debe estar en curso para abrir un punto.' });
    }

    const resultado = await query(
      `UPDATE meeting_puntos SET estado = 'votando', abierto_en = now()
       WHERE id = $1::uuid AND meeting_id = $2::uuid AND estado = 'pendiente'
       RETURNING id, estado, abierto_en`,
      [puntoId, meetingId]
    );
    if (resultado.rowCount === 0) {
      return res.status(409).json({ error: 'El punto no se puede abrir (ya está abierto o cerrado).' });
    }
    res.status(200).json({ success: true, punto: resultado.rows[0] });
  } catch (err) {
    console.error('Error al abrir punto:', err.message);
    res.status(500).json({ error: `Fallo al abrir el punto: ${err.message}` });
  }
});

router.post('/meetings/:meetingId/puntos/:puntoId/cerrar-votacion', requireAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();
  const puntoId = String(req.params.puntoId).trim();

  if (!(await puntoBelongsToTenant(puntoId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para gestionar este punto.' });
  }

  try {
    const resultado = await query(
      `UPDATE meeting_puntos SET estado = 'cerrado', cerrado_en = now()
       WHERE id = $1::uuid AND meeting_id = $2::uuid AND estado = 'votando'
       RETURNING id, estado, cerrado_en`,
      [puntoId, meetingId]
    );
    if (resultado.rowCount === 0) {
      return res.status(409).json({ error: 'El punto no está abierto.' });
    }
    res.status(200).json({ success: true, punto: resultado.rows[0] });
  } catch (err) {
    console.error('Error al cerrar punto:', err.message);
    res.status(500).json({ error: `Fallo al cerrar el punto: ${err.message}` });
  }
});

router.post('/meetings/:meetingId/cerrar', requireAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();
  const { acta_texto } = req.body;

  if (!acta_texto) {
    return res.status(400).json({ error: 'El texto del acta es obligatorio para cerrar la junta.' });
  }
  if (!(await filaBelongsToTenant('meetings', meetingId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para cerrar esta junta.' });
  }

  try {
    const meetingResultado = await query(
      `SELECT m.id, m.titulo, m.tipo, m.entity_id, e.nombre AS finca_nombre
       FROM meetings m JOIN entities e ON m.entity_id = e.id WHERE m.id = $1::uuid`,
      [meetingId]
    );
    if (meetingResultado.rows.length === 0) {
      return res.status(404).json({ error: 'Junta no encontrada.' });
    }
    const junta = meetingResultado.rows[0];

    const censoResultado = await query(
      `SELECT id, nombre_completo, propiedad_detalle, telefono, email, canal_notificacion FROM propietarios WHERE entity_id = $1::uuid`,
      [junta.entity_id]
    );
    const despachoResultado = await query(
      'SELECT nombre_entidad, cif, direccion, telefono, email_maestro FROM tenants WHERE id = $1',
      [req.tenantId]
    );
    const despacho = despachoResultado.rows[0] || {};

    // El PDF lleva el membrete del despacho, no el de VotifAI — si falla
    // la generación no bloqueamos el cierre de la junta, se manda sin
    // adjunto y queda registrado en el log del servidor.
    let actaPdfBase64 = null;
    try {
      const pdfBuffer = await generarActaPdf({
        despacho: { nombre: despacho.nombre_entidad, cif: despacho.cif, direccion: despacho.direccion, telefono: despacho.telefono, email: despacho.email_maestro },
        finca: { nombre: junta.finca_nombre },
        meeting: { tipo: junta.tipo, titulo: junta.titulo, cerrada_en: new Date().toISOString() },
        actaTexto: acta_texto
      });
      actaPdfBase64 = pdfBuffer.toString('base64');
    } catch (errPdf) {
      console.error('Fallo al generar el PDF del acta (se envía sin adjunto):', errPdf.message);
    }

    const nombreArchivoPdf = `Acta - ${junta.finca_nombre} - ${new Date().toISOString().slice(0, 10)}.pdf`.replace(/[/\\?%*:|"<>]/g, '-');

    const { resultadoEnvio, errorEnvio } = await intentarNotificar({
      tipo: 'acta_cierre',
      despacho: { id: req.tenantId, nombre: despacho.nombre_entidad || null },
      finca: { id: junta.entity_id, nombre: junta.finca_nombre },
      mensaje: {
        titulo: `Acta de la junta — ${junta.titulo}`,
        cuerpo: `Se adjunta el acta de la junta ${junta.tipo === 'extraordinaria' ? 'extraordinaria' : 'ordinaria'} "${junta.titulo}", ya clausurada. También puede consultarla desde su cuenta en VotifAI.`
      },
      destinatarios: censoResultado.rows.map((p) => ({ nombre: p.nombre_completo, propiedad: p.propiedad_detalle, telefono: p.telefono, email: p.email, canal_preferido: p.canal_notificacion })),
      ...(actaPdfBase64 ? { archivo_adjunto: { nombre: nombreArchivoPdf, tipo: 'application/pdf', contenido_base64: actaPdfBase64 } } : {})
    });

    await query('BEGIN');
    const cierreResultado = await query(
      `UPDATE meetings SET estado = 'cerrada', cerrada_en = now(), acta_texto_final = $1, acta_pdf_base64 = $2
       WHERE id = $3::uuid AND estado = 'en_curso'
       RETURNING id, estado, cerrada_en`,
      [acta_texto, actaPdfBase64, meetingId]
    );
    if (cierreResultado.rowCount === 0) {
      await query('ROLLBACK');
      return res.status(409).json({ error: 'Solo se puede cerrar una junta que esté en curso.' });
    }
    await registrarNotificaciones(meetingId, 'acta_cierre', censoResultado.rows, resultadoEnvio);
    await query('COMMIT');

    res.status(200).json({
      success: true,
      mensaje: errorEnvio
        ? `Junta cerrada, pero falló la notificación del acta: ${errorEnvio}`
        : `Junta cerrada y acta notificada a ${censoResultado.rows.length} propietarios.`,
      resultado: resultadoEnvio
    });
  } catch (err) {
    await query('ROLLBACK').catch(() => {});
    console.error('Error al cerrar junta:', err.message);
    res.status(500).json({ error: `Fallo al cerrar la junta: ${err.message}` });
  }
});

router.get('/meetings/:meetingId/acta-pdf', requireAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();

  if (!(await filaBelongsToTenant('meetings', meetingId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para descargar esta acta.' });
  }

  try {
    const resultado = await query(
      `SELECT titulo, acta_pdf_base64 FROM meetings WHERE id = $1::uuid AND estado = 'cerrada'`,
      [meetingId]
    );
    if (resultado.rows.length === 0 || !resultado.rows[0].acta_pdf_base64) {
      return res.status(404).json({ error: 'No hay PDF de acta disponible para esta junta.' });
    }
    const { titulo, acta_pdf_base64 } = resultado.rows[0];
    const nombreArchivo = `Acta - ${titulo}.pdf`.replace(/[/\\?%*:|"<>]/g, '-');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);
    res.send(Buffer.from(acta_pdf_base64, 'base64'));
  } catch (err) {
    console.error('Error al descargar el PDF del acta:', err.message);
    res.status(500).json({ error: `Fallo al descargar el PDF: ${err.message}` });
  }
});

// =========================================================================
// 🏘️ JUNTAS (vecino) — consulta de la junta en curso y emisión de voto.
// =========================================================================

router.get('/meetings/vecino/:entityId/actual', requireVoterAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (req.voterEntityId !== entityId) {
    return res.status(403).json({ error: 'Tu sesión no corresponde a esta comunidad.' });
  }

  try {
    const meetingResultado = await query(
      `SELECT id, titulo, tipo, fecha_hora_prevista FROM meetings
       WHERE entity_id = $1::uuid AND estado = 'en_curso'
       ORDER BY iniciada_en DESC LIMIT 1`,
      [entityId]
    );

    if (meetingResultado.rows.length === 0) {
      return res.status(200).json({ success: true, meeting: null, puntos: [] });
    }
    const junta = meetingResultado.rows[0];

    // El vecino nunca ve el recuento en vivo (solo su propio voto): evita
    // el efecto arrastre de ver cómo van votando los demás antes de
    // decidir el propio voto. El resultado se revela al cerrar el punto.
    const puntosResultado = await query(
      `SELECT p.id, p.orden, p.texto, p.tipo, p.estado,
        (SELECT voto FROM meeting_votos v WHERE v.punto_id = p.id AND v.propietario_id = $2::uuid) AS mi_voto
       FROM meeting_puntos p
       WHERE p.meeting_id = $1::uuid
       ORDER BY p.orden ASC`,
      [junta.id, req.propietarioId]
    );

    res.status(200).json({ success: true, meeting: junta, puntos: puntosResultado.rows });
  } catch (err) {
    console.error('Error al consultar la junta en curso:', err.message);
    res.status(500).json({ error: `Fallo al consultar la junta en curso: ${err.message}` });
  }
});

// Historial + detalle de juntas cerradas para el vecino: sin esto, un
// propietario al que le falla la notificación (rebote, spam, sin email)
// no tiene ninguna forma de recuperar el acta — el resto de rutas de
// vecino solo exponen la junta mientras está 'en_curso'.
router.get('/meetings/vecino/:entityId/historial', requireVoterAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (req.voterEntityId !== entityId) {
    return res.status(403).json({ error: 'Tu sesión no corresponde a esta comunidad.' });
  }

  try {
    const resultado = await query(
      `SELECT id, titulo, tipo, cerrada_en, (acta_pdf_base64 IS NOT NULL) AS tiene_pdf
       FROM meetings WHERE entity_id = $1::uuid AND estado = 'cerrada'
       ORDER BY cerrada_en DESC`,
      [entityId]
    );
    res.status(200).json({ success: true, meetings: resultado.rows });
  } catch (err) {
    console.error('Error al listar el historial de juntas del vecino:', err.message);
    res.status(500).json({ error: `Fallo al consultar el historial: ${err.message}` });
  }
});

router.get('/meetings/vecino/detalle/:meetingId', requireVoterAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();

  try {
    const resultado = await query(
      `SELECT m.id, m.titulo, m.tipo, m.cerrada_en, m.acta_texto_final, (m.acta_pdf_base64 IS NOT NULL) AS tiene_pdf, e.nombre AS finca_nombre
       FROM meetings m JOIN entities e ON m.entity_id = e.id
       WHERE m.id = $1::uuid AND m.entity_id = $2::uuid AND m.estado = 'cerrada'`,
      [meetingId, req.voterEntityId]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Junta no encontrada o no pertenece a tu comunidad.' });
    }
    res.status(200).json({ success: true, meeting: resultado.rows[0] });
  } catch (err) {
    console.error('Error al consultar el detalle de la junta (vecino):', err.message);
    res.status(500).json({ error: `Fallo al consultar la junta: ${err.message}` });
  }
});

router.get('/meetings/vecino/:meetingId/acta-pdf', requireVoterAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();

  try {
    const resultado = await query(
      `SELECT titulo, acta_pdf_base64 FROM meetings WHERE id = $1::uuid AND entity_id = $2::uuid AND estado = 'cerrada'`,
      [meetingId, req.voterEntityId]
    );
    if (resultado.rows.length === 0 || !resultado.rows[0].acta_pdf_base64) {
      return res.status(404).json({ error: 'No hay PDF de acta disponible para esta junta.' });
    }
    const { titulo, acta_pdf_base64 } = resultado.rows[0];
    const nombreArchivo = `Acta - ${titulo}.pdf`.replace(/[/\\?%*:|"<>]/g, '-');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);
    res.send(Buffer.from(acta_pdf_base64, 'base64'));
  } catch (err) {
    console.error('Error al descargar el PDF del acta (vecino):', err.message);
    res.status(500).json({ error: `Fallo al descargar el PDF: ${err.message}` });
  }
});

router.post('/meetings/vecino/puntos/:puntoId/votar', requireVoterAuth, async (req, res) => {
  const puntoId = String(req.params.puntoId).trim();
  const voto = String(req.body.voto || '').trim();

  if (!['si', 'no', 'abstencion'].includes(voto)) {
    return res.status(400).json({ error: 'El voto debe ser "si", "no" o "abstencion".' });
  }
  if (!(await puntoBelongsToEntity(puntoId, req.voterEntityId))) {
    return res.status(403).json({ error: 'No autorizado para votar este punto.' });
  }

  try {
    const puntoResultado = await query('SELECT estado, tipo FROM meeting_puntos WHERE id = $1::uuid', [puntoId]);
    if (puntoResultado.rows.length === 0) {
      return res.status(404).json({ error: 'Punto no encontrado.' });
    }
    const punto = puntoResultado.rows[0];
    if (punto.tipo !== 'votacion') {
      return res.status(400).json({ error: 'Este punto es informativo y no admite votación.' });
    }
    if (punto.estado !== 'votando') {
      return res.status(409).json({ error: 'La votación de este punto no está abierta.' });
    }

    const propietarioResultado = await query('SELECT coeficiente FROM propietarios WHERE id = $1::uuid', [req.propietarioId]);
    if (propietarioResultado.rows.length === 0) {
      return res.status(404).json({ error: 'Propietario no encontrado.' });
    }
    const coeficiente = propietarioResultado.rows[0].coeficiente;

    // ON CONFLICT sobre UNIQUE(punto_id, propietario_id): permite cambiar
    // el voto mientras el punto siga abierto sin crear filas duplicadas.
    await query(
      `INSERT INTO meeting_votos (punto_id, propietario_id, voto, coeficiente_snapshot)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (punto_id, propietario_id)
       DO UPDATE SET voto = EXCLUDED.voto, coeficiente_snapshot = EXCLUDED.coeficiente_snapshot, votado_en = now()`,
      [puntoId, req.propietarioId, voto, coeficiente]
    );

    res.status(200).json({ success: true, voto });
  } catch (err) {
    console.error('Error al registrar voto:', err.message);
    res.status(500).json({ error: `Fallo al registrar el voto: ${err.message}` });
  }
});

// =========================================================================
// Helpers internos
// =========================================================================

// notificar() es una única llamada de lote contra el webhook de n8n (no
// una por destinatario), así que un fallo o la ausencia de
// N8N_WEBHOOK_URL aplica igual a todos los destinatarios de este envío.
async function intentarNotificar(payload) {
  try {
    const resultado = await notificar(payload);
    return { resultadoEnvio: resultado.real ? 'enviado' : 'simulado', errorEnvio: null };
  } catch (err) {
    console.error(`Fallo al notificar (${payload.tipo}):`, err.message);
    return { resultadoEnvio: 'error', errorEnvio: err.message };
  }
}

async function registrarNotificaciones(meetingId, tipo, propietarios, resultado) {
  for (const p of propietarios) {
    await query(
      `INSERT INTO meeting_notificaciones (meeting_id, propietario_id, tipo, destinatario_nombre, destinatario_propiedad, destinatario_email, destinatario_telefono, resultado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [meetingId, p.id, tipo, p.nombre_completo, p.propiedad_detalle, p.email, p.telefono, resultado]
    );
  }
}

export default router;
