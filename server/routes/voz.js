import { Router } from 'express';
import multer from 'multer';
import { query } from '../db.js';
import { requireAuth, requireVoterAuth, entityBelongsToTenant } from '../middleware/auth.js';
import { fincaPermiteTranscripcion, motivoSinVozEnPrueba } from '../lib/suscripciones.js';

const router = Router();

// Audio en memoria (no a disco) — los ficheros son cortos (una
// intervención hablada) y se descartan en cuanto se transcriben.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// =========================================================================
// 🙋 ASISTENCIA (grabación de intervenciones — requiere sesión de vecino
// real, ver server/routes/vecinos.js para el registro/login)
// =========================================================================

router.post('/asistencia/:entityId/voz', requireVoterAuth, upload.single('audio'), async (req, res) => {
  const entityId = String(req.params.entityId).trim();
  const { duracion_segundos } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No se ha recibido ningún audio.' });
  }

  // La sesión de vecino se emitió para una finca concreta — no vale para
  // hablar en nombre de un propietario de otra finca aunque conozca el
  // enlace.
  if (req.voterEntityId !== entityId) {
    return res.status(403).json({ error: 'Tu sesión no corresponde a esta comunidad.' });
  }
  const propietario_id = req.propietarioId;

  try {
    if (!(await fincaPermiteTranscripcion(entityId))) {
      return res.status(402).json({ error: 'La transcripción por voz no está incluida en el plan de tu administrador de fincas.', codigo: 'VOZ_NO_INCLUIDA' });
    }

    const motivoPrueba = await motivoSinVozEnPrueba(entityId);
    if (motivoPrueba) return res.status(402).json({ error: motivoPrueba, codigo: 'VOZ_LIMITE_PRUEBA' });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'El servidor no tiene configurada la transcripción por voz (falta OPENAI_API_KEY).' });
    }

    const formulario = new FormData();
    formulario.append('file', new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' }), 'intervencion.webm');
    formulario.append('model', 'gpt-4o-transcribe');
    formulario.append('language', 'es');

    const respuestaOpenAI = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: formulario
    });

    if (!respuestaOpenAI.ok) {
      const detalle = await respuestaOpenAI.text();
      console.error('Error de la API de transcripción:', detalle);
      // 500 y no 502: el proxy de EasyPanel sustituye los 502 por una página HTML.
      return res.status(500).json({ error: 'Fallo al transcribir el audio con el proveedor de voz.' });
    }

    const { text } = await respuestaOpenAI.json();
    const texto = (text || '').trim();

    if (!texto) {
      return res.status(200).json({ success: true, vacio: true, mensaje: 'No se detectó voz en la grabación.' });
    }

    const resultado = await query(
      `INSERT INTO transcripciones (entity_id, propietario_id, texto, duracion_segundos)
       VALUES ($1, $2, $3, $4)
       RETURNING id, texto, creado_en`,
      [entityId, propietario_id, texto, duracion_segundos || null]
    );

    res.status(201).json({ success: true, transcripcion: resultado.rows[0] });
  } catch (err) {
    console.error('Error al transcribir intervención:', err.message);
    res.status(500).json({ error: `Fallo al procesar la intervención: ${err.message}` });
  }
});

// =========================================================================
// 📝 TRANSCRIPCIONES (panel del secretario, requiere sesión de despacho)
// =========================================================================

router.get('/transcripciones/lista/:entityId', requireAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para consultar las transcripciones de esta entidad.' });
  }

  try {
    const resultado = await query(
      `SELECT t.id, t.texto, t.duracion_segundos, t.creado_en, t.propietario_id,
              p.nombre_completo AS propietario_nombre, p.propiedad_detalle
       FROM transcripciones t
       LEFT JOIN propietarios p ON t.propietario_id = p.id
       WHERE t.entity_id = $1::uuid
       ORDER BY t.creado_en ASC`,
      [entityId]
    );
    res.status(200).json({ success: true, transcripciones: resultado.rows });
  } catch (err) {
    console.error('Error al listar transcripciones:', err.message);
    res.status(500).json({ error: `Fallo al consultar las transcripciones: ${err.message}` });
  }
});

export default router;
