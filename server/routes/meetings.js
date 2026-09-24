import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { notificar } from '../lib/notificaciones.js';
import { generarActaPdf } from '../lib/pdfActa.js';
import { reservarJuntaIniciada } from '../lib/suscripciones.js';
import { deudoresVencidos } from '../lib/morosidad.js';
import { calcularResultado, TIPOS_MAYORIA } from '../lib/mayorias.js';
import { fechaHoraES } from '../lib/fechas.js';
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
    const creada = await withTransaction(async (tx) => {
      // Se congela aquí el tamaño del censo (cabezas y coeficiente) para que
      // el cuórum de esta junta no cambie si el censo se edita más adelante.
      const censoResultado = await tx(
        `SELECT COUNT(*)::int AS total, COALESCE(SUM(coeficiente), 0) AS coeficiente_total
         FROM propietarios WHERE entity_id = $1::uuid`,
        [entity_id]
      );

      const meetingResultado = await tx(
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
        // Mayoría exigida por la LPH para este punto (art. 17). Por
        // defecto simple, que es la de la mayoría de acuerdos ordinarios.
        const mayoria = TIPOS_MAYORIA.includes(puntos[i]?.mayoria) ? puntos[i].mayoria : 'simple';
        const puntoResultado = await tx(
          `INSERT INTO meeting_puntos (meeting_id, orden, texto, tipo, mayoria)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, orden, texto, tipo, mayoria, estado`,
          [junta.id, i + 1, texto, tipoPunto, mayoria]
        );
        puntosCreados.push(puntoResultado.rows[0]);
      }

      return puntosCreados.length === 0 ? { rollback: true } : { junta, puntosCreados };
    });

    if (creada.rollback) {
      return res.status(400).json({ error: 'El orden del día debe incluir al menos un punto con texto.' });
    }
    res.status(201).json({ success: true, meeting: { ...creada.junta, puntos: creada.puntosCreados } });
  } catch (err) {
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
      `SELECT m.id, m.entity_id, m.titulo, m.tipo, m.estado, m.convocatoria, m.fecha_hora_prevista, m.convocada_en, m.iniciada_en, m.cerrada_en,
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
      `SELECT p.id, p.orden, p.texto, p.tipo, p.mayoria, p.estado, p.abierto_en, p.cerrado_en,
        COALESCE(SUM(v.coeficiente_snapshot) FILTER (WHERE v.voto = 'si'), 0) AS coeficiente_si,
        COALESCE(SUM(v.coeficiente_snapshot) FILTER (WHERE v.voto = 'no'), 0) AS coeficiente_no,
        COALESCE(SUM(v.coeficiente_snapshot) FILTER (WHERE v.voto = 'abstencion'), 0) AS coeficiente_abstencion,
        COUNT(v.id) FILTER (WHERE v.voto = 'si') AS votos_si,
        COUNT(v.id) FILTER (WHERE v.voto = 'no') AS votos_no,
        COUNT(v.id) FILTER (WHERE v.voto = 'abstencion') AS votos_abstencion,
        COUNT(v.id) AS total_votantes,
        COUNT(v.id) FILTER (WHERE v.origen = 'app') AS votos_app,
        COUNT(v.id) FILTER (WHERE v.origen = 'sala') AS votos_sala,
        COUNT(v.id) FILTER (WHERE v.origen = 'representacion') AS votos_representacion
       FROM meeting_puntos p
       LEFT JOIN meeting_votos v ON v.punto_id = p.id
       WHERE p.meeting_id = $1::uuid
       GROUP BY p.id
       ORDER BY p.orden ASC`,
      [meetingId]
    );

    // Intervenciones de voz de esta junta, para que el borrador del acta las
    // recoja con el nombre de quien habló y el punto en que lo hizo.
    const intervencionesResultado = await query(
      `SELECT t.id, t.texto, t.creado_en, t.punto_id, p.nombre_completo AS propietario_nombre, p.propiedad_detalle
       FROM transcripciones t
       LEFT JOIN propietarios p ON t.propietario_id = p.id
       WHERE t.meeting_id = $1::uuid
       ORDER BY t.creado_en ASC`,
      [meetingId]
    );

    // El resultado de cada punto se calcula aquí, con la mayoría que exige
    // la LPH, y lo usan igual el monitor en vivo y el borrador del acta:
    // así no puede haber dos cálculos distintos del mismo acuerdo.
    const junta = meetingResultado.rows[0];
    const privados = await query(
      `SELECT propietario_id, nombre_completo, propiedad_detalle, coeficiente, deuda, habilitado, habilitado_motivo
       FROM meeting_privados_voto WHERE meeting_id = $1::uuid ORDER BY propiedad_detalle ASC NULLS LAST, nombre_completo ASC`,
      [meetingId]
    );
    const sinVoto = privados.rows.filter((p) => !p.habilitado);
    const censo = { propietarios: Number(junta.censo_total_propietarios) || 0, coeficiente: Number(junta.censo_total_coeficiente) || 0 };
    const privadosComputo = { propietarios: sinVoto.length, coeficiente: sinVoto.reduce((t, p) => t + Number(p.coeficiente || 0), 0) };

    const puntos = puntosResultado.rows.map((p) => (p.tipo !== 'votacion' ? p : {
      ...p,
      resultado: calcularResultado({
        mayoria: p.mayoria,
        convocatoria: junta.convocatoria || 'primera',
        censo,
        privados: privadosComputo,
        votos: {
          si: Number(p.votos_si), no: Number(p.votos_no), abstencion: Number(p.votos_abstencion),
          coefSi: Number(p.coeficiente_si), coefNo: Number(p.coeficiente_no), coefAbs: Number(p.coeficiente_abstencion)
        }
      })
    }));

    // Sala: quién asiste en persona o representado, y el voto de cada
    // propietario en cada punto (de cualquier origen), para que el
    // despacho vea en el panel de sala quién falta por votar.
    const [asistencia, votos] = await Promise.all([
      query(
        `SELECT a.propietario_id, a.modo, a.representante_nombre, a.representacion_escrita, a.delegacion_id,
                d.solicitada_en AS delegacion_solicitada_en, d.respondida_en AS delegacion_aceptada_en,
                p.nombre_completo, p.propiedad_detalle, p.coeficiente
         FROM meeting_asistencia a JOIN propietarios p ON p.id = a.propietario_id
         LEFT JOIN meeting_delegaciones d ON d.id = a.delegacion_id
         WHERE a.meeting_id = $1::uuid ORDER BY p.propiedad_detalle ASC NULLS LAST, p.nombre_completo ASC`,
        [meetingId]
      ),
      query(
        `SELECT v.punto_id, v.propietario_id, v.voto, v.origen, pr.nombre_completo, pr.propiedad_detalle, pr.coeficiente
         FROM meeting_votos v
         JOIN meeting_puntos p ON p.id = v.punto_id
         JOIN propietarios pr ON pr.id = v.propietario_id
         WHERE p.meeting_id = $1::uuid`,
        [meetingId]
      )
    ]);

    res.status(200).json({
      success: true,
      meeting: junta,
      puntos,
      privadosVoto: privados.rows,
      asistencia: asistencia.rows,
      votos: votos.rows,
      intervenciones: intervencionesResultado.rows
    });
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

    // Art. 16.2 LPH: la convocatoria contiene la relación de propietarios
    // que no están al corriente de pago y advierte de la privación del voto.
    const deudores = await deudoresVencidos(junta.entity_id);
    const avisoDeudores = deudores.length
      ? `\n\nPropietarios que no están al corriente en el pago de las deudas vencidas con la comunidad (art. 16.2 LPH): ${deudores.map((d) => `${d.nombre_completo}${d.propiedad_detalle ? ` (${d.propiedad_detalle})` : ''}`).join(', ')}. Si al comienzo de la junta no han saldado su deuda, ni la han impugnado judicialmente o consignado, podrán participar en las deliberaciones pero no tendrán derecho de voto (art. 15.2 LPH).`
      : '';

    const { resultadoEnvio, errorEnvio } = await intentarNotificar({
      tipo: 'convocatoria',
      despacho: { id: req.tenantId, nombre: despachoResultado.rows[0]?.nombre_entidad || null },
      finca: { id: junta.entity_id, nombre: junta.finca_nombre },
      mensaje: {
        titulo: `Convocatoria — ${junta.titulo}`,
        cuerpo: `Se convoca junta ${junta.tipo} "${junta.titulo}"${junta.fecha_hora_prevista ? ` para el ${fechaHoraES(junta.fecha_hora_prevista)}` : ''}. Consulta el orden del día en VotifAI.${avisoDeudores}`
      },
      destinatarios: censoResultado.rows.map((p) => ({ nombre: p.nombre_completo, propiedad: p.propiedad_detalle, telefono: p.telefono, email: p.email, canal_preferido: p.canal_notificacion }))
    });

    await withTransaction(async (tx) => {
      await tx(`UPDATE meetings SET convocada_en = COALESCE(convocada_en, now()) WHERE id = $1::uuid`, [meetingId]);
      await registrarNotificaciones(tx, meetingId, 'convocatoria', censoResultado.rows, resultadoEnvio);
    });

    res.status(200).json({
      success: true,
      mensaje: errorEnvio
        ? `Convocatoria registrada, pero falló el envío: ${errorEnvio}`
        : `Convocatoria enviada a ${censoResultado.rows.length} propietarios.`,
      resultado: resultadoEnvio
    });
  } catch (err) {
    console.error('Error al convocar junta:', err.message);
    res.status(500).json({ error: `Fallo al convocar la junta: ${err.message}` });
  }
});

router.post('/meetings/:meetingId/iniciar', requireAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();
  // Si la junta se celebra en 1ª o 2ª convocatoria cambia la mayoría simple
  // (art. 17.7 LPH), así que el despacho lo indica al iniciarla.
  const convocatoria = String(req.body?.convocatoria || '').trim();
  if (!['primera', 'segunda'].includes(convocatoria)) {
    return res.status(400).json({ error: 'Indica si la junta se celebra en primera o en segunda convocatoria.' });
  }

  if (!(await filaBelongsToTenant('meetings', meetingId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para iniciar esta junta.' });
  }

  try {
    const entidad = await query('SELECT entity_id FROM meetings WHERE id = $1::uuid', [meetingId]);
    if (entidad.rows.length === 0) return res.status(404).json({ error: 'Junta no encontrada.' });

    // Art. 15.2 LPH: cuenta la situación "en el momento de iniciarse la
    // junta", así que la relación de privados de voto se congela aquí.
    const deudores = await deudoresVencidos(entidad.rows[0].entity_id);

    // Todo o nada: si la junta no se puede iniciar, no se consume ninguna de
    // las juntas de la prueba ni queda una lista de privados a medias.
    const inicio = await withTransaction(async (tx) => {
      const resultado = await tx(
        `UPDATE meetings SET estado = 'en_curso', iniciada_en = now(), convocatoria = $2
         WHERE id = $1::uuid AND estado = 'programada'
         RETURNING id, estado, iniciada_en, convocatoria`,
        [meetingId, convocatoria]
      );
      if (resultado.rowCount === 0) {
        return { rollback: true, status: 409, body: { error: 'Solo se puede iniciar una junta que esté programada.' } };
      }

      const reserva = await reservarJuntaIniciada(req.tenantId, tx);
      if (!reserva.ok) {
        return { rollback: true, status: reserva.status, body: { error: reserva.error, codigo: 'LIMITE_JUNTAS_PRUEBA' } };
      }

      for (const d of deudores) {
        await tx(
          `INSERT INTO meeting_privados_voto (meeting_id, propietario_id, nombre_completo, propiedad_detalle, coeficiente, deuda)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [meetingId, d.propietario_id, d.nombre_completo, d.propiedad_detalle, d.coeficiente || 0, d.deuda]
        );
      }
      return { status: 200, body: { success: true, meeting: resultado.rows[0], privadosDeVoto: deudores.length } };
    });
    res.status(inicio.status).json(inicio.body);
  } catch (err) {
    console.error('Error al iniciar junta:', err.message);
    res.status(500).json({ error: `Fallo al iniciar la junta: ${err.message}` });
  }
});

