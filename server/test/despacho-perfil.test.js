import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Perfil del despacho: cambiar email o contraseña exige la contraseña
// actual, el email nuevo no puede estar en uso por otra cuenta (sin
// distinguir mayúsculas) y todo va siempre sobre el tenant de la sesión.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';
delete process.env.STRIPE_SECRET_KEY;

const TENANT_ID = 'tenant-propio';
const PASSWORD = 'password-actual-123';
const hashActual = await bcrypt.hash(PASSWORD, 4);
let emailsOcupados;
const updates = [];

mock.module('../db.js', {
  namedExports: {
    query: async (text, params) => {
      if (text.startsWith('SELECT password_hash FROM tenants')) return { rows: params[0] === TENANT_ID ? [{ password_hash: hashActual }] : [] };
      if (text.includes('LOWER(email_maestro) = $1 AND id != $2')) return { rows: emailsOcupados.includes(params[0]) ? [{ id: 'otro' }] : [] };
      if (text.startsWith('UPDATE tenants')) {
        updates.push({ text, params });
        return { rows: [{ id: params.at(-1), email_maestro: params[0], proveedor_cliente_id: null }], rowCount: 1 };
      }
      throw new Error(`Query no esperada en el test: ${text}`);
    }
  }
});

const { default: despachoRouter } = await import('../routes/despacho.js');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', despachoRouter);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;
const cookie = `votifai_session=${jwt.sign({ tenantId: TENANT_ID }, process.env.JWT_SECRET)}`;
const put = (path, body) => fetch(`${base}${path}`, { method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => { updates.length = 0; emailsOcupados = ['ocupado@example.com']; });

test('cambiar email con contraseña incorrecta da 401 y no toca nada', async () => {
  const respuesta = await put('/api/despacho/email', { email: 'nuevo@example.com', passwordActual: 'mala' });
  assert.equal(respuesta.status, 401);
  assert.equal(updates.length, 0);
});

test('cambiar email a uno en uso (con otras mayúsculas) da 409', async () => {
  const respuesta = await put('/api/despacho/email', { email: ' Ocupado@Example.com ', passwordActual: PASSWORD });
  assert.equal(respuesta.status, 409);
  assert.equal(updates.length, 0);
});

test('cambiar email correcto lo guarda normalizado en el tenant de la sesión', async () => {
  const respuesta = await put('/api/despacho/email', { email: ' Nuevo@Example.com ', passwordActual: PASSWORD });
  assert.equal(respuesta.status, 200);
  assert.deepEqual(updates[0].params, ['nuevo@example.com', TENANT_ID]);
});

test('cambiar contraseña exige la actual y al menos 8 caracteres', async () => {
  assert.equal((await put('/api/despacho/password', { passwordActual: PASSWORD, passwordNueva: 'corta' })).status, 400);
  assert.equal((await put('/api/despacho/password', { passwordActual: 'mala', passwordNueva: 'nueva-password-123' })).status, 401);
  const ok = await put('/api/despacho/password', { passwordActual: PASSWORD, passwordNueva: 'nueva-password-123' });
  assert.equal(ok.status, 200);
  assert.equal(updates.length, 1);
  assert.equal(await bcrypt.compare('nueva-password-123', updates[0].params[0]), true);
  assert.equal(updates[0].params[1], TENANT_ID);
});

test('editar perfil exige nombre y nunca cambia el email', async () => {
  assert.equal((await put('/api/despacho/perfil', { nombreEntidad: '  ' })).status, 400);
  const ok = await put('/api/despacho/perfil', { nombreEntidad: 'Despacho Nuevo', cif: 'b12345678', email: 'intento@example.com' });
  assert.equal(ok.status, 200);
  assert.equal(updates[0].text.split('RETURNING')[0].includes('email_maestro'), false);
  assert.equal(updates[0].params[2], 'B12345678');
  assert.equal(updates[0].params.at(-1), TENANT_ID);
});
