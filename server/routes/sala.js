import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, filaBelongsToTenant } from '../middleware/auth.js';

// =========================================================================
// 🪑 SALA — asistencia presencial, representaciones y votos registrados
// por el despacho (art. 15.1 y 19 LPH).
//
// Sin esto solo contaban los votos emitidos desde el móvil: un propietario
// presente sin la app, o representado por otro, contaba como ausente. Los
// votos de sala se guardan en la misma tabla que los de la app
// (meeting_votos, con `origen`), así que el recuento y las mayorías los
// suman igual y un propietario nunca vota dos veces el mismo punto.
// =========================================================================

const router = Router();
const VOTOS_VALIDOS = ['si', 'no', 'abstencion'];

async function juntaEnCurso(meetingId, tenantId) {
  if (!(await filaBelongsToTenant('meetings', meetingId, tenantId))) {
    return { ok: false, status: 403, error: 'No autorizado para gestionar esta junta.' };
  }
  const junta = await query('SELECT entity_id, estado FROM meetings WHERE id = $1::uuid', [meetingId]);
  if (junta.rows[0]?.estado !== 'en_curso') {
    return { ok: false, status: 409, error: 'La junta tiene que estar en curso.' };
  }
  return { ok: true, entityId: junta.rows[0].entity_id };
}

router.put('/meetings/:meetingId/asistencia/:propietarioId', requireAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();
  const propietarioId = String(req.params.propietarioId).trim();
  const modo = req.body?.modo === 'representado' ? 'representado' : 'presencial';
  const representante = String(req.body?.representante_nombre || '').trim();
  const escrita = req.body?.representacion_escrita === true;

  if (modo === 'representado' && !representante) {
    return res.status(400).json({ error: 'Indica el nombre de quien representa al propietario.' });
  }

  try {
    const junta = await juntaEnCurso(meetingId, req.tenantId);
    if (!junta.ok) return res.status(junta.status).json({ error: junta.error });

    const propietario = await query('SELECT id FROM propietarios WHERE id = $1::uuid AND entity_id = $2::uuid', [propietarioId, junta.entityId]);
    if (propietario.rows.length === 0) {
      return res.status(404).json({ error: 'El propietario no pertenece a esta comunidad.' });
    }

    const resultado = await withTransaction(async (tx) => {
      const fila = await tx(
        `INSERT INTO meeting_asistencia (meeting_id, propietario_id, modo, representante_nombre, representacion_escrita)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (meeting_id, propietario_id)
         DO UPDATE SET modo = EXCLUDED.modo, representante_nombre = EXCLUDED.representante_nombre,
                       representacion_escrita = EXCLUDED.representacion_escrita, registrado_en = now()
         RETURNING propietario_id, modo, representante_nombre, representacion_escrita`,
        [meetingId, propietarioId, modo, modo === 'representado' ? representante : null, modo === 'representado' && escrita]
      );
      // Los votos ya registrados en sala pasan a constar con el modo nuevo.
      await tx(
        `UPDATE meeting_votos v SET origen = $3
         FROM meeting_puntos p
         WHERE v.punto_id = p.id AND p.meeting_id = $1::uuid AND v.propietario_id = $2::uuid AND v.origen <> 'app'`,
        [meetingId, propietarioId, modo === 'representado' ? 'representacion' : 'sala']
      );
      return fila.rows[0];
    });

    res.status(200).json({ success: true, asistencia: resultado });
  } catch (err) {
    console.error('Error al registrar asistencia:', err.message);
    res.status(500).json({ error: `Fallo al registrar la asistencia: ${err.message}` });
  }
});

// Quitar a alguien de la sala retira también sus votos de sala en los
// puntos que siguen abiertos (en los ya cerrados su voto ya se emitió).
router.delete('/meetings/:meetingId/asistencia/:propietarioId', requireAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();
  const propietarioId = String(req.params.propietarioId).trim();

  try {
    const junta = await juntaEnCurso(meetingId, req.tenantId);
    if (!junta.ok) return res.status(junta.status).json({ error: junta.error });

    await withTransaction(async (tx) => {
      await tx('DELETE FROM meeting_asistencia WHERE meeting_id = $1::uuid AND propietario_id = $2::uuid', [meetingId, propietarioId]);
      await tx(
        `DELETE FROM meeting_votos v USING meeting_puntos p
         WHERE v.punto_id = p.id AND p.meeting_id = $1::uuid AND p.estado = 'votando'
           AND v.propietario_id = $2::uuid AND v.origen <> 'app'`,
        [meetingId, propietarioId]
      );
    });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error al quitar asistencia:', err.message);
    res.status(500).json({ error: `Fallo al quitar la asistencia: ${err.message}` });
  }
});

