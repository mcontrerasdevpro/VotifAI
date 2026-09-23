import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Delegación de voto entre vecinos: solo existe cuando el representante la
// acepta desde su propia cuenta, solo entre propietarios de la misma finca
// con cuenta, y sin cadenas. Aceptar la anota como representación en la
// junta; revocar la quita.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const ENTITY = 'entity-1';
const MEETING = '00000000-0000-0000-0000-0000000000aa';
const ANA = '00000000-0000-0000-0000-000000000001'; // quiere delegar
const LUIS = '00000000-0000-0000-0000-000000000002'; // representante con cuenta
const SIN_CUENTA = '00000000-0000-0000-0000-000000000003';
const DELEGACION = '00000000-0000-0000-0000-0000000000dd';

let propietarios;
let vivas; // delegaciones pendientes/aceptadas: { representado_id, representante_id }
let delegacion; // la fila que devuelve SELECT d.* ... WHERE d.id
const escrituras = [];
const avisos = [];

const fakeQuery = async (text, params) => {
  if (text.startsWith('SELECT id, titulo, estado, entity_id FROM meetings')) return { rows: [{ id: MEETING, titulo: 'Junta ordinaria', estado: 'programada', entity_id: ENTITY }] };
  if (text.startsWith('SELECT id, entity_id, nombre_completo')) return { rows: propietarios[params[0]] ? [propietarios[params[0]]] : [] };
  if (text.startsWith('SELECT representado_id, representante_id FROM meeting_delegaciones')) {
    return { rows: vivas.filter((d) => d.representado_id === params[1] || d.representante_id === params[1]) };
  }
  if (text.startsWith('INSERT INTO meeting_delegaciones')) {
    escrituras.push({ tipo: 'solicitud', representado: params[1], representante: params[2] });
    return { rows: [{ id: DELEGACION, estado: 'pendiente' }] };
  }
  if (text.startsWith('SELECT d.*, m.titulo')) return { rows: delegacion ? [delegacion] : [] };
  if (text.startsWith("UPDATE meeting_delegaciones SET estado = 'aceptada'")) { escrituras.push({ tipo: 'aceptada' }); return { rows: [], rowCount: 1 }; }
  if (text.startsWith("UPDATE meeting_delegaciones SET estado = 'rechazada'")) { escrituras.push({ tipo: 'rechazada' }); return { rows: [], rowCount: 1 }; }
  if (text.startsWith("UPDATE meeting_delegaciones SET estado = 'revocada'")) { escrituras.push({ tipo: 'revocada' }); return { rows: [], rowCount: 1 }; }
  if (text.startsWith('INSERT INTO meeting_asistencia')) { escrituras.push({ tipo: 'asistencia', propietario: params[1], representante: params[2] }); return { rows: [], rowCount: 1 }; }
  if (text.startsWith('DELETE FROM meeting_asistencia WHERE delegacion_id')) { escrituras.push({ tipo: 'quitar_asistencia' }); return { rows: [], rowCount: 1 }; }
  throw new Error(`Query no esperada en el test: ${text}`);
};

mock.module('../db.js', { namedExports: { query: fakeQuery, withTransaction: async (fn) => fn(fakeQuery) } });
mock.module('../lib/notificaciones.js', { namedExports: { notificar: async (payload) => { avisos.push(payload); return { enviado: true, real: false }; } } });

const { default: router } = await import('../routes/delegaciones.js');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', router);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;
const como = (propietarioId) => `votifai_voter_session=${jwt.sign({ propietarioId, entityId: ENTITY }, process.env.JWT_SECRET)}`;
const post = (path, quien, body = {}) => fetch(`${base}/api${path}`, { method: 'POST', headers: { Cookie: como(quien), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  propietarios = {
    [ANA]: { id: ANA, entity_id: ENTITY, nombre_completo: 'Ana', propiedad_detalle: '1ºA', email: 'ana@x.es', tiene_cuenta: true },
    [LUIS]: { id: LUIS, entity_id: ENTITY, nombre_completo: 'Luis', propiedad_detalle: '2ºB', email: 'luis@x.es', tiene_cuenta: true },
    [SIN_CUENTA]: { id: SIN_CUENTA, entity_id: ENTITY, nombre_completo: 'Pepe', propiedad_detalle: '3ºC', tiene_cuenta: false }
  };
  vivas = [];
  delegacion = { id: DELEGACION, meeting_id: MEETING, representado_id: ANA, representante_id: LUIS, estado: 'pendiente', titulo: 'Junta ordinaria', estado_junta: 'programada', entity_id: ENTITY };
  escrituras.length = 0;
  avisos.length = 0;
});

test('solicitar crea una delegación PENDIENTE y avisa al representante', async () => {
  const r = await post('/meetings/vecino/delegaciones', ANA, { meeting_id: MEETING, representante_id: LUIS });
  assert.equal(r.status, 201);
  assert.deepEqual(escrituras, [{ tipo: 'solicitud', representado: ANA, representante: LUIS }]);
  assert.equal(avisos[0].destinatarios[0].email, 'luis@x.es');
  assert.equal(escrituras.some((e) => e.tipo === 'asistencia'), false); // no representa hasta que acepte
});

test('no se puede nombrar a alguien sin cuenta, ni delegar si ya representas a otro, ni en quien ha delegado', async () => {
  assert.equal((await post('/meetings/vecino/delegaciones', ANA, { meeting_id: MEETING, representante_id: SIN_CUENTA })).status, 409);
  vivas = [{ representado_id: SIN_CUENTA, representante_id: ANA }];
  assert.equal((await post('/meetings/vecino/delegaciones', ANA, { meeting_id: MEETING, representante_id: LUIS })).status, 409);
  vivas = [{ representado_id: LUIS, representante_id: SIN_CUENTA }];
  assert.equal((await post('/meetings/vecino/delegaciones', ANA, { meeting_id: MEETING, representante_id: LUIS })).status, 409);
  assert.equal(escrituras.length, 0);
});

test('solo el representante puede aceptar; al aceptar queda como representación en la junta', async () => {
  assert.equal((await post(`/meetings/vecino/delegaciones/${DELEGACION}/aceptar`, ANA)).status, 404);
  const r = await post(`/meetings/vecino/delegaciones/${DELEGACION}/aceptar`, LUIS);
  assert.equal(r.status, 200);
  assert.deepEqual(escrituras.map((e) => e.tipo), ['aceptada', 'asistencia']);
  assert.equal(escrituras[1].propietario, ANA);
  assert.match(escrituras[1].representante, /Luis/);
  assert.equal(avisos[0].destinatarios[0].email, 'ana@x.es');
});

test('rechazar no crea representación', async () => {
  const r = await post(`/meetings/vecino/delegaciones/${DELEGACION}/rechazar`, LUIS);
  assert.equal(r.status, 200);
  assert.deepEqual(escrituras.map((e) => e.tipo), ['rechazada']);
});

test('solo el representado puede revocar, y revocar quita la representación', async () => {
  delegacion.estado = 'aceptada';
  assert.equal((await post(`/meetings/vecino/delegaciones/${DELEGACION}/revocar`, LUIS)).status, 404);
  const r = await post(`/meetings/vecino/delegaciones/${DELEGACION}/revocar`, ANA);
  assert.equal(r.status, 200);
  assert.deepEqual(escrituras.map((e) => e.tipo), ['revocada', 'quitar_asistencia']);
});
