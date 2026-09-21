import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANES, obtenerPlan } from '../lib/planes.js';

test('expone los cuatro planes comerciales', () => {
  assert.deepEqual(Object.keys(PLANES), ['starter', 'profesional', 'premium', 'enterprise']);
});

test('los límites crecen por nivel de plan', () => {
  assert.equal(PLANES.starter.maxFincas, 5);
  assert.equal(PLANES.profesional.maxFincas, 25);
  assert.equal(PLANES.premium.maxFincas, 100);
  assert.equal(PLANES.enterprise.maxFincas, null);
});

test('solo los planes superiores incluyen transcripción de voz', () => {
  assert.equal(PLANES.starter.transcripcionVoz, false);
  assert.equal(PLANES.profesional.transcripcionVoz, true);
  assert.equal(PLANES.premium.transcripcionVoz, true);
  assert.equal(PLANES.enterprise.transcripcionVoz, true);
});

test('un plan desconocido vuelve a Starter', () => {
  assert.equal(obtenerPlan('plan-inexistente'), PLANES.starter);
  assert.equal(obtenerPlan(), PLANES.starter);
});

test('publica precios orientativos desde y deja Enterprise a medida', () => {
  assert.equal(PLANES.starter.precioDesde, 49);
  assert.equal(PLANES.profesional.precioDesde, 99);
  assert.equal(PLANES.premium.precioDesde, 199);
  assert.equal(PLANES.enterprise.precioDesde, null);
});