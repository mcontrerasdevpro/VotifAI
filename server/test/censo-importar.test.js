import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Importación del censo desde Excel/CSV: mismas reglas que el alta manual,
// todo o nada, emails únicos (en el archivo y en la base), límite del plan
// y coeficientes que no pasen del 100 %.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const { parsearCoeficiente, validarFilasCenso } = await import('../lib/importarCenso.js');

const TENANT_ID = 'tenant-1';
const ENTITY_ID = '11111111-1111-1111-1111-111111111111';
let censoActual, emailsEnUso, plan;
const inserts = [];

mock.module('../db.js', {
  namedExports: {
    query: async (text, params) => {
      if (text.startsWith('SELECT id FROM entities WHERE id = $1::uuid AND tenant_id = $2')) {
        return { rows: params[0] === ENTITY_ID && params[1] === TENANT_ID ? [{ id: ENTITY_ID }] : [] };
      }
      if (text.includes('WHERE LOWER(p.email) = ANY($1::text[])')) {
        assert.equal(params.length, 1);
        return { rows: params[0].filter((e) => emailsEnUso.includes(e)).map((email) => ({ email, finca: 'C.P. Otra' })) };
      }
      if (text.includes('COALESCE(SUM(coeficiente), 0)::float AS suma')) {
        assert.equal(params.length, 1);
        return { rows: [censoActual] };
      }
      if (text.startsWith('SELECT plan_suscripcion FROM tenants')) return { rows: [{ plan_suscripcion: plan }] };
      if (text.startsWith('SELECT COUNT(*)::int AS total FROM propietarios WHERE entity_id')) return { rows: [{ total: censoActual.total }] };
      if (text.startsWith('INSERT INTO propietarios')) {
        assert.equal(params.length, 6);
        inserts.push(params);
        return { rows: [], rowCount: params[1].length };
      }
      throw new Error(`Query no esperada en el test: ${text}`);
    }
  }
});

const { default: censoRouter } = await import('../routes/censo.js');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', censoRouter);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;
const cookie = `votifai_session=${jwt.sign({ tenantId: TENANT_ID }, process.env.JWT_SECRET)}`;
const importar = (body) => fetch(`${base}/api/propietarios/importar`, {
  method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ entity_id: ENTITY_ID, ...body })
}).then(async (r) => ({ status: r.status, body: await r.json() }));

const CENSO = [
  { fila: 2, propiedad: '1ºA', nombre: 'Ana Ruiz', email: 'Ana@Correo.es', telefono: '', coeficiente: '25,5' },
  { fila: 3, propiedad: '1ºB', nombre: 'Luis Gil', email: '', telefono: '600111222', coeficiente: 24.5 },
  { fila: 4, propiedad: '2ºA', nombre: 'Marta Sanz', email: 'marta@correo.es', telefono: '', coeficiente: '25 %' },
  { fila: 5, propiedad: '2ºB', nombre: 'Pedro León', email: 'pedro@correo.es', telefono: '', coeficiente: '25' }
];

beforeEach(() => {
  inserts.length = 0;
  censoActual = { total: 0, suma: 0 };
  emailsEnUso = [];
  plan = 'profesional';
});

test('coeficientes en formato español', () => {
  assert.equal(parsearCoeficiente('4,25'), 4.25);
  assert.equal(parsearCoeficiente('4.25'), 4.25);
  assert.equal(parsearCoeficiente(' 4,25 % '), 4.25);
  assert.equal(parsearCoeficiente(3), 3);
  assert.ok(Number.isNaN(parsearCoeficiente('abc')));
  assert.ok(Number.isNaN(parsearCoeficiente('')));
});

