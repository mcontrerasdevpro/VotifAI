import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Regresión del bug real encontrado el 2026-09-22: POST /incidencias/create
// insertaba el propietario_id del body sin comprobar que perteneciera al
// tenant autenticado (a diferencia de cuotas.js/reservas.js, que sí lo
// hacían). Este test monta el router real de incidencias.js contra un
// servidor HTTP de verdad y falla si esa comprobación vuelve a desaparecer.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const TENANT_ID = 'tenant-propio';
const ENTITY_ID = 'entity-propia';
const PROPIETARIO_AJENO = 'propietario-de-otro-tenant';
const PROPIETARIO_PROPIO = 'propietario-de-mi-tenant';

const calls = [];
mock.module('../db.js', {
  namedExports: {
    query: async (text, params) => {
      calls.push({ text, params });

      if (text.includes('FROM entities WHERE id')) {
        // entityBelongsToTenant: la finca sí es del tenant autenticado.
        return { rows: params[0] === ENTITY_ID && params[1] === TENANT_ID ? [{ id: ENTITY_ID }] : [], rowCount: 0 };
      }
      if (text.includes('FROM propietarios p') && text.includes('JOIN entities e')) {
        // propietarioBelongsToTenant: solo el "propio" pertenece al tenant.
        const pertenece = params[0] === PROPIETARIO_PROPIO && params[1] === TENANT_ID;
        return { rows: pertenece ? [{ id: PROPIETARIO_PROPIO }] : [], rowCount: 0 };
      }
      if (text.includes('INSERT INTO incidencias')) {
        return { rows: [{ id: 'incidencia-1', titulo: params[2], estado: 'abierta' }], rowCount: 1 };
      }
      if (text.includes('INSERT INTO incidencia_eventos')) {
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Query no esperada en el test: ${text}`);
    }
  }
});

const { default: incidenciasRouter } = await import('../routes/incidencias.js');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', incidenciasRouter);

const server = app.listen(0);
const baseUrl = await new Promise((resolve) => server.on('listening', () => resolve(`http://127.0.0.1:${server.address().port}`)));
after(() => server.close());

function cookieHeader() {
  const token = jwt.sign({ tenantId: TENANT_ID, tipoOrganizacion: 'administrador' }, process.env.JWT_SECRET);
  return `votifai_session=${token}`;
}

test('POST /incidencias/create: 403 si propietario_id pertenece a otro tenant, y no llega a insertar', async () => {
  calls.length = 0;
  const respuesta = await fetch(`${baseUrl}/api/incidencias/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify({ entity_id: ENTITY_ID, propietario_id: PROPIETARIO_AJENO, titulo: 'Fuga de agua' })
  });

  assert.equal(respuesta.status, 403);
  assert.equal(calls.some((c) => c.text.includes('INSERT INTO incidencias')), false);
});

test('POST /incidencias/create: 201 si propietario_id pertenece al mismo tenant', async () => {
  calls.length = 0;
  const respuesta = await fetch(`${baseUrl}/api/incidencias/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify({ entity_id: ENTITY_ID, propietario_id: PROPIETARIO_PROPIO, titulo: 'Fuga de agua' })
  });

  assert.equal(respuesta.status, 201);
  assert.equal(calls.some((c) => c.text.includes('INSERT INTO incidencias')), true);
});

test('POST /incidencias/create: 201 si no se indica propietario_id (es opcional)', async () => {
  calls.length = 0;
  const respuesta = await fetch(`${baseUrl}/api/incidencias/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify({ entity_id: ENTITY_ID, titulo: 'Zona común sucia' })
  });

  assert.equal(respuesta.status, 201);
});

test('POST /incidencias/create: 403 si la finca no pertenece al tenant autenticado', async () => {
  calls.length = 0;
  const respuesta = await fetch(`${baseUrl}/api/incidencias/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify({ entity_id: 'entity-de-otro-tenant', titulo: 'Fuga de agua' })
  });

  assert.equal(respuesta.status, 403);
});
