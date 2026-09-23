import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Emisión masiva: reparte el importe por coeficiente (cuadrando al céntimo),
// excluye a quien se indique, genera un bloque de cuotas por periodo y no
// guarda nada en la vista previa.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const TENANT = 'tenant-1';
const ENTITY = '00000000-0000-0000-0000-0000000000e1';
const censo = [
  { id: '00000000-0000-0000-0000-000000000001', nombre_completo: 'Ana', propiedad_detalle: '1ºA', coeficiente: '50.0000' },
  { id: '00000000-0000-0000-0000-000000000002', nombre_completo: 'Luis', propiedad_detalle: '1ºB', coeficiente: '30.0000' },
  { id: '00000000-0000-0000-0000-000000000003', nombre_completo: 'Local', propiedad_detalle: 'Bajo', coeficiente: '20.0000' }
];
const inserts = [];

const fakeQuery = async (text, params) => {
  if (text.includes('FROM entities WHERE id = $1::uuid AND tenant_id = $2')) return { rows: params[1] === TENANT ? [{ id: ENTITY }] : [] };
  if (text.startsWith('SELECT id, nombre_completo, propiedad_detalle, coeficiente FROM propietarios')) return { rows: censo };
  if (text.startsWith('INSERT INTO cuotas_emisiones')) { inserts.push({ tabla: 'emision', params }); return { rows: [{ id: 'emision-1' }] }; }
  if (text.startsWith('INSERT INTO cuotas')) { inserts.push({ tabla: 'cuotas', params }); return { rows: [], rowCount: params[6].length }; }
  throw new Error(`Query no esperada en el test: ${text}`);
};

mock.module('../db.js', { namedExports: { query: fakeQuery, withTransaction: async (fn) => fn(fakeQuery) } });

const { default: router } = await import('../routes/cuotas.js');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', router);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;
const cookie = `votifai_session=${jwt.sign({ tenantId: TENANT }, process.env.JWT_SECRET)}`;
const post = (path, body) => fetch(`${base}/api${path}`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const emision = { entity_id: ENTITY, concepto: 'Cuota ordinaria', importe_por_periodo: 1000, primer_vencimiento: '2027-01-10' };

beforeEach(() => { inserts.length = 0; });

test('la vista previa reparte por coeficiente y no guarda nada', async () => {
  const r = await post('/cuotas/emision/previsualizar', emision);
  const data = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(data.repartos.map((x) => x.importe), [500, 300, 200]);
  assert.equal(data.cuotasAEmitir, 3);
  assert.equal(inserts.length, 0);
});

test('emitir 12 mensualidades crea una emisión y un bloque de cuotas por mes', async () => {
  const r = await post('/cuotas/emision', { ...emision, frecuencia: 'mensual', numero_periodos: 12 });
  const data = await r.json();
  assert.equal(r.status, 201);
  assert.equal(data.cuotasEmitidas, 36);
  const bloques = inserts.filter((i) => i.tabla === 'cuotas');
  assert.equal(bloques.length, 12);
  assert.equal(bloques[0].params[2], 'Enero 2027');
  assert.equal(bloques[11].params[2], 'Diciembre 2027');
  assert.deepEqual(bloques[0].params[7], [500, 300, 200]);
});

test('los excluidos no reciben cuota y el importe se reparte entre el resto', async () => {
  const r = await post('/cuotas/emision/previsualizar', { ...emision, excluidos: [censo[2].id] });
  const data = await r.json();
  assert.deepEqual(data.repartos.map((x) => [x.nombre_completo, x.importe]), [['Ana', 625], ['Luis', 375]]);
  assert.equal(data.avisos.some((a) => /excluido/.test(a)), true);
});

test('sin importe o sin vencimiento no emite', async () => {
  assert.equal((await post('/cuotas/emision', { ...emision, importe_por_periodo: 0 })).status, 400);
  assert.equal((await post('/cuotas/emision', { ...emision, primer_vencimiento: '' })).status, 400);
  assert.equal(inserts.length, 0);
});
