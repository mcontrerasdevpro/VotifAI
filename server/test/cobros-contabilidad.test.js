import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Cobrar una cuota genera su ingreso en contabilidad (en la misma
// transacción), no se puede cobrar más de lo pendiente ni una cuota
// anulada, y el ingreso automático no se borra suelto desde Contabilidad.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const TENANT = 'tenant-1';
const CUOTA = '00000000-0000-0000-0000-0000000000c1';
const MOV_CUOTA = '00000000-0000-0000-0000-0000000000a1';
const MOV_MANUAL = '00000000-0000-0000-0000-0000000000a2';

let cuota;
let periodoCerrado; // null = abierto; o { periodo_inicio, periodo_fin }
let cobrosDeLaCuota;
const escrituras = [];

const fakeQuery = async (text, params) => {
  if (text.includes('JOIN entities e') && text.includes('e.tenant_id')) return { rows: [{ id: params[0] }] };
  if (text.startsWith('SELECT c.propietario_id, c.entity_id, c.concepto')) return { rows: [cuota] };
  if (text.startsWith('INSERT INTO pagos')) { escrituras.push({ tabla: 'pagos', importe: params[1] }); return { rows: [{ id: 'pago-1', fecha_pago: '2027-02-01' }] }; }
  if (text.startsWith('INSERT INTO movimientos_contables')) {
    escrituras.push({ tabla: 'movimientos', concepto: params[1], categoria: params[2], importe: params[3], pago_id: params[6] });
    return { rows: [], rowCount: 1 };
  }
  // recalcularEstadoCuota / recalcularMorosidad
  if (text.startsWith('SELECT importe, fecha_vencimiento, estado FROM cuotas')) return { rows: [{ importe: cuota.importe, fecha_vencimiento: '2027-03-01', estado: 'pendiente' }] };
  if (text.startsWith('SELECT COALESCE(SUM(importe), 0) AS total FROM pagos')) return { rows: [{ total: '0' }] };
  if (text.startsWith('UPDATE cuotas SET estado') && !text.includes("'anulada'")) return { rows: [], rowCount: 1 };
  if (text.includes("FROM cuotas WHERE propietario_id = $1 AND estado = 'impagada'")) return { rows: [{ total: '0' }] };
  if (text.startsWith('UPDATE propietarios SET es_moroso')) return { rows: [], rowCount: 1 };
  // Contabilidad
  if (text.includes('FROM liquidaciones') && text.includes('BETWEEN periodo_inicio AND periodo_fin')) return { rows: periodoCerrado ? [periodoCerrado] : [] };
  if (text.startsWith('SELECT origen, entity_id, fecha FROM movimientos_contables')) return { rows: [{ origen: params[0] === MOV_CUOTA ? 'cuota' : 'manual', entity_id: 'e1', fecha: '2027-01-15' }] };
  if (text.startsWith('SELECT propietario_id, (SELECT COUNT(*) FROM pagos')) return { rows: [{ propietario_id: 'p1', cobros: cobrosDeLaCuota }] };
  if (text.startsWith('DELETE FROM cuotas')) { escrituras.push({ tabla: 'cuota_borrada' }); return { rows: [], rowCount: 1 }; }
  if (text.startsWith('SELECT id, emision_id, estado, (SELECT COUNT(*) FROM pagos')) return { rows: [{ id: CUOTA, emision_id: 'emision-1', estado: 'pendiente', cobros: cobrosDeLaCuota }] };
  if (text.startsWith("UPDATE cuotas SET estado = 'anulada'")) {
    escrituras.push({ tabla: 'anulacion', porEmision: text.includes('emision_id = $3'), motivo: params[1] });
    return { rows: [{ propietario_id: 'p1' }, { propietario_id: 'p2' }] };
  }
  if (text.startsWith('SELECT COUNT(*)::int AS total FROM cuotas WHERE emision_id')) return { rows: [{ total: 1 }] };
  if (text.startsWith('DELETE FROM movimientos_contables')) { escrituras.push({ tabla: 'borrado', id: params[0] }); return { rows: [], rowCount: 1 }; }
  throw new Error(`Query no esperada en el test: ${text}`);
};

mock.module('../db.js', { namedExports: { query: fakeQuery, withTransaction: async (fn) => fn(fakeQuery) } });

const { default: cuotasRouter } = await import('../routes/cuotas.js');
const { default: contabilidadRouter } = await import('../routes/contabilidad.js');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', cuotasRouter);
app.use('/api', contabilidadRouter);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;
const cookie = `votifai_session=${jwt.sign({ tenantId: TENANT }, process.env.JWT_SECRET)}`;
const cobrar = (importe) => fetch(`${base}/api/cuotas/${CUOTA}/pagos`, {
  method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ importe, metodo_pago: 'transferencia', referencia: 'TR-1' })
});

