import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Cubre las rutas de historial/detalle/PDF del acta para el vecino,
// añadidas para que un propietario pueda recuperar el acta desde la app
// aunque le falle la notificación por email/WhatsApp. Como son rutas
// nuevas de lectura sobre datos de otra finca, el aislamiento por
// entidad es lo primero que puede romperse sin que se note.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const ENTITY_ID = 'entity-propia';
const MEETING_ID = 'meeting-cerrada-1';

const calls = [];
mock.module('../db.js', {
  namedExports: {
    query: async (text, params) => {
      calls.push({ text, params });

      if (text.includes('FROM meetings WHERE entity_id = $1::uuid AND estado')) {
        return { rows: [{ id: MEETING_ID, titulo: 'Junta cerrada de prueba', tipo: 'ordinaria', cerrada_en: '2026-09-23T10:00:00.000Z', tiene_pdf: true }] };
      }
      if (text.includes('FROM meetings m JOIN entities e ON m.entity_id = e.id') && text.includes('m.acta_texto_final')) {
        const pertenece = params[0] === MEETING_ID && params[1] === ENTITY_ID;
        return { rows: pertenece ? [{ id: MEETING_ID, titulo: 'Junta cerrada de prueba', tipo: 'ordinaria', cerrada_en: '2026-09-23T10:00:00.000Z', acta_texto_final: 'Texto del acta.', tiene_pdf: true, finca_nombre: 'Finca Propia' }] : [] };
      }
      if (text.includes('SELECT titulo, acta_pdf_base64 FROM meetings')) {
        const pertenece = params[0] === MEETING_ID && params[1] === ENTITY_ID;
        // PDF mínimo válido, suficiente para comprobar que se sirve tal cual.
        return { rows: pertenece ? [{ titulo: 'Junta cerrada de prueba', acta_pdf_base64: Buffer.from('%PDF-1.3 fake').toString('base64') }] : [] };
      }
      throw new Error(`Query no esperada en el test: ${text}`);
    }
  }
});

const { default: meetingsRouter } = await import('../routes/meetings.js');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', meetingsRouter);

const server = app.listen(0);
const baseUrl = await new Promise((resolve) => server.on('listening', () => resolve(`http://127.0.0.1:${server.address().port}`)));
after(() => server.close());

function vecinoCookie(entityId) {
  const token = jwt.sign({ propietarioId: 'propietario-1', entityId }, process.env.JWT_SECRET);
  return `votifai_voter_session=${token}`;
}

test('historial: 403 si el entityId de la URL no es el de la sesión del vecino', async () => {
  const respuesta = await fetch(`${baseUrl}/api/meetings/vecino/${ENTITY_ID}/historial`, {
    headers: { Cookie: vecinoCookie('otra-entidad') }
  });
  assert.equal(respuesta.status, 403);
});

test('historial: 200 con la lista de juntas cerradas de la propia finca', async () => {
  const respuesta = await fetch(`${baseUrl}/api/meetings/vecino/${ENTITY_ID}/historial`, {
    headers: { Cookie: vecinoCookie(ENTITY_ID) }
  });
  const cuerpo = await respuesta.json();
  assert.equal(respuesta.status, 200);
  assert.equal(cuerpo.meetings.length, 1);
  assert.equal(cuerpo.meetings[0].id, MEETING_ID);
});

test('detalle: 404 si la junta pertenece a otra finca (no expone acta_texto_final ajeno)', async () => {
  const respuesta = await fetch(`${baseUrl}/api/meetings/vecino/detalle/${MEETING_ID}`, {
    headers: { Cookie: vecinoCookie('otra-entidad') }
  });
  assert.equal(respuesta.status, 404);
});

test('detalle: 200 con el acta_texto_final cuando la junta es de la propia finca', async () => {
  const respuesta = await fetch(`${baseUrl}/api/meetings/vecino/detalle/${MEETING_ID}`, {
    headers: { Cookie: vecinoCookie(ENTITY_ID) }
  });
  const cuerpo = await respuesta.json();
  assert.equal(respuesta.status, 200);
  assert.equal(cuerpo.meeting.acta_texto_final, 'Texto del acta.');
});

test('acta-pdf: 404 si la junta no pertenece a la finca del vecino', async () => {
  const respuesta = await fetch(`${baseUrl}/api/meetings/vecino/${MEETING_ID}/acta-pdf`, {
    headers: { Cookie: vecinoCookie('otra-entidad') }
  });
  assert.equal(respuesta.status, 404);
});

test('acta-pdf: 200 con el PDF cuando la junta es de la propia finca', async () => {
  const respuesta = await fetch(`${baseUrl}/api/meetings/vecino/${MEETING_ID}/acta-pdf`, {
    headers: { Cookie: vecinoCookie(ENTITY_ID) }
  });
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get('content-type'), 'application/pdf');
});
