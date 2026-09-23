import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Recibos y certificado de deuda: salen en PDF de verdad, un vecino solo
// descarga los recibos de sus propios cobros y un despacho solo los de sus
// fincas (y solo certifica a sus propietarios).

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const TENANT = 'tenant-1';
const PAGO = '00000000-0000-0000-0000-0000000000b1';
const DUENO = '00000000-0000-0000-0000-000000000001';
const OTRO_VECINO = '00000000-0000-0000-0000-000000000002';
const AJENO = '00000000-0000-0000-0000-000000000099';

const filaRecibo = {
  id: PAGO, importe: '82.50', metodo_pago: 'transferencia', fecha_pago: '2027-01-08', referencia: 'TR-1',
  entity_id: 'e1', concepto: 'Cuota ordinaria', periodo: 'Enero 2027', importe_cuota: '82.50', pagado_total: '82.50',
  propietario_id: DUENO, nombre_completo: 'María', propiedad_detalle: '2ºB', coeficiente: '8.25'
};

const fakeQuery = async (text, params) => {
  if (text.includes('FROM pagos pg') && text.includes('e.tenant_id = $2')) return { rows: params[1] === TENANT ? [filaRecibo] : [] };
  if (text.includes('FROM pagos pg') && text.includes('p.id = $2::uuid')) return { rows: params[1] === DUENO ? [filaRecibo] : [] };
  if (text.includes('FROM entities e JOIN tenants t')) return { rows: [{ nombre: 'C.P. Olmo 7', cif: 'H1', direccion: 'Olmo 7', metadatos_legales: { presidente: 'Juan' }, nombre_entidad: 'Despacho', t_cif: 'B1', t_direccion: 'Mayor 1', telefono: '600', email_maestro: 'a@b.es' }] };
  if (text.includes('FROM propietarios p') && text.includes('JOIN entities e ON p.entity_id = e.id')) return { rows: params[0] === DUENO && params[1] === TENANT ? [{ id: DUENO }] : [] };
  if (text.startsWith('SELECT id, entity_id, nombre_completo, propiedad_detalle, coeficiente FROM propietarios')) return { rows: [{ id: DUENO, entity_id: 'e1', nombre_completo: 'María', propiedad_detalle: '2ºB', coeficiente: '8.25' }] };
  if (text.startsWith("UPDATE cuotas SET estado = 'impagada'")) return { rows: [] };
  if (text.startsWith('SELECT c.concepto, c.periodo, c.fecha_vencimiento')) return { rows: [{ concepto: 'Cuota', periodo: 'Feb', fecha_vencimiento: '2027-02-10', importe: '82.50', estado: 'impagada', pagado: '0' }] };
  throw new Error(`Query no esperada en el test: ${text}`);
};

mock.module('../db.js', { namedExports: { query: fakeQuery, withTransaction: async (fn) => fn(fakeQuery) } });

const { default: router } = await import('../routes/cuotas.js');
const app = express();
app.use(cookieParser());
app.use('/api', router);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;
const despacho = (tenantId) => `votifai_session=${jwt.sign({ tenantId }, process.env.JWT_SECRET)}`;
const vecino = (propietarioId) => `votifai_voter_session=${jwt.sign({ propietarioId, entityId: 'e1' }, process.env.JWT_SECRET)}`;
const get = (path, cookie) => fetch(`${base}/api${path}`, { headers: { Cookie: cookie } });

test('el despacho descarga el recibo en PDF; otro despacho no', async () => {
  const ok = await get(`/cuotas/pagos/${PAGO}/recibo`, despacho(TENANT));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'application/pdf');
  assert.equal(Buffer.from(await ok.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
  assert.equal((await get(`/cuotas/pagos/${PAGO}/recibo`, despacho('otro-tenant'))).status, 404);
});

test('el vecino descarga su recibo, pero no el de otro vecino', async () => {
  assert.equal((await get(`/cuotas/vecino/pagos/${PAGO}/recibo`, vecino(DUENO))).status, 200);
  assert.equal((await get(`/cuotas/vecino/pagos/${PAGO}/recibo`, vecino(OTRO_VECINO))).status, 404);
});

test('certificado de deuda en PDF solo para propietarios del propio despacho', async () => {
  const ok = await get(`/cuotas/certificado-deuda/${DUENO}?finalidad=compraventa`, despacho(TENANT));
  assert.equal(ok.status, 200);
  assert.equal(Buffer.from(await ok.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
  assert.equal((await get(`/cuotas/certificado-deuda/${AJENO}`, despacho(TENANT))).status, 403);
});