beforeEach(() => {
  cuota = { propietario_id: 'p1', entity_id: 'e1', concepto: 'Cuota ordinaria', periodo: 'Enero 2027', tipo: 'ordinaria', importe: '120.00', estado: 'pendiente', propiedad_detalle: '1ºA', nombre_completo: 'Ana', pagado: '20.00' };
  escrituras.length = 0;
  periodoCerrado = null;
  cobrosDeLaCuota = 0;
});

test('cobrar una cuota crea el pago y su ingreso en contabilidad', async () => {
  const r = await cobrar(100);
  assert.equal(r.status, 201);
  assert.deepEqual(escrituras.map((e) => e.tabla), ['pagos', 'movimientos']);
  const mov = escrituras[1];
  assert.equal(mov.categoria, 'Cuotas');
  assert.equal(mov.importe, 100);
  assert.equal(mov.pago_id, 'pago-1');
  assert.match(mov.concepto, /Cuota ordinaria \(Enero 2027\) — 1ºA/);
});

test('una derrama se anota en la categoría Derramas', async () => {
  cuota.tipo = 'derrama';
  await cobrar(50);
  assert.equal(escrituras.find((e) => e.tabla === 'movimientos').categoria, 'Derramas');
});

test('no se puede cobrar más de lo pendiente ni una cuota anulada', async () => {
  const demasiado = await cobrar(100.01); // pendiente: 120 - 20 = 100
  assert.equal(demasiado.status, 400);
  assert.match((await demasiado.json()).error, /100\.00/);
  cuota.estado = 'anulada';
  assert.equal((await cobrar(10)).status, 409);
  assert.equal(escrituras.length, 0);
});

test('desde Contabilidad no se borra un ingreso que viene de una cuota, uno manual sí', async () => {
  const bloqueado = await fetch(`${base}/api/movimientos/delete/${MOV_CUOTA}`, { method: 'DELETE', headers: { Cookie: cookie } });
  assert.equal(bloqueado.status, 409);
  const manual = await fetch(`${base}/api/movimientos/delete/${MOV_MANUAL}`, { method: 'DELETE', headers: { Cookie: cookie } });
  assert.equal(manual.status, 200);
  assert.deepEqual(escrituras, [{ tabla: 'borrado', id: MOV_MANUAL }]);
});

test('no se cobra ni se borra un movimiento dentro de un periodo ya liquidado', async () => {
  periodoCerrado = { periodo_inicio: '2027-01-01', periodo_fin: '2027-03-31' };
  const cobro = await cobrar(10);
  assert.equal(cobro.status, 409);
  assert.match((await cobro.json()).error, /liquidado/);
  const borrado = await fetch(`${base}/api/movimientos/delete/${MOV_MANUAL}`, { method: 'DELETE', headers: { Cookie: cookie } });
  assert.equal(borrado.status, 409);
  assert.equal(escrituras.length, 0);
});

test('una cuota con cobros no se borra; sin cobros sí', async () => {
  cobrosDeLaCuota = 2;
  assert.equal((await fetch(`${base}/api/cuotas/delete/${CUOTA}`, { method: 'DELETE', headers: { Cookie: cookie } })).status, 409);
  cobrosDeLaCuota = 0;
  assert.equal((await fetch(`${base}/api/cuotas/delete/${CUOTA}`, { method: 'DELETE', headers: { Cookie: cookie } })).status, 200);
  assert.deepEqual(escrituras, [{ tabla: 'cuota_borrada' }]);
});

test('anular exige motivo y puede anular toda la emisión (sin tocar las que tienen cobros)', async () => {
  const anular = (body) => fetch(`${base}/api/cuotas/${CUOTA}/anular`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await anular({})).status, 400);
  const r = await anular({ motivo: 'Emisión duplicada', toda_la_emision: true });
  const data = await r.json();
  assert.equal(r.status, 200);
  assert.equal(escrituras[0].porEmision, true);
  assert.equal(escrituras[0].motivo, 'Emisión duplicada');
  assert.match(data.mensaje, /tienen cobros/);
});

test('las liquidaciones no se borran: se anulan con motivo', async () => {
  const r = await fetch(`${base}/api/liquidaciones/delete/x`, { method: 'DELETE', headers: { Cookie: cookie } });
  assert.equal(r.status, 409);
});
