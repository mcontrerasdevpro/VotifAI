import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Presupuesto por partidas (el total es su suma, sin partidas repetidas),
// su ejecución, el fondo de reserva (no se dispone de más de lo que hay) y
// la liquidación en PDF con reparto por propietario.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const TENANT = 'tenant-1';
const ENTITY = '00000000-0000-0000-0000-0000000000e1';
const PRES = '00000000-0000-0000-0000-0000000000f1';
const LIQ = '00000000-0000-0000-0000-0000000000f2';

let saldoFondo;
const escrituras = [];

const fakeQuery = async (text, params) => {
  if (text.includes('FROM entities WHERE id = $1::uuid AND tenant_id = $2')) return { rows: [{ id: ENTITY }] };
  if (text.includes('JOIN entities e') && text.includes('e.tenant_id')) return { rows: [{ id: params[0] }] };
  if (text.startsWith('INSERT INTO presupuestos')) { escrituras.push({ tabla: 'presupuesto', importe: params[4], tipo: params[3] }); return { rows: [{ id: PRES }] }; }
  if (text.startsWith('INSERT INTO presupuesto_partidas')) { escrituras.push({ tabla: 'partida', nombre: params[1], importe: params[2] }); return { rows: [] }; }
  if (text.startsWith('SELECT id, entity_id, nombre, anio, tipo, importe_previsto FROM presupuestos')) return { rows: [{ id: PRES, entity_id: ENTITY, nombre: 'Ordinario 2027', anio: 2027, tipo: 'ordinario', importe_previsto: '2000' }] };
  if (text.startsWith('SELECT nombre, importe_previsto FROM presupuesto_partidas')) return { rows: [{ nombre: 'Limpieza', importe_previsto: '1200' }, { nombre: 'Luz', importe_previsto: '800' }] };
  if (text.startsWith('SELECT categoria, SUM(importe) AS total FROM movimientos_contables')) return { rows: [{ categoria: 'Limpieza', total: '1300' }, { categoria: 'Jardín', total: '90' }] };
  if (text.includes('FROM fondo_reserva_movimientos WHERE entity_id') && text.includes('AS saldo')) return { rows: [{ saldo: String(saldoFondo) }] };
  if (text.includes("FROM presupuestos") && text.includes("tipo = 'ordinario'")) return { rows: [{ id: PRES, nombre: 'Ordinario 2027', anio: 2027, importe_previsto: '24000' }] };
  if (text.startsWith('SELECT id, tipo, concepto, importe, fecha, notas FROM fondo_reserva_movimientos')) return { rows: [{ id: 'f0', tipo: 'aportacion', concepto: 'Dotación 2026', importe: '1800', fecha: '2026-12-31', notas: null }] };
  if (text.startsWith('INSERT INTO fondo_reserva_movimientos')) { escrituras.push({ tabla: 'fondo', tipo: params[1], importe: params[3] }); return { rows: [{ id: 'f1' }] }; }
  // PDF de la liquidación
  if (text.startsWith('SELECT * FROM liquidaciones')) return { rows: [{ id: LIQ, entity_id: ENTITY, periodo_inicio: '2027-01-01', periodo_fin: '2027-06-30', total_ingresos: '2400', total_gastos: '2350.75', saldo: '49.25', creado_en: '2027-07-02', notas: null }] };
  if (text.startsWith('SELECT tipo, categoria, SUM(importe) AS total FROM movimientos_contables')) return { rows: [{ tipo: 'gasto', categoria: 'Limpieza', total: '2350.75' }, { tipo: 'ingreso', categoria: 'Cuotas', total: '2400' }] };
  if (text.startsWith('SELECT id, nombre_completo, propiedad_detalle, coeficiente FROM propietarios')) return { rows: [{ id: 'p1', nombre_completo: 'Ana', propiedad_detalle: '1ºA', coeficiente: '60' }, { id: 'p2', nombre_completo: 'Luis', propiedad_detalle: '1ºB', coeficiente: '40' }] };
  if (text.startsWith('SELECT c.propietario_id, SUM(c.importe) AS emitido')) return { rows: [{ propietario_id: 'p1', emitido: '1440', cobrado: '1440' }] };
  if (text.includes('FROM entities e JOIN tenants t')) return { rows: [{ nombre: 'C.P. Olmo 7', metadatos_legales: {}, nombre_entidad: 'Despacho' }] };
  throw new Error(`Query no esperada en el test: ${text}`);
};

mock.module('../db.js', { namedExports: { query: fakeQuery, withTransaction: async (fn) => fn(fakeQuery) } });

const { default: router } = await import('../routes/contabilidad.js');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', router);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;
const cookie = `votifai_session=${jwt.sign({ tenantId: TENANT }, process.env.JWT_SECRET)}`;
const post = (path, body) => fetch(`${base}/api${path}`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const get = (path) => fetch(`${base}/api${path}`, { headers: { Cookie: cookie } });

beforeEach(() => { escrituras.length = 0; saldoFondo = 1800; });

test('con partidas, el importe del presupuesto es su suma', async () => {
  const r = await post('/presupuestos/create', {
    entity_id: ENTITY, nombre: 'Ordinario 2027', anio: 2027, importe_previsto: 99999,
    partidas: [{ nombre: 'Limpieza', importe_previsto: 1200.5 }, { nombre: 'Luz', importe_previsto: 799.5 }]
  });
  assert.equal(r.status, 201);
  assert.equal(escrituras[0].importe, 2000);
  assert.deepEqual(escrituras.filter((e) => e.tabla === 'partida').map((e) => e.nombre), ['Limpieza', 'Luz']);
});

test('no admite partidas repetidas', async () => {
  const r = await post('/presupuestos/create', { entity_id: ENTITY, nombre: 'X', anio: 2027, partidas: [{ nombre: 'Luz', importe_previsto: 1 }, { nombre: 'luz', importe_previsto: 2 }] });
  assert.equal(r.status, 400);
  assert.equal(escrituras.length, 0);
});

test('la ejecución compara partidas y separa los gastos sin partida', async () => {
  const data = await (await get(`/presupuestos/${PRES}/ejecucion`)).json();
  assert.equal(data.partidas.find((p) => p.nombre === 'Limpieza').desviacion, 100);
  assert.deepEqual(data.sinPartida, [{ categoria: 'Jardín', gastado: 90 }]);
});

test('fondo de reserva: estado frente al 10 % y no se dispone de más de lo que hay', async () => {
  const estado = await (await get(`/fondo-reserva/${ENTITY}`)).json();
  assert.deepEqual([estado.saldo, estado.minimo, estado.cumple, estado.falta], [1800, 2400, false, 600]);
  assert.equal(estado.movimientos.length, 1);
  const demasiado = await post('/fondo-reserva/create', { entity_id: ENTITY, tipo: 'disposicion', concepto: 'Cubierta', importe: 2000, fecha: '2027-05-01' });
  assert.equal(demasiado.status, 400);
  const ok = await post('/fondo-reserva/create', { entity_id: ENTITY, tipo: 'aportacion', concepto: 'Dotación', importe: 600, fecha: '2027-05-01' });
  const data = await ok.json();
  assert.equal(ok.status, 201);
  assert.equal(data.minimo, 2400);
  assert.deepEqual(escrituras, [{ tabla: 'fondo', tipo: 'aportacion', importe: 600 }]);
});

test('la liquidación sale en PDF', async () => {
  const r = await get(`/liquidaciones/${LIQ}/pdf`);
  assert.equal(r.status, 200);
  assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
});