// Votos de sala de un punto abierto, en bloque (mano alzada). `voto: null`
// retira el voto de sala de ese propietario. Quien vota en sala sin estar
// registrado como asistente queda anotado como presencial.
router.put('/meetings/:meetingId/puntos/:puntoId/votos-sala', requireAuth, async (req, res) => {
  const meetingId = String(req.params.meetingId).trim();
  const puntoId = String(req.params.puntoId).trim();
  const votos = Array.isArray(req.body?.votos) ? req.body.votos : [];

  if (votos.length === 0) return res.status(400).json({ error: 'No se ha indicado ningún voto.' });
  if (votos.some((v) => v.voto !== null && !VOTOS_VALIDOS.includes(v.voto))) {
    return res.status(400).json({ error: 'Cada voto debe ser "si", "no", "abstencion" o null para retirarlo.' });
  }

  try {
    const junta = await juntaEnCurso(meetingId, req.tenantId);
    if (!junta.ok) return res.status(junta.status).json({ error: junta.error });

    const punto = await query('SELECT tipo, estado FROM meeting_puntos WHERE id = $1::uuid AND meeting_id = $2::uuid', [puntoId, meetingId]);
    if (punto.rows.length === 0) return res.status(404).json({ error: 'Punto no encontrado en esta junta.' });
    if (punto.rows[0].tipo !== 'votacion') return res.status(400).json({ error: 'Este punto es informativo y no admite votación.' });
    if (punto.rows[0].estado !== 'votando') return res.status(409).json({ error: 'La votación de este punto no está abierta.' });

    const ids = [...new Set(votos.map((v) => String(v.propietario_id || '').trim()).filter(Boolean))];
    const [censo, privados, asistencia] = await Promise.all([
      query('SELECT id, coeficiente FROM propietarios WHERE entity_id = $1::uuid AND id = ANY($2::uuid[])', [junta.entityId, ids]),
      query('SELECT propietario_id, habilitado FROM meeting_privados_voto WHERE meeting_id = $1::uuid AND propietario_id = ANY($2::uuid[])', [meetingId, ids]),
      query('SELECT propietario_id, modo FROM meeting_asistencia WHERE meeting_id = $1::uuid AND propietario_id = ANY($2::uuid[])', [meetingId, ids])
    ]);
    const coeficientes = new Map(censo.rows.map((p) => [p.id, p.coeficiente]));
    const sinVoto = new Set(privados.rows.filter((p) => !p.habilitado).map((p) => p.propietario_id));
    const modos = new Map(asistencia.rows.map((a) => [a.propietario_id, a.modo]));

    const rechazados = [];
    let aplicados = 0;
    await withTransaction(async (tx) => {
      for (const { propietario_id: id, voto } of votos) {
        const propietarioId = String(id || '').trim();
        if (!coeficientes.has(propietarioId)) {
          rechazados.push({ propietario_id: propietarioId, motivo: 'No pertenece a esta comunidad.' });
          continue;
        }
        if (voto === null) {
          await tx(`DELETE FROM meeting_votos WHERE punto_id = $1::uuid AND propietario_id = $2::uuid AND origen <> 'app'`, [puntoId, propietarioId]);
          aplicados++;
          continue;
        }
        // Art. 15.2 LPH: tampoco en sala, salvo que se le haya habilitado.
        if (sinVoto.has(propietarioId)) {
          rechazados.push({ propietario_id: propietarioId, motivo: 'Privado de voto por deudas (art. 15.2 LPH).' });
          continue;
        }
        if (!modos.has(propietarioId)) {
          await tx(
            `INSERT INTO meeting_asistencia (meeting_id, propietario_id, modo) VALUES ($1, $2, 'presencial')
             ON CONFLICT (meeting_id, propietario_id) DO NOTHING`,
            [meetingId, propietarioId]
          );
          modos.set(propietarioId, 'presencial');
        }
        await tx(
          `INSERT INTO meeting_votos (punto_id, propietario_id, voto, coeficiente_snapshot, origen)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (punto_id, propietario_id)
           DO UPDATE SET voto = EXCLUDED.voto, coeficiente_snapshot = EXCLUDED.coeficiente_snapshot,
                         origen = EXCLUDED.origen, votado_en = now()`,
          [puntoId, propietarioId, voto, coeficientes.get(propietarioId), modos.get(propietarioId) === 'representado' ? 'representacion' : 'sala']
        );
        aplicados++;
      }
    });

    res.status(200).json({ success: true, aplicados, rechazados });
  } catch (err) {
    console.error('Error al registrar votos de sala:', err.message);
    res.status(500).json({ error: `Fallo al registrar los votos: ${err.message}` });
  }
});

export default router;