test('validación fila a fila con el número de fila del archivo', () => {
  const { validas, errores } = validarFilasCenso([
    { fila: 2, nombre: '', email: 'a@b.es', coeficiente: '10' },
    { fila: 3, nombre: 'Sin contacto', coeficiente: '10' },
    { fila: 4, nombre: 'Coef malo', email: 'c@d.es', coeficiente: 'diez' },
    { fila: 5, nombre: 'Email malo', email: 'no-es-email', coeficiente: '10' },
    { fila: 6, nombre: 'Repetido', email: 'C@D.es', coeficiente: '10' },
    { fila: 7, nombre: 'Bien', telefono: '600', coeficiente: '10' }
  ]);
  assert.deepEqual(errores.map((e) => e.fila), [2, 3, 4, 5, 6]);
  assert.match(errores.find((e) => e.fila === 6).mensaje, /ya aparece en la fila 4/);
  assert.equal(validas.length, 1);
  assert.equal(validas[0].propiedad, 'Vivienda');
});

test('vista previa (simular): valida y no inserta nada', async () => {
  const r = await importar({ propietarios: CENSO, simular: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.equal(r.body.validas, 4);
  assert.equal(r.body.suma_coeficientes, 100);
  assert.deepEqual(r.body.avisos, []);
  assert.equal(inserts.length, 0);
});

test('importa todas las filas en una sola sentencia, emails en minúsculas', async () => {
  const r = await importar({ propietarios: CENSO });
  assert.equal(r.status, 201);
  assert.equal(r.body.importados, 4);
  assert.equal(inserts.length, 1);
  const [entity, nombres, propiedades, telefonos, emails, coefs] = inserts[0];
  assert.equal(entity, ENTITY_ID);
  assert.deepEqual(nombres, ['Ana Ruiz', 'Luis Gil', 'Marta Sanz', 'Pedro León']);
  assert.deepEqual(propiedades, ['1ºA', '1ºB', '2ºA', '2ºB']);
  assert.deepEqual(telefonos, [null, '600111222', null, null]);
  assert.deepEqual(emails, ['ana@correo.es', null, 'marta@correo.es', 'pedro@correo.es']);
  assert.deepEqual(coefs, [25.5, 24.5, 25, 25]);
});

test('con una sola fila mal no se importa ninguna', async () => {
  const r = await importar({ propietarios: [...CENSO.slice(0, 3), { fila: 5, nombre: 'Pedro', coeficiente: '25' }] });
  assert.equal(r.status, 422);
  assert.deepEqual(r.body.errores.map((e) => e.fila), [5]);
  assert.equal(inserts.length, 0);
});

test('email que ya tiene otro propietario en la base', async () => {
  emailsEnUso = ['marta@correo.es'];
  const r = await importar({ propietarios: CENSO, simular: true });
  assert.equal(r.body.success, false);
  assert.deepEqual(r.body.errores.map((e) => e.fila), [4]);
  assert.match(r.body.errores[0].mensaje, /C\.P\. Otra/);
});

test('coeficientes: bloquea si pasan del 100 % y avisa si no llegan', async () => {
  censoActual = { total: 1, suma: 10 };
  const pasa = await importar({ propietarios: CENSO, simular: true });
  assert.equal(pasa.body.success, false);
  assert.match(pasa.body.errores[0].mensaje, /sumarían 110 %/);

  censoActual = { total: 0, suma: 0 };
  const falta = await importar({ propietarios: CENSO.slice(0, 3), simular: true });
  assert.equal(falta.body.success, true);
  assert.match(falta.body.avisos[0], /sumarán 75 %/);
});

test('límite de propietarios por finca del plan', async () => {
  plan = 'starter';
  censoActual = { total: 248, suma: 0 };
  const r = await importar({ propietarios: CENSO, simular: true });
  assert.equal(r.body.success, false);
  assert.match(r.body.errores.at(-1).mensaje, /hasta 250 propietarios/);
});

test('no se puede importar en una comunidad de otro despacho', async () => {
  const r = await fetch(`${base}/api/propietarios/importar`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_id: '22222222-2222-2222-2222-222222222222', propietarios: CENSO })
  });
  assert.equal(r.status, 403);
  assert.equal(inserts.length, 0);
});
