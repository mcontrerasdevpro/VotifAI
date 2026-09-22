import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

// Registra las llamadas hechas a query() para poder comprobar qué SQL/params
// recibió cada helper, y deja que cada test configure qué filas devolver.
let nextRows = [];
const calls = [];
mock.module('../db.js', {
  namedExports: {
    query: async (text, params) => {
      calls.push({ text, params });
      return { rows: nextRows, rowCount: nextRows.length };
    }
  }
});

const {
  requireAuth,
  requireVoterAuth,
  entityBelongsToTenant,
  propietarioBelongsToTenant,
  filaBelongsToTenant,
  filaBelongsToTenantDirecto,
  puntoBelongsToTenant,
  puntoBelongsToEntity,
  issueSessionCookie,
  issueVoterSessionCookie,
  COOKIE_NAME
} = await import('../middleware/auth.js');

function fakeRes() {
  const res = { statusCode: null, body: null, cookies: {} };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.cookie = (name, value) => { res.cookies[name] = value; return res; };
  res.clearCookie = () => res;
  return res;
}

// ---------------------------------------------------------------------
// Helpers de pertenencia a tenant — el mismo tipo de comprobación que
// faltaba en incidencias.js/crm.js (bug real encontrado y arreglado).
// ---------------------------------------------------------------------

test('entityBelongsToTenant: false sin entityId/tenantId (no consulta la BD)', async () => {
  calls.length = 0;
  assert.equal(await entityBelongsToTenant(null, 'tenant-1'), false);
  assert.equal(await entityBelongsToTenant('entity-1', null), false);
  assert.equal(calls.length, 0);
});

test('entityBelongsToTenant: true cuando la fila existe', async () => {
  nextRows = [{ id: 'entity-1' }];
  assert.equal(await entityBelongsToTenant('entity-1', 'tenant-1'), true);
});

test('entityBelongsToTenant: false cuando la fila pertenece a otro tenant', async () => {
  nextRows = [];
  assert.equal(await entityBelongsToTenant('entity-1', 'tenant-ajeno'), false);
});

test('propietarioBelongsToTenant: false cuando el propietario es de otro tenant', async () => {
  nextRows = [];
  const resultado = await propietarioBelongsToTenant('propietario-de-otro-tenant', 'tenant-1');
  assert.equal(resultado, false);
});

test('propietarioBelongsToTenant: true cuando la fila existe tras el JOIN con entities', async () => {
  nextRows = [{ id: 'propietario-1' }];
  assert.equal(await propietarioBelongsToTenant('propietario-1', 'tenant-1'), true);
});

test('filaBelongsToTenant/filaBelongsToTenantDirecto: false sin filaId/tenantId', async () => {
  assert.equal(await filaBelongsToTenant('documentos', null, 'tenant-1'), false);
  assert.equal(await filaBelongsToTenantDirecto('proveedores', 'fila-1', null), false);
});

test('puntoBelongsToTenant: true/false según la fila del JOIN meeting_puntos->meetings->entities', async () => {
  nextRows = [{ id: 'punto-1' }];
  assert.equal(await puntoBelongsToTenant('punto-1', 'tenant-1'), true);
  nextRows = [];
  assert.equal(await puntoBelongsToTenant('punto-1', 'tenant-ajeno'), false);
});

test('puntoBelongsToEntity: compara contra la entidad del vecino, no contra un tenant', async () => {
  nextRows = [{ id: 'punto-1' }];
  assert.equal(await puntoBelongsToEntity('punto-1', 'entity-1'), true);
});

// ---------------------------------------------------------------------
// requireAuth / requireVoterAuth
// ---------------------------------------------------------------------

test('requireAuth: 401 sin cookie de sesión', () => {
  const req = { cookies: {} };
  const res = fakeRes();
  let nextLlamado = false;
  requireAuth(req, res, () => { nextLlamado = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextLlamado, false);
});

test('requireAuth: 401 con un token firmado con otro secreto', () => {
  const tokenAjeno = jwt.sign({ tenantId: 'tenant-1' }, 'otro-secreto-distinto');
  const req = { cookies: { [COOKIE_NAME]: tokenAjeno } };
  const res = fakeRes();
  let nextLlamado = false;
  requireAuth(req, res, () => { nextLlamado = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextLlamado, false);
});

test('requireAuth: pasa y fija req.tenantId con un token válido', () => {
  const token = jwt.sign({ tenantId: 'tenant-1', tipoOrganizacion: 'administrador' }, process.env.JWT_SECRET);
  const req = { cookies: { [COOKIE_NAME]: token } };
  const res = fakeRes();
  let nextLlamado = false;
  requireAuth(req, res, () => { nextLlamado = true; });
  assert.equal(nextLlamado, true);
  assert.equal(req.tenantId, 'tenant-1');
  assert.equal(res.statusCode, null);
});

test('requireVoterAuth: fija req.propietarioId y req.voterEntityId, nunca req.tenantId', () => {
  const token = jwt.sign({ propietarioId: 'prop-1', entityId: 'entity-1' }, process.env.JWT_SECRET);
  const req = { cookies: { votifai_voter_session: token } };
  const res = fakeRes();
  let nextLlamado = false;
  requireVoterAuth(req, res, () => { nextLlamado = true; });
  assert.equal(nextLlamado, true);
  assert.equal(req.propietarioId, 'prop-1');
  assert.equal(req.voterEntityId, 'entity-1');
  assert.equal(req.tenantId, undefined);
});

test('issueSessionCookie/issueVoterSessionCookie: firman tokens que requireAuth/requireVoterAuth aceptan', () => {
  const res = fakeRes();
  issueSessionCookie(res, { id: 'tenant-9', tipo_organizacion: 'administrador' });
  const req = { cookies: { [COOKIE_NAME]: res.cookies[COOKIE_NAME] } };
  const res2 = fakeRes();
  let ok = false;
  requireAuth(req, res2, () => { ok = true; });
  assert.equal(ok, true);
  assert.equal(req.tenantId, 'tenant-9');

  const resVoter = fakeRes();
  issueVoterSessionCookie(resVoter, { id: 'prop-9', entity_id: 'entity-9' });
  const reqVoter = { cookies: { votifai_voter_session: resVoter.cookies.votifai_voter_session } };
  const resVoter2 = fakeRes();
  let okVoter = false;
  requireVoterAuth(reqVoter, resVoter2, () => { okVoter = true; });
  assert.equal(okVoter, true);
  assert.equal(reqVoter.propietarioId, 'prop-9');
  assert.equal(reqVoter.voterEntityId, 'entity-9');
});
