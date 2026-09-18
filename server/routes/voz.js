import { Router } from 'express';
import multer from 'multer';
import { query } from '../db.js';
import { requireAuth, entityBelongsToTenant } from '../middleware/auth.js';

const router = Router();

// Audio en memoria (no a disco) — los ficheros son cortos (una
// intervención hablada) y se descartan en cuanto se transcriben.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// =========================================================================
// 🙋 ASISTENCIA (identificación del vecino desde su móvil, sin DNI/login)
// =========================================================================

// Censo mínimo y público-por-enlace: solo lo necesario para que el vecino
// se identifique eligiendo su nombre. El entity_id (UUID no adivinable)
// hace de "código de sala" — mismo criterio que ya usaba el enlace de
// convocatoria antes de esta función.
router.get('/asistencia/:entityId/censo', async (req, res) => {
  const entityId = String(req.params.entityId).trim();

  try {
    const resultado = await query(
      `SELECT id, nombre_completo, propiedad_detalle FROM propietarios WHERE entity_id = $1::uuid ORDER BY propiedad_detalle ASC`,
      [entityId]
    );
    res.status(200).json({ success: true, propietarios: resultado.rows });
  } catch (err) {
    console.error('Error al listar censo de asistencia:', err.message);
    res.status(500).json({ error: `Fallo al consultar el censo: ${err.message}` });
  }
});

router.post('/asistencia/:entityId/voz', upload.single('audio'), async (req, res) => {
  const entityId = String(req.params.entityId).trim();
  const { propietario_id, duracion_segundos } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No se ha recibido ningún audio.' });
  }
  if (!propietario_id) {
    return res.status(400).json({ error: 'Falta identificar al propietario que interviene.' });
  }

  try {
    // El propietario tiene que pertenecer a ESTA finca (no a otra), para
    // que nadie con el enlace de una finca pueda hablar en nombre de un
    // vecino de otra.
    const propietarioValido = await query(
      `SELECT id FROM propietarios WHERE id = $1::uuid AND entity_id = $2::uuid`,
      [propietario_id, entityId]
    );
    if (propietarioValido.rows.length === 0) {
      return res.status(403).json({ error: 'El propietario indicado no pertenece a esta finca.' });
    }

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
      return res.status(502).json({ error: 'Fallo al transcribir el audio con el proveedor de voz.' });
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
