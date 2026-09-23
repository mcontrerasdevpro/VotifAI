import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Regresión: un despacho que ya paga y pulsa otro plan NO debe abrir un
// checkout nuevo (Stripe crearía una segunda suscripción y cobraría los dos
// planes cada mes). Tiene que cambiarse el precio de la suscripción que ya
// existe. Y un checkout nuevo siempre lleva el IVA y pide datos fiscales.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_TAX_RATE_IVA = 'txr_iva21';
process.env.STRIPE_PRICE_STARTER = 'price_starter';
process.env.STRIPE_PRICE_PROFESIONAL = 'price_profesional';
process.env.STRIPE_PRICE_PREMIUM = 'price_premium';

let tenant;
let fincas;
let statusSuscripcion;
const llamadas = [];

class FakeStripe {
  constructor() {
    this.subscriptions = {
      retrieve: async (id) => ({ id, status: statusSuscripcion, items: { data: [{ id: 'si_1' }] } }),
      update: async (id, datos) => { llamadas.push(['subscriptions.update', id, datos]); return {}; }
    };
    this.checkout = { sessions: { create: async (datos) => { llamadas.push(['checkout.create', datos]); return { url: 'https://checkout.stripe.test/s' }; } } };
    this.customers = { create: async () => ({ id: 'cus_nuevo' }) };
    this.billingPortal = { sessions: { create: async (datos) => { llamadas.push(['portal.create', datos]); return { url: 'https://portal.stripe.test/p' }; } } };
  }
}
mock.module('stripe', { defaultExport: FakeStripe });

mock.module('../db.js', {
  namedExports: {
    query: async (text, params) => {
      if (text.includes('FROM tenants WHERE id = $1')) return { rows: tenant ? [tenant] : [] };
      if (text.includes('FROM entities WHERE tenant_id')) return { rows: [{ total: fincas }] };
      if (text.startsWith('UPDATE tenants SET')) { llamadas.push(['db.update', text, params]); return { rows: [], rowCount: 1 }; }
      throw new Error(`Query no esperada en el test: ${text}`);
    }
  }
});

const { default: billingRouter } = await import('../routes/billing.js');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', billingRouter);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;
const cookie = `votifai_session=${jwt.sign({ tenantId: 'tenant-1' }, process.env.JWT_SECRET)}`;
const post = (path, body = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  llamadas.length = 0;
  fincas = 3;
  statusSuscripcion = 'active';
  tenant = { id: 'tenant-1', nombre_entidad: 'Despacho', email_maestro: 'a@b.es', proveedor_cliente_id: 'cus_1', proveedor_suscripcion_id: 'sub_1', plan_suscripcion: 'starter', suscripcion_estado: 'active' };
});

test('con suscripción activa, cambiar de plan actualiza la existente y no abre checkout', async () => {
  const respuesta = await post('/api/billing/checkout', { plan: 'profesional' });
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), { cambiado: true, plan: 'profesional' });
  assert.equal(llamadas.some(([tipo]) => tipo === 'checkout.create'), false);
  const [, id, datos] = llamadas.find(([tipo]) => tipo === 'subscriptions.update');
  assert.equal(id, 'sub_1');
  assert.deepEqual(datos.items, [{ id: 'si_1', price: 'price_profesional' }]);
  assert.equal(datos.metadata.plan, 'profesional');
});

test('elegir el mismo plan que ya se paga da 409', async () => {
  assert.equal((await post('/api/billing/checkout', { plan: 'starter' })).status, 409);
});

test('no deja bajar a un plan con menos fincas de las que ya usa', async () => {
  tenant.plan_suscripcion = 'profesional';
  fincas = 8;
  const respuesta = await post('/api/billing/checkout', { plan: 'starter' });
  assert.equal(respuesta.status, 409);
  assert.equal(llamadas.length, 0);
});

test('sin suscripción viva abre checkout con IVA 21 % y datos fiscales', async () => {
  statusSuscripcion = 'canceled';
  const respuesta = await post('/api/billing/checkout', { plan: 'premium' });
  assert.equal(respuesta.status, 201);
  const [, datos] = llamadas.find(([tipo]) => tipo === 'checkout.create');
  assert.deepEqual(datos.subscription_data.default_tax_rates, ['txr_iva21']);
  assert.equal(datos.tax_id_collection.enabled, true);
  assert.equal(datos.billing_address_collection, 'required');
  assert.deepEqual(datos.managed_payments, { enabled: false });
});

test('el portal se abre con el customer del despacho', async () => {
  const respuesta = await post('/api/billing/portal');
  assert.equal(respuesta.status, 201);
  assert.equal(llamadas.find(([tipo]) => tipo === 'portal.create')[1].customer, 'cus_1');
});
