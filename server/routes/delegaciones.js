import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireVoterAuth } from '../middleware/auth.js';
import { notificar } from '../lib/notificaciones.js';

// =========================================================================
// 🤝 DELEGACIÓN DE VOTO ENTRE VECINOS (art. 15.1 LPH)
//
// El representado la solicita desde su cuenta y el representante la tiene
// que ACEPTAR desde la suya: hasta entonces no representa a nadie. Así no
// se puede nombrar representante a alguien sin que lo sepa ni votar por
// otro sin su permiso, y quedan registradas las dos voluntades y cuándo.
//
// Reglas: solo entre propietarios de la misma finca con cuenta en VotifAI
// (los dos tienen que poder identificarse), una delegación viva por
// propietario y junta, y sin cadenas (quien delega no representa a otros y
// quien representa no puede delegar el suyo). Rutas bajo /meetings/vecino
// para quedar fuera del límite de intentos de /vecinos (el panel sondea).
// =========================================================================

const router = Router();
const nombreCon = (p) => `${p.nombre_completo}${p.propiedad_detalle ? ` (${p.propiedad_detalle})` : ''}`;

async function avisar(destinatario, finca, titulo, cuerpo) {
  try {
    await notificar({
      tipo: 'delegacion_voto',
      finca,
      mensaje: { titulo, cuerpo },
      destinatarios: [{ nombre: destinatario.nombre_completo, propiedad: destinatario.propiedad_detalle, email: destinatario.email, telefono: destinatario.telefono, canal_preferido: destinatario.canal_notificacion }]
    });
  } catch (err) {
    // El aviso es de cortesía: la delegación ya consta y se ve en la app.
    console.error('No se pudo avisar de la delegación de voto:', err.message);
  }
}

async function propietario(id) {
  const r = await query(
    'SELECT id, entity_id, nombre_completo, propiedad_detalle, email, telefono, canal_notificacion, (password_hash IS NOT NULL) AS tiene_cuenta FROM propietarios WHERE id = $1::uuid',
    [id]
  );
  return r.rows[0] || null;
}

// ¿Tiene esta persona una delegación viva en esta junta, como representado
// o como representante? Sirve para impedir cadenas.
async function papelesEnJunta(meetingId, propietarioId) {
  const r = await query(
    `SELECT representado_id, representante_id FROM meeting_delegaciones
     WHERE meeting_id = $1::uuid AND estado IN ('pendiente', 'aceptada')
       AND (representado_id = $2::uuid OR representante_id = $2::uuid)`,
    [meetingId, propietarioId]
  );
  return {
    delega: r.rows.some((d) => d.representado_id === propietarioId),
    representa: r.rows.some((d) => d.representante_id === propietarioId)
  };
}

router.get('/meetings/vecino/:entityId/delegaciones', requireVoterAuth, async (req, res) => {
  const entityId = String(req.params.entityId).trim();
  if (req.voterEntityId !== entityId) return res.status(403).json({ error: 'Tu sesión no corresponde a esta comunidad.' });

  try {
    const [juntas, mias, recibidas, candidatos] = await Promise.all([
      query(
        `SELECT id, titulo, tipo, estado, fecha_hora_prevista FROM meetings
         WHERE entity_id = $1::uuid AND estado IN ('programada', 'en_curso')
         ORDER BY fecha_hora_prevista ASC NULLS LAST, creado_en ASC`,
        [entityId]
      ),
      query(
        `SELECT d.id, d.meeting_id, d.estado, d.solicitada_en, d.respondida_en, p.nombre_completo AS representante_nombre, p.propiedad_detalle AS representante_propiedad
         FROM meeting_delegaciones d JOIN propietarios p ON p.id = d.representante_id
         JOIN meetings m ON m.id = d.meeting_id
         WHERE d.representado_id = $1::uuid AND m.estado IN ('programada', 'en_curso')
           AND (d.estado IN ('pendiente', 'aceptada') OR d.respondida_en > now() - INTERVAL '7 days')
         ORDER BY d.solicitada_en DESC`,
        [req.propietarioId]
      ),
      query(
        `SELECT d.id, d.meeting_id, d.estado, d.solicitada_en, p.nombre_completo AS representado_nombre, p.propiedad_detalle AS representado_propiedad
         FROM meeting_delegaciones d JOIN propietarios p ON p.id = d.representado_id
         JOIN meetings m ON m.id = d.meeting_id
         WHERE d.representante_id = $1::uuid AND d.estado IN ('pendiente', 'aceptada') AND m.estado IN ('programada', 'en_curso')
         ORDER BY d.solicitada_en DESC`,
        [req.propietarioId]
      ),
      query(
        `SELECT id, nombre_completo, propiedad_detalle FROM propietarios
         WHERE entity_id = $1::uuid AND password_hash IS NOT NULL AND id <> $2::uuid
         ORDER BY propiedad_detalle ASC NULLS LAST, nombre_completo ASC`,
        [entityId, req.propietarioId]
      )
    ]);
    res.json({ success: true, juntas: juntas.rows, mias: mias.rows, recibidas: recibidas.rows, candidatos: candidatos.rows });
  } catch (err) {
    console.error('Error al consultar delegaciones:', err.message);
    res.status(500).json({ error: 'No se pudieron consultar las delegaciones.' });
  }
});

