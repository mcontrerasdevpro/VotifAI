import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Cubre las guardas del ciclo de vida programada -> en_curso -> cerrada (o
// cancelada) y pendiente -> votando -> cerrado que sostienen toda la
// "junta en vivo": que no se pueda abrir votación fuera de una junta en
// curso, que no se pueda votar un punto que no esté abierto, que un punto
// informativo no admita voto, y que el aislamiento por tenant/entidad se
// respete en ambos lados (despacho y vecino).

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const TENANT_ID = 'tenant-propio';
const ENTITY_ID = 'entity-propia';
const MEETING_ID = 'meeting-1';
const PUNTO_ID = 'punto-1';

// Estado mutable de la "base de datos" en memoria para este archivo de test.
let meetingEstado = 'en_curso';
let puntoEstado = 'pendiente';
let puntoTipo = 'votacion';
// null = el vecino no figura como privado de voto; true/false = figura y está (o no) habilitado.
let privadoHabilitado = null;

const calls = [];
mock.module('../db.js', {
  namedExports: {
    // Misma forma que el helper real: fn recibe una query equivalente.
    withTransaction: async (fn) => fn((await import('../db.js')).query),
    query: async (text, params) => {
      calls.push({ text, params });

      // --- Lado despacho: puntoBelongsToTenant ---
      if (text.includes('FROM meeting_puntos p') && text.includes('JOIN entities e') && text.includes('e.tenant_id')) {
        const pertenece = params[0] === PUNTO_ID && params[1] === TENANT_ID;
        return { rows: pertenece ? [{ id: PUNTO_ID }] : [] };
      }
      // --- Lado vecino: puntoBelongsToEntity ---
      if (text.includes('FROM meeting_puntos p') && text.includes('m.entity_id = $2')) {
        const pertenece = params[0] === PUNTO_ID && params[1] === ENTITY_ID;
        return { rows: pertenece ? [{ id: PUNTO_ID }] : [] };
      }
      if (text.includes('SELECT estado FROM meetings WHERE id')) {
        return { rows: [{ estado: meetingEstado }] };
      }
      if (text.startsWith("UPDATE meeting_puntos SET estado = 'votando'")) {
        if (puntoEstado !== 'pendiente') return { rows: [], rowCount: 0 };
        puntoEstado = 'votando';
        return { rows: [{ id: PUNTO_ID, estado: 'votando', abierto_en: new Date().toISOString() }], rowCount: 1 };
      }
      if (text.includes('SELECT estado, tipo, meeting_id FROM meeting_puntos WHERE id')) {
        return { rows: [{ estado: puntoEstado, tipo: puntoTipo, meeting_id: MEETING_ID }] };
      }
      if (text.includes('FROM meeting_privados_voto WHERE meeting_id')) {
        return { rows: privadoHabilitado === null ? [] : [{ habilitado: privadoHabilitado }] };
      }
      if (text.includes('SELECT coeficiente FROM propietarios WHERE id')) {
        return { rows: [{ coeficiente: '25.00' }] };
      }
      if (text.includes('INSERT INTO meeting_votos')) {
        return { rows: [], rowCount: 1 };
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

function despachoCookie() {
  const token = jwt.sign({ tenantId: TENANT_ID, tipoOrganizacion: 'administrador' }, process.env.JWT_SECRET);
  return `votifai_session=${token}`;
}
function vecinoCookie() {
  const token = jwt.sign({ propietarioId: 'propietario-1', entityId: ENTITY_ID }, process.env.JWT_SECRET);
  return `votifai_voter_session=${token}`;
}

test('abrir-votacion: 409 si la junta no está en curso', async () => {
  meetingEstado = 'programada';
  puntoEstado = 'pendiente';
  const respuesta = await fetch(`${baseUrl}/api/meetings/${MEETING_ID}/puntos/${PUNTO_ID}/abrir-votacion`, {
    method: 'POST',
    headers: { Cookie: despachoCookie() }
  });
  assert.equal(respuesta.status, 409);
  assert.equal(puntoEstado, 'pendiente');
});

test('abrir-votacion: 200 si la junta está en curso y el punto está pendiente', async () => {
  meetingEstado = 'en_curso';
  puntoEstado = 'pendiente';
  const respuesta = await fetch(`${baseUrl}/api/meetings/${MEETING_ID}/puntos/${PUNTO_ID}/abrir-votacion`, {
    method: 'POST',
    headers: { Cookie: despachoCookie() }
  });
  assert.equal(respuesta.status, 200);
  assert.equal(puntoEstado, 'votando');
});

test('abrir-votacion: 403 si el punto pertenece a otro tenant', async () => {
  const token = jwt.sign({ tenantId: 'tenant-ajeno', tipoOrganizacion: 'administrador' }, process.env.JWT_SECRET);
  const respuesta = await fetch(`${baseUrl}/api/meetings/${MEETING_ID}/puntos/${PUNTO_ID}/abrir-votacion`, {
    method: 'POST',
    headers: { Cookie: `votifai_session=${token}` }
  });
  assert.equal(respuesta.status, 403);
});

test('votar: 403 si el punto pertenece a otra finca que la sesión del vecino', async () => {
  const token = jwt.sign({ propietarioId: 'propietario-1', entityId: 'otra-finca' }, process.env.JWT_SECRET);
  const respuesta = await fetch(`${baseUrl}/api/meetings/vecino/puntos/${PUNTO_ID}/votar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `votifai_voter_session=${token}` },
    body: JSON.stringify({ voto: 'si' })
  });
  assert.equal(respuesta.status, 403);
});

test('votar: 409 si el punto no está abierto a votación', async () => {
  puntoEstado = 'pendiente';
  puntoTipo = 'votacion';
  const respuesta = await fetch(`${baseUrl}/api/meetings/vecino/puntos/${PUNTO_ID}/votar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: vecinoCookie() },
    body: JSON.stringify({ voto: 'si' })
  });
  assert.equal(respuesta.status, 409);
});

test('votar: 400 si el punto es informativo', async () => {
  puntoEstado = 'votando';
  puntoTipo = 'informativo';
  const respuesta = await fetch(`${baseUrl}/api/meetings/vecino/puntos/${PUNTO_ID}/votar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: vecinoCookie() },
    body: JSON.stringify({ voto: 'si' })
  });
  assert.equal(respuesta.status, 400);
});

test('votar: 400 si el voto no es si/no/abstencion', async () => {
  puntoEstado = 'votando';
  puntoTipo = 'votacion';
  const respuesta = await fetch(`${baseUrl}/api/meetings/vecino/puntos/${PUNTO_ID}/votar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: vecinoCookie() },
    body: JSON.stringify({ voto: 'quizas' })
  });
  assert.equal(respuesta.status, 400);
});

test('votar: 200 en el camino feliz (punto votando, tipo votación, voto válido)', async () => {
  puntoEstado = 'votando';
  puntoTipo = 'votacion';
  calls.length = 0;
  const respuesta = await fetch(`${baseUrl}/api/meetings/vecino/puntos/${PUNTO_ID}/votar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: vecinoCookie() },
    body: JSON.stringify({ voto: 'si' })
  });
  assert.equal(respuesta.status, 200);
  assert.equal(calls.some((c) => c.text.includes('INSERT INTO meeting_votos')), true);
});

test('votar: 403 si el vecino está privado de voto por deudas (art. 15.2 LPH)', async () => {
  puntoEstado = 'votando';
  puntoTipo = 'votacion';
  privadoHabilitado = false;
  calls.length = 0;
  const respuesta = await fetch(`${baseUrl}/api/meetings/vecino/puntos/${PUNTO_ID}/votar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: vecinoCookie() },
    body: JSON.stringify({ voto: 'si' })
  });
  assert.equal(respuesta.status, 403);
  assert.equal((await respuesta.json()).codigo, 'PRIVADO_DE_VOTO');
  assert.equal(calls.some((c) => c.text.includes('INSERT INTO meeting_votos')), false);
});

test('votar: 200 si el privado de voto ha sido habilitado por el despacho', async () => {
  puntoEstado = 'votando';
  privadoHabilitado = true;
  const respuesta = await fetch(`${baseUrl}/api/meetings/vecino/puntos/${PUNTO_ID}/votar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: vecinoCookie() },
    body: JSON.stringify({ voto: 'no' })
  });
  assert.equal(respuesta.status, 200);
  privadoHabilitado = null;
});

test('iniciar: 400 si no se indica primera o segunda convocatoria (art. 17.7 LPH)', async () => {
  const respuesta = await fetch(`${baseUrl}/api/meetings/${MEETING_ID}/iniciar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: despachoCookie() },
    body: JSON.stringify({})
  });
  assert.equal(respuesta.status, 400);
});
