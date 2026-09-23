import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Modo solo lectura por suscripción: qué estados dan acceso completo, que
// el middleware global bloquee escrituras (y solo escrituras) de un
// despacho sin suscripción en vigor, y que los eventos de Stripe se
// traduzcan al estado correcto (antes cualquier subscription.updated que no
// fuera past_due se guardaba como 'active', incluido 'unpaid' o 'canceled').

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

let tenantFila = { plan_suscripcion: 'starter', suscripcion_estado: 'trialing', trial_fin: new Date(Date.now() + 86400000) };

mock.module('../db.js', {
  namedExports: {
    query: async (text) => {
      if (text.includes('FROM tenants WHERE id = $1')) return { rows: [{ ...tenantFila, trial_inicio: null, suscripcion_periodo_fin: null }] };
      if (text.includes('FROM entities WHERE tenant_id')) return { rows: [{ total: 0 }] };
      throw new Error(`Query no esperada en el test: ${text}`);
    }
  }
});

const { calcularAcceso } = await import('../lib/suscripciones.js');
const { exigirSuscripcionParaEscribir } = await import('../middleware/suscripcion.js');
const { cambioDesdeEventoStripe } = await import('../routes/billing.js');

const ayer = new Date(Date.now() - 86400000);
const manana = new Date(Date.now() + 86400000);

test('calcularAcceso: prueba vigente, activa y past_due tienen acceso completo', () => {
  assert.deepEqual(calcularAcceso({ suscripcion_estado: 'trialing', trial_fin: manana }), { estado: 'trialing', accesoCompleto: true });
  assert.equal(calcularAcceso({ suscripcion_estado: 'active', trial_fin: ayer }).accesoCompleto, true);
  assert.equal(calcularAcceso({ suscripcion_estado: 'past_due', trial_fin: ayer }).accesoCompleto, true);
});

test('calcularAcceso: prueba caducada, cancelada o incomplete sin prueba quedan en solo lectura', () => {
  assert.deepEqual(calcularAcceso({ suscripcion_estado: 'trialing', trial_fin: ayer }), { estado: 'expired', accesoCompleto: false });
  assert.equal(calcularAcceso({ suscripcion_estado: 'canceled', trial_fin: manana }).accesoCompleto, false);
  assert.equal(calcularAcceso({ suscripcion_estado: 'incomplete', trial_fin: ayer }).accesoCompleto, false);
  assert.equal(calcularAcceso({ suscripcion_estado: 'incomplete', trial_fin: manana }).accesoCompleto, true);
});

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', exigirSuscripcionParaEscribir);
app.all('/api/*splat', (req, res) => res.json({ ok: true }));
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;
const cookie = `votifai_session=${jwt.sign({ tenantId: 'tenant-1' }, process.env.JWT_SECRET)}`;
const pedir = (method, path) => fetch(`${base}${path}`, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });

test('middleware: con la prueba caducada bloquea escrituras con 402 y deja leer', async () => {
  tenantFila = { plan_suscripcion: 'starter', suscripcion_estado: 'trialing', trial_fin: ayer };
  const escritura = await pedir('POST', '/api/meetings/create');
  assert.equal(escritura.status, 402);
  assert.equal((await escritura.json()).codigo, 'SUSCRIPCION_INACTIVA');
  assert.equal((await pedir('PUT', '/api/entities/update')).status, 402);
  assert.equal((await pedir('GET', '/api/meetings/lista')).status, 200);
  assert.equal((await pedir('DELETE', '/api/entities/delete/x')).status, 200);
});

test('middleware: billing, auth y lado vecino nunca se bloquean', async () => {
  tenantFila = { plan_suscripcion: 'starter', suscripcion_estado: 'canceled', trial_fin: ayer };
  assert.equal((await pedir('POST', '/api/billing/checkout')).status, 200);
  assert.equal((await pedir('POST', '/api/auth/logout')).status, 200);
  assert.equal((await pedir('POST', '/api/meetings/vecino/puntos/p1/votar')).status, 200);
  assert.equal((await pedir('POST', '/api/asistencia/e1/voz')).status, 200);
});

test('middleware: con suscripción activa deja escribir', async () => {
  tenantFila = { plan_suscripcion: 'profesional', suscripcion_estado: 'active', trial_fin: ayer };
  assert.equal((await pedir('POST', '/api/meetings/create')).status, 200);
});

test('Stripe: el status de la suscripción se traduce, no se asume active', () => {
  assert.equal(cambioDesdeEventoStripe('customer.subscription.updated', { id: 'sub', status: 'active' }).estado, 'active');
  assert.equal(cambioDesdeEventoStripe('customer.subscription.updated', { id: 'sub', status: 'unpaid' }).estado, 'canceled');
  assert.equal(cambioDesdeEventoStripe('customer.subscription.created', { id: 'sub', status: 'incomplete' }).estado, 'incomplete');
  assert.equal(cambioDesdeEventoStripe('customer.subscription.deleted', { id: 'sub', status: 'canceled' }).estado, 'canceled');
});

test('Stripe: fin de periodo se lee también desde los items (API nueva)', () => {
  const cambio = cambioDesdeEventoStripe('customer.subscription.updated', { id: 'sub', status: 'active', items: { data: [{ current_period_end: 1800000000 }] } });
  assert.equal(cambio.periodoFin.getTime(), 1800000000 * 1000);
});

test('Stripe: checkout sin pagar e invoice.payment_failed no cambian el estado', () => {
  assert.equal(cambioDesdeEventoStripe('checkout.session.completed', { payment_status: 'unpaid', subscription: 'sub' }), null);
  assert.equal(cambioDesdeEventoStripe('checkout.session.completed', { payment_status: 'paid', subscription: 'sub' }).estado, 'active');
  assert.equal(cambioDesdeEventoStripe('invoice.payment_failed', {}), null);
});
