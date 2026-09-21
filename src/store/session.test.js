import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTenant, hasActiveTenant, loadStoredTenant } from './session.js';

test('normalizeTenant maps backend fields into the frontend tenant shape', () => {
  const tenant = normalizeTenant({
    id: 'tenant-123',
    nombre_entidad: 'Despacho Demo',
    email_maestro: 'admin@demo.com',
    tipo_organizacion: 'administrador',
    plan_suscripcion: 'starter',
    nombre_responsable: 'Ana López',
    comunidades: [{ id: 'entity-1', nombre: 'Finca 1' }]
  });

  assert.equal(tenant.tenantId, 'tenant-123');
  assert.equal(tenant.nombreEntidad, 'Despacho Demo');
  assert.equal(tenant.admin.nombre, 'Ana López');
  assert.equal(tenant.comunidades.length, 1);
});

test('hasActiveTenant returns true only for valid tenant sessions', () => {
  assert.equal(hasActiveTenant(null), false);
  assert.equal(hasActiveTenant({ tenantId: 'tenant-123' }), true);
  assert.equal(hasActiveTenant({ admin: { nombre: 'Ana' } }), true);
});

test('loadStoredTenant reads the persisted tenant from localStorage', () => {
  globalThis.localStorage = {
    getItem: (key) => key === 'votifai_tenant' ? JSON.stringify({ tenantId: 'tenant-456', admin: { nombre: 'Pepe' } }) : null,
    setItem: () => {},
    removeItem: () => {}
  };

  const tenant = loadStoredTenant();
  assert.equal(tenant.tenantId, 'tenant-456');
  assert.equal(tenant.admin.nombre, 'Pepe');
});