router.post('/meetings/vecino/delegaciones', requireVoterAuth, async (req, res) => {
  const meetingId = String(req.body?.meeting_id || '').trim();
  const representanteId = String(req.body?.representante_id || '').trim();
  if (!meetingId || !representanteId) return res.status(400).json({ error: 'Elige la junta y a tu representante.' });
  if (representanteId === req.propietarioId) return res.status(400).json({ error: 'No puedes representarte a ti mismo.' });

  try {
    const junta = await query('SELECT id, titulo, estado, entity_id FROM meetings WHERE id = $1::uuid', [meetingId]);
    const j = junta.rows[0];
    if (!j || j.entity_id !== req.voterEntityId) return res.status(404).json({ error: 'Junta no encontrada en tu comunidad.' });
    if (!['programada', 'en_curso'].includes(j.estado)) return res.status(409).json({ error: 'Esa junta ya no admite delegaciones.' });

    const [yo, representante] = await Promise.all([propietario(req.propietarioId), propietario(representanteId)]);
    if (!representante || representante.entity_id !== req.voterEntityId) {
      return res.status(404).json({ error: 'Tu representante tiene que ser propietario de esta comunidad.' });
    }
    if (!representante.tiene_cuenta) {
      return res.status(409).json({ error: 'Esa persona aún no tiene cuenta en VotifAI, así que no puede aceptar. Si te va a representar alguien sin cuenta, entrega tu escrito de representación al administrador.' });
    }

    const [misPapeles, suyos] = await Promise.all([papelesEnJunta(meetingId, req.propietarioId), papelesEnJunta(meetingId, representanteId)]);
    if (misPapeles.delega) return res.status(409).json({ error: 'Ya tienes una delegación pendiente o aceptada para esta junta. Revócala antes de pedir otra.' });
    if (misPapeles.representa) return res.status(409).json({ error: 'Representas a otro propietario en esta junta, así que no puedes delegar tu voto.' });
    if (suyos.delega) return res.status(409).json({ error: 'Esa persona ha delegado su propio voto en esta junta y no puede representar a otros.' });

    const creada = await query(
      `INSERT INTO meeting_delegaciones (meeting_id, representado_id, representante_id) VALUES ($1, $2, $3)
       RETURNING id, estado, solicitada_en`,
      [meetingId, req.propietarioId, representanteId]
    );

    await avisar(
      representante,
      { id: j.entity_id },
      `Solicitud de representación — ${j.titulo}`,
      `${nombreCon(yo)} te pide que le representes y votes en su nombre en la junta "${j.titulo}". Entra en VotifAI para aceptarlo o rechazarlo. Si no respondes, no le representarás.`
    );

    res.status(201).json({ success: true, delegacion: creada.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya tienes una delegación pendiente o aceptada para esta junta.' });
    console.error('Error al solicitar delegación:', err.message);
    res.status(500).json({ error: 'No se pudo solicitar la delegación.' });
  }
});

router.post('/meetings/vecino/delegaciones/:id/:accion', requireVoterAuth, async (req, res) => {
  const id = String(req.params.id).trim();
  const accion = req.params.accion;
  if (!['aceptar', 'rechazar', 'revocar'].includes(accion)) return res.status(404).json({ error: 'Acción no válida.' });

  try {
    const r = await query(
      `SELECT d.*, m.titulo, m.estado AS estado_junta, m.entity_id FROM meeting_delegaciones d JOIN meetings m ON m.id = d.meeting_id WHERE d.id = $1::uuid`,
      [id]
    );
    const d = r.rows[0];
    // Aceptar/rechazar solo el representante; revocar solo el representado.
    const esMia = d && (accion === 'revocar' ? d.representado_id === req.propietarioId : d.representante_id === req.propietarioId);
    if (!esMia) return res.status(404).json({ error: 'Delegación no encontrada.' });
    if (!['programada', 'en_curso'].includes(d.estado_junta)) return res.status(409).json({ error: 'La junta ya ha terminado.' });

    const [representado, representante] = await Promise.all([propietario(d.representado_id), propietario(d.representante_id)]);
    const finca = { id: d.entity_id };

    if (accion === 'aceptar') {
      if (d.estado !== 'pendiente') return res.status(409).json({ error: 'Esta solicitud ya no está pendiente.' });
      if ((await papelesEnJunta(d.meeting_id, req.propietarioId)).delega) {
        return res.status(409).json({ error: 'Has delegado tu propio voto en esta junta, así que no puedes representar a otros.' });
      }
      await withTransaction(async (tx) => {
        await tx(`UPDATE meeting_delegaciones SET estado = 'aceptada', respondida_en = now() WHERE id = $1::uuid`, [id]);
        await tx(
          `INSERT INTO meeting_asistencia (meeting_id, propietario_id, modo, representante_nombre, representacion_escrita, delegacion_id)
           VALUES ($1, $2, 'representado', $3, true, $4)
           ON CONFLICT (meeting_id, propietario_id)
           DO UPDATE SET modo = 'representado', representante_nombre = EXCLUDED.representante_nombre,
                         representacion_escrita = true, delegacion_id = EXCLUDED.delegacion_id, registrado_en = now()`,
          [d.meeting_id, d.representado_id, nombreCon(representante), id]
        );
      });
      await avisar(representado, finca, `Representación aceptada — ${d.titulo}`, `${nombreCon(representante)} ha aceptado representarte en la junta "${d.titulo}" y votará en tu nombre. Puedes revocarlo desde VotifAI mientras la junta no haya terminado.`);
      return res.json({ success: true, estado: 'aceptada' });
    }

    if (accion === 'rechazar') {
      if (d.estado !== 'pendiente') return res.status(409).json({ error: 'Esta solicitud ya no está pendiente.' });
      await query(`UPDATE meeting_delegaciones SET estado = 'rechazada', respondida_en = now() WHERE id = $1::uuid`, [id]);
      await avisar(representado, finca, `Representación no aceptada — ${d.titulo}`, `${nombreCon(representante)} no ha aceptado representarte en la junta "${d.titulo}". Puedes pedírselo a otra persona o asistir tú.`);
      return res.json({ success: true, estado: 'rechazada' });
    }

    // revocar
    if (!['pendiente', 'aceptada'].includes(d.estado)) return res.status(409).json({ error: 'Esta delegación ya no está vigente.' });
    await withTransaction(async (tx) => {
      await tx(`UPDATE meeting_delegaciones SET estado = 'revocada', revocada_en = now() WHERE id = $1::uuid`, [id]);
      await tx('DELETE FROM meeting_asistencia WHERE delegacion_id = $1::uuid', [id]);
    });
    if (d.estado === 'aceptada') {
      await avisar(representante, finca, `Representación revocada — ${d.titulo}`, `${nombreCon(representado)} ha revocado la representación en la junta "${d.titulo}". Ya no votarás en su nombre.`);
    }
    return res.json({ success: true, estado: 'revocada' });
  } catch (err) {
    console.error('Error al gestionar la delegación:', err.message);
    res.status(500).json({ error: 'No se pudo actualizar la delegación.' });
  }
});

export default router;