// Art. 15.2 LPH: un privado de voto recupera el derecho si salda la deuda
// en la propia junta o acredita haberla impugnado judicialmente o
// consignado. El despacho lo habilita (o lo revierte) con el motivo, que
// queda en el acta.
router.put('/meetings/:meetingId/privados/:propietarioId', requireAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();
  const propietarioId = String(req.params.propietarioId).trim();
  const habilitado = req.body?.habilitado === true;
  const motivo = String(req.body?.motivo || '').trim();

  if (!(await filaBelongsToTenant('meetings', meetingId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para gestionar esta junta.' });
  }
  if (habilitado && !motivo) {
    return res.status(400).json({ error: 'Indica el motivo por el que se habilita el voto (pago en la junta, impugnación o consignación).' });
  }

  try {
    const junta = await query('SELECT estado FROM meetings WHERE id = $1::uuid', [meetingId]);
    if (junta.rows[0]?.estado !== 'en_curso') {
      return res.status(409).json({ error: 'Solo se puede cambiar durante una junta en curso.' });
    }
    const resultado = await query(
      `UPDATE meeting_privados_voto
       SET habilitado = $3, habilitado_motivo = $4, habilitado_en = CASE WHEN $3 THEN now() ELSE NULL END
       WHERE meeting_id = $1::uuid AND propietario_id = $2::uuid
       RETURNING propietario_id, habilitado, habilitado_motivo`,
      [meetingId, propietarioId, habilitado, habilitado ? motivo : null]
    );
    if (resultado.rowCount === 0) {
      return res.status(404).json({ error: 'Ese propietario no figura como privado de voto en esta junta.' });
    }
    res.status(200).json({ success: true, privado: resultado.rows[0] });
  } catch (err) {
    console.error('Error al habilitar el voto de un privado:', err.message);
    res.status(500).json({ error: `Fallo al actualizar el derecho de voto: ${err.message}` });
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
      `SELECT m.id, m.titulo, m.tipo, m.estado, m.entity_id, e.nombre AS finca_nombre
       FROM meetings m JOIN entities e ON m.entity_id = e.id WHERE m.id = $1::uuid`,
      [meetingId]
    );
    if (meetingResultado.rows.length === 0) {
      return res.status(404).json({ error: 'Junta no encontrada.' });
    }
    const junta = meetingResultado.rows[0];
    // Antes de generar el PDF y notificar: si no, un segundo intento sobre
    // una junta ya cerrada volvía a mandar el acta a todo el censo.
    if (junta.estado !== 'en_curso') {
      return res.status(409).json({ error: 'Solo se puede cerrar una junta que esté en curso.' });
    }

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

    const cierre = await withTransaction(async (tx) => {
      const cierreResultado = await tx(
        `UPDATE meetings SET estado = 'cerrada', cerrada_en = now(), acta_texto_final = $1, acta_pdf_base64 = $2
         WHERE id = $3::uuid AND estado = 'en_curso'
         RETURNING id, estado, cerrada_en`,
        [acta_texto, actaPdfBase64, meetingId]
      );
      if (cierreResultado.rowCount === 0) return { rollback: true };
      await registrarNotificaciones(tx, meetingId, 'acta_cierre', censoResultado.rows, resultadoEnvio);
      return {};
    });
    if (cierre.rollback) {
      return res.status(409).json({ error: 'Solo se puede cerrar una junta que esté en curso.' });
    }

    res.status(200).json({
      success: true,
      mensaje: errorEnvio
        ? `Junta cerrada, pero falló la notificación del acta: ${errorEnvio}`
        : `Junta cerrada y acta notificada a ${censoResultado.rows.length} propietarios.`,
      resultado: resultadoEnvio
    });
  } catch (err) {
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
    const privado = await query(
      'SELECT habilitado FROM meeting_privados_voto WHERE meeting_id = $1::uuid AND propietario_id = $2::uuid',
      [junta.id, req.propietarioId]
    );
    const privadoDeVoto = privado.rows.length > 0 && !privado.rows[0].habilitado;

    // Delegaciones aceptadas: a quién representa este vecino (con su voto
    // en cada punto y si está privado de voto) y en quién ha delegado él.
    const [representados, delegadoEn] = await Promise.all([
      query(
        `SELECT p.id AS propietario_id, p.nombre_completo, p.propiedad_detalle,
                EXISTS (SELECT 1 FROM meeting_privados_voto pv WHERE pv.meeting_id = d.meeting_id AND pv.propietario_id = p.id AND NOT pv.habilitado) AS privado_de_voto,
                COALESCE((SELECT json_object_agg(v.punto_id, v.voto) FROM meeting_votos v JOIN meeting_puntos mp ON mp.id = v.punto_id
                          WHERE mp.meeting_id = d.meeting_id AND v.propietario_id = p.id), '{}'::json) AS votos
         FROM meeting_delegaciones d JOIN propietarios p ON p.id = d.representado_id
         WHERE d.meeting_id = $1::uuid AND d.representante_id = $2::uuid AND d.estado = 'aceptada'
         ORDER BY p.propiedad_detalle ASC NULLS LAST`,
        [junta.id, req.propietarioId]
      ),
      query(
        `SELECT p.nombre_completo FROM meeting_delegaciones d JOIN propietarios p ON p.id = d.representante_id
         WHERE d.meeting_id = $1::uuid AND d.representado_id = $2::uuid AND d.estado = 'aceptada'`,
        [junta.id, req.propietarioId]
      )
    ]);

    res.status(200).json({
      success: true,
      meeting: junta,
      puntos: puntosResultado.rows,
      privadoDeVoto,
      representados: representados.rows,
      votoDelegadoEn: delegadoEn.rows[0]?.nombre_completo || null
    });
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
    const puntoResultado = await query('SELECT estado, tipo, meeting_id FROM meeting_puntos WHERE id = $1::uuid', [puntoId]);
    if (puntoResultado.rows.length === 0) {
      return res.status(404).json({ error: 'Punto no encontrado.' });
    }
    const punto = puntoResultado.rows[0];

    // Voto propio o, con `en_nombre_de`, el de un vecino que ha delegado en
    // quien vota y cuya delegación está ACEPTADA para esta junta.
    const enNombreDe = String(req.body.en_nombre_de || '').trim() || null;
    let votanteId = req.propietarioId;
    let origen = 'app';
    if (enNombreDe && enNombreDe !== req.propietarioId) {
      const delegacion = await query(
        `SELECT id FROM meeting_delegaciones
         WHERE meeting_id = $1::uuid AND representado_id = $2::uuid AND representante_id = $3::uuid AND estado = 'aceptada'`,
        [punto.meeting_id, enNombreDe, req.propietarioId]
      );
      if (delegacion.rows.length === 0) {
        return res.status(403).json({ error: 'No tienes una representación aceptada de ese propietario para esta junta.' });
      }
      votanteId = enNombreDe;
      origen = 'representacion';
    } else {
      // Quien ha delegado su voto no vota por su cuenta mientras la
      // delegación siga aceptada: el voto lo tiene su representante.
      const delegada = await query(
        `SELECT p.nombre_completo FROM meeting_delegaciones d JOIN propietarios p ON p.id = d.representante_id
         WHERE d.meeting_id = $1::uuid AND d.representado_id = $2::uuid AND d.estado = 'aceptada'`,
        [punto.meeting_id, req.propietarioId]
      );
      if (delegada.rows.length > 0) {
        return res.status(409).json({
          error: `Has delegado tu voto en ${delegada.rows[0].nombre_completo} para esta junta. Si quieres votar tú, revoca antes la delegación.`,
          codigo: 'VOTO_DELEGADO'
        });
      }
    }

    // Art. 15.2 LPH: quien no estaba al corriente de pago al iniciarse la
    // junta puede participar pero no votar (ni por representante), salvo que
    // el despacho lo haya habilitado (pago en la junta, impugnación o
    // consignación).
    const privado = await query(
      'SELECT habilitado FROM meeting_privados_voto WHERE meeting_id = $1::uuid AND propietario_id = $2::uuid',
      [punto.meeting_id, votanteId]
    );
    if (privado.rows.length > 0 && !privado.rows[0].habilitado) {
      return res.status(403).json({
        error: votanteId === req.propietarioId
          ? 'No puedes votar en esta junta porque constan deudas vencidas con la comunidad al inicio de la reunión (art. 15.2 LPH). Puedes participar en las deliberaciones. Si ya has pagado, comunícaselo al administrador.'
          : 'Ese propietario está privado de voto en esta junta por deudas vencidas (art. 15.2 LPH), así que tampoco se puede votar en su nombre.',
        codigo: 'PRIVADO_DE_VOTO'
      });
    }
    if (punto.tipo !== 'votacion') {
      return res.status(400).json({ error: 'Este punto es informativo y no admite votación.' });
    }
    if (punto.estado !== 'votando') {
      return res.status(409).json({ error: 'La votación de este punto no está abierta.' });
    }

    const propietarioResultado = await query('SELECT coeficiente FROM propietarios WHERE id = $1::uuid', [votanteId]);
    if (propietarioResultado.rows.length === 0) {
      return res.status(404).json({ error: 'Propietario no encontrado.' });
    }
    const coeficiente = propietarioResultado.rows[0].coeficiente;

    // ON CONFLICT sobre UNIQUE(punto_id, propietario_id): permite cambiar
    // el voto mientras el punto siga abierto sin crear filas duplicadas.
    await query(
      `INSERT INTO meeting_votos (punto_id, propietario_id, voto, coeficiente_snapshot, origen)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (punto_id, propietario_id)
       DO UPDATE SET voto = EXCLUDED.voto, coeficiente_snapshot = EXCLUDED.coeficiente_snapshot, origen = EXCLUDED.origen, votado_en = now()`,
      [puntoId, votanteId, voto, coeficiente, origen]
    );

    res.status(200).json({ success: true, voto, propietario_id: votanteId });
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

async function registrarNotificaciones(tx, meetingId, tipo, propietarios, resultado) {
  for (const p of propietarios) {
    await tx(
      `INSERT INTO meeting_notificaciones (meeting_id, propietario_id, tipo, destinatario_nombre, destinatario_propiedad, destinatario_email, destinatario_telefono, resultado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [meetingId, p.id, tipo, p.nombre_completo, p.propiedad_detalle, p.email, p.telefono, resultado]
    );
  }
}

export default router;
