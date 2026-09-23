import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Votos registrados por el despacho en la sala: se suman en la misma tabla
// que los de la app (un voto por propietario y punto), un privado de voto
// (art. 15.2) tampoco vota en sala, quien vota sin estar en la lista de
// asistencia queda anotado como presencial, y un representado vota con
// origen 'representacion'.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const TENANT_ID = 'tenant-propio';
const MEETING_ID = '00000000-0000-0000-0000-00000000000a';
const PUNTO_ID = '00000000-0000-0000-0000-00000000000b';
const ENTITY_ID = 'entity-1';
const P1 = '00000000-0000-0000-0000-000000000001';
const P2 = '00000000-0000-0000-0000-000000000002';
const MOROSO = '00000000-0000-0000-0000-000000000003';
const REPRESENTADO = '00000000-0000-0000-0000-000000000004';
const AJENO = '00000000-0000-0000-0000-000000000099';

let estadoJunta;
let estadoPunto;
let asistencia;
const escrituras = [];

const fakeQuery = async (text, params) => {
  if (text.includes('JOIN entities e') && text.includes('e.tenant_id')) return { rows: [{ id: MEETING_ID }] };
  if (text.startsWith('SELECT entity_id, estado FROM meetings')) return { rows: [{ entity_id: ENTITY_ID, estado: estadoJunta }] };
  if (text.startsWith('SELECT tipo, estado FROM meeting_puntos')) return { rows: [{ tipo: 'votacion', estado: estadoPunto }] };
  if (text.startsWith('SELECT id, coeficiente FROM propietarios')) {
    return { rows: params[1].filter((id) => id !== AJENO).map((id) => ({ id, coeficiente: '10.0000' })) };
  }
  if (text.includes('FROM meeting_privados_voto')) return { rows: params[1].includes(MOROSO) ? [{ propietario_id: MOROSO, habilitado: false }] : [] };
  if (text.startsWith('SELECT propietario_id, modo FROM meeting_asistencia')) {
    return { rows: [...asistencia].filter(([id]) => params[1].includes(id)).map(([propietario_id, modo]) => ({ propietario_id, modo })) };
  }
  if (text.startsWith('INSERT INTO meeting_asistencia')) {
    escrituras.push({ tipo: 'asistencia', propietario: params[1] });
    if (!asistencia.has(params[1])) asistencia.set(params[1], 'presencial');
    return { rows: [], rowCount: 1 };
  }
  if (text.startsWith('INSERT INTO meeting_votos')) {
    escrituras.push({ tipo: 'voto', propietario: params[1], voto: params[2], origen: params[4] });
    return { rows: [], rowCount: 1 };
  }
  if (text.startsWith('DELETE FROM meeting_votos')) {
    escrituras.push({ tipo: 'retirar', propietario: params[1] });
    return { rows: [], rowCount: 1 };
  }
  throw new Error(`Query no esperada en el test: ${text}`);
};

mock.module('../db.js', {
  namedExports: { query: fakeQuery, withTransaction: async (fn) => fn(fakeQuery) }
});

const { default: salaRouter } = await import('../routes/sala.js');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', salaRouter);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;
const cookie = `votifai_session=${jwt.sign({ tenantId: TENANT_ID }, process.env.JWT_SECRET)}`;
const votar = (votos) => fetch(`${base}/api/meetings/${MEETING_ID}/puntos/${PUNTO_ID}/votos-sala`, {
  method: 'PUT',
  headers: { Cookie: cookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({ votos })
});

beforeEach(() => {
  estadoJunta = 'en_curso';
  estadoPunto = 'votando';
  asistencia = new Map([[P1, 'presencial'], [REPRESENTADO, 'representado']]);
  escrituras.length = 0;
});

test('suma votos de sala y de representación con su origen', async () => {
  const respuesta = await votar([{ propietario_id: P1, voto: 'si' }, { propietario_id: REPRESENTADO, voto: 'no' }]);
  assert.equal(respuesta.status, 200);
  assert.equal((await respuesta.json()).aplicados, 2);
  const votos = escrituras.filter((e) => e.tipo === 'voto');
  assert.deepEqual(votos.find((v) => v.propietario === P1), { tipo: 'voto', propietario: P1, voto: 'si', origen: 'sala' });
  assert.deepEqual(votos.find((v) => v.propietario === REPRESENTADO), { tipo: 'voto', propietario: REPRESENTADO, voto: 'no', origen: 'representacion' });
});

test('quien vota en sala sin estar en la lista de asistencia queda como presencial', async () => {
  await votar([{ propietario_id: P2, voto: 'abstencion' }]);
  assert.equal(escrituras.some((e) => e.tipo === 'asistencia' && e.propietario === P2), true);
  assert.equal(escrituras.find((e) => e.tipo === 'voto').origen, 'sala');
});

test('un privado de voto y un propietario de otra finca se rechazan sin votar', async () => {
  const respuesta = await votar([{ propietario_id: MOROSO, voto: 'si' }, { propietario_id: AJENO, voto: 'si' }, { propietario_id: P1, voto: 'si' }]);
  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.aplicados, 1);
  assert.equal(cuerpo.rechazados.length, 2);
  assert.match(cuerpo.rechazados.find((r) => r.propietario_id === MOROSO).motivo, /15\.2/);
  assert.equal(escrituras.filter((e) => e.tipo === 'voto').length, 1);
});

test('voto null retira el voto de sala', async () => {
  await votar([{ propietario_id: P1, voto: null }]);
  assert.deepEqual(escrituras, [{ tipo: 'retirar', propietario: P1 }]);
});

test('no se registra nada con el punto cerrado, la junta no en curso o un voto inválido', async () => {
  estadoPunto = 'cerrado';
  assert.equal((await votar([{ propietario_id: P1, voto: 'si' }])).status, 409);
  estadoPunto = 'votando';
  estadoJunta = 'cerrada';
  assert.equal((await votar([{ propietario_id: P1, voto: 'si' }])).status, 409);
  estadoJunta = 'en_curso';
  assert.equal((await votar([{ propietario_id: P1, voto: 'quizas' }])).status, 400);
  assert.equal(escrituras.length, 0);
});
