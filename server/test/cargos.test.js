import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Junta de gobierno: cargos elegidos entre los propietarios de la propia
// comunidad, un único presidente/secretario/tesorero vigente (nombrar uno
// nuevo cesa al anterior), vicepresidentes y vocales los que hagan falta,
// mandato de un año por defecto y aislamiento entre despachos.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const TENANT_ID = 'tenant-1';
const ENTITY_ID = '11111111-1111-1111-1111-111111111111';
const PROPIETARIOS = { 'p-ana': { id: 'p-ana', nombre_completo: 'Ana Ruiz', propiedad_detalle: '1ºA' }, 'p-luis': { id: 'p-luis', nombre_completo: 'Luis Gil', propiedad_detalle: '1ºB' } };
let vigentes;
const txLog = [];

const responder = async (text, params) => {
  if (text.startsWith('SELECT id FROM entities WHERE id = $1::uuid AND tenant_id = $2')) return { rows: params[0] === ENTITY_ID && params[1] === TENANT_ID ? [{ id: ENTITY_ID }] : [] };
  if (text.startsWith('SELECT id, nombre_completo, propiedad_detalle FROM propietarios')) return { rows: params[1] === ENTITY_ID && PROPIETARIOS[params[0]] ? [PROPIETARIOS[params[0]]] : [] };
  if (text.startsWith('UPDATE cargos_comunidad SET cesado_en = $3::date')) {
    assert.equal(params.length, 3);
    txLog.push({ cesa: params[1], fecha: params[2] });
    return { rows: [] };
  }
  if (text.startsWith('SELECT 1 FROM cargos_comunidad')) return { rows: vigentes.some((v) => v.cargo === params[1] && v.propietario_id === params[2]) ? [{}] : [] };
  if (text.startsWith('INSERT INTO cargos_comunidad')) {
    assert.equal(params.length, 7);
    txLog.push({ inserta: params });
    return { rows: [{ id: 'nuevo', propietario_id: params[1], cargo: params[2], nombre: params[3], desde: params[5], hasta: params[6] || 'desde+1año', cesado_en: null }] };
  }
  if (text.includes('FROM cargos_comunidad c JOIN entities e')) return { rows: params[1] === TENANT_ID && params[0] === '22222222-2222-2222-2222-222222222222' ? [{ id: params[0], entity_id: ENTITY_ID }] : [] };
  if (text.startsWith('UPDATE cargos_comunidad SET cesado_en = $2::date')) { txLog.push({ cesaId: params[0], motivo: params[2] }); return { rows: [] }; }
  if (text.startsWith('SELECT id, propietario_id, cargo')) {
    return { rows: [
      { cargo: 'vocal', nombre: 'Luis Gil', desde: '2026-01-01', cesado_en: null },
      { cargo: 'presidente', nombre: 'Ana Ruiz', desde: '2026-01-01', cesado_en: null },
      { cargo: 'presidente', nombre: 'Antiguo', desde: '2025-01-01', cesado_en: '2026-01-01' }
    ] };
  }
  throw new Error(`Query no esperada en el test: ${text}`);
};

mock.module('../db.js', { namedExports: { query: responder, withTransaction: async (fn) => fn(responder) } });

const { default: cargosRouter } = await import('../routes/cargos.js');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', cargosRouter);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;
const cookie = `votifai_session=${jwt.sign({ tenantId: TENANT_ID }, process.env.JWT_SECRET)}`;
const llamar = (metodo, ruta, body) => fetch(`${base}/api${ruta}`, { method: metodo, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json() }));

beforeEach(() => { vigentes = []; txLog.length = 0; });

test('lista los cargos vigentes por orden (presidente primero) y el historial aparte', async () => {
  const r = await llamar('GET', `/entities/${ENTITY_ID}/cargos`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.vigentes.map((c) => c.cargo), ['presidente', 'vocal']);
  assert.deepEqual(r.body.historial.map((c) => c.nombre), ['Antiguo']);
  assert.ok(r.body.cargos.find((c) => c.id === 'vicepresidente'));
});

test('nombrar presidente cesa al anterior en la misma fecha', async () => {
  const r = await llamar('POST', `/entities/${ENTITY_ID}/cargos`, { propietario_id: 'p-ana', cargo: 'presidente', desde: '2026-10-01' });
  assert.equal(r.status, 201);
  assert.deepEqual(txLog[0], { cesa: 'presidente', fecha: '2026-10-01' });
  const [, propietario, cargo, nombre, propiedad, desde, hasta] = txLog[1].inserta;
  assert.deepEqual([propietario, cargo, nombre, propiedad, desde, hasta], ['p-ana', 'presidente', 'Ana Ruiz', '1ºA', '2026-10-01', null]);
});

test('vocales y vicepresidentes: varios a la vez, sin cesar a nadie, pero no la misma persona dos veces', async () => {
  const r = await llamar('POST', `/entities/${ENTITY_ID}/cargos`, { propietario_id: 'p-luis', cargo: 'vocal' });
  assert.equal(r.status, 201);
  assert.equal(txLog.some((l) => l.cesa), false);
  vigentes = [{ cargo: 'vocal', propietario_id: 'p-luis' }];
  const dup = await llamar('POST', `/entities/${ENTITY_ID}/cargos`, { propietario_id: 'p-luis', cargo: 'vocal' });
  assert.equal(dup.status, 409);
  assert.match(dup.body.error, /Luis Gil ya es vocal/);
});

test('validaciones: cargo, propietario de la comunidad y fechas', async () => {
  assert.equal((await llamar('POST', `/entities/${ENTITY_ID}/cargos`, { propietario_id: 'p-ana', cargo: 'rey' })).status, 400);
  assert.equal((await llamar('POST', `/entities/${ENTITY_ID}/cargos`, { propietario_id: 'p-otra-finca', cargo: 'presidente' })).status, 400);
  assert.equal((await llamar('POST', `/entities/${ENTITY_ID}/cargos`, { propietario_id: 'p-ana', cargo: 'presidente', desde: '2026-10-01', hasta: '2026-09-01' })).status, 400);
  assert.equal(txLog.length, 0);
});

test('aislamiento: ni ver ni nombrar ni cesar en comunidades de otro despacho', async () => {
  const otra = '33333333-3333-3333-3333-333333333333';
  assert.equal((await llamar('GET', `/entities/${otra}/cargos`)).status, 403);
  assert.equal((await llamar('POST', `/entities/${otra}/cargos`, { propietario_id: 'p-ana', cargo: 'presidente' })).status, 403);
  assert.equal((await llamar('POST', '/cargos/44444444-4444-4444-4444-444444444444/cesar', {})).status, 404);
});

test('cesar un cargo con motivo', async () => {
  const r = await llamar('POST', '/cargos/22222222-2222-2222-2222-222222222222/cesar', { motivo: 'Dimisión' });
  assert.equal(r.status, 200);
  assert.equal(txLog[0].motivo, 'Dimisión');
});
