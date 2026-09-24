import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

// Avisos de negocio (bienvenida + alerta a NexuraIA al registrarse,
// recordatorio de fin de prueba una sola vez) y la protección de las rutas
// de sistema con ADMIN_TOKEN.

process.env.ADMIN_TOKEN = 'token-de-prueba-123';
process.env.ALERTAS_EMAIL = 'alertas@nexuraia.com';

const enviados = [];
const marcados = [];
let pendientesDeRecordatorio;

const despacho = { id: 't1', nombre_entidad: 'Gestiones Olmo', nombre_responsable: 'Marta', email_maestro: 'marta@olmo.es', telefono: '600', cif: 'B1', plan_suscripcion: 'profesional', trial_fin: '2026-10-09T10:00:00Z' };

mock.module('../db.js', {
  namedExports: {
    query: async (text, params) => {
      if (text.includes('FROM tenants WHERE id = $1') && text.includes('nombre_responsable')) return { rows: [despacho] };
      if (text.includes("suscripcion_estado = 'trialing'") && text.includes('recordatorio_prueba_enviado_en IS NULL')) return { rows: pendientesDeRecordatorio.map((id) => ({ id })) };
      if (text.startsWith('UPDATE tenants SET recordatorio_prueba_enviado_en')) { marcados.push(params[0]); return { rows: [], rowCount: 1 }; }
      throw new Error(`Query no esperada en el test: ${text}`);
    }
  }
});
mock.module('../lib/notificaciones.js', { namedExports: { notificar: async (p) => { enviados.push(p); return { enviado: true, real: false }; } } });
mock.module('../lib/configuracion.js', { namedExports: { estadoSistema: async () => ({ ok: true, faltan: [], variables: [], comprobaciones: [], generado_en: new Date().toISOString() }) } });

const { avisarRegistro } = await import('../lib/avisosNegocio.js');
const { default: sistemaRouter } = await import('../routes/sistema.js');
const app = express();
app.use('/api', sistemaRouter);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;

beforeEach(() => { enviados.length = 0; marcados.length = 0; pendientesDeRecordatorio = []; });

test('al registrarse: bienvenida al despacho y alerta a NexuraIA con sus datos', async () => {
  await avisarRegistro('t1');
  const bienvenida = enviados.find((e) => e.tipo === 'bienvenida_despacho');
  const alerta = enviados.find((e) => e.tipo === 'alerta_registro');
  assert.equal(bienvenida.destinatarios[0].email, 'marta@olmo.es');
  assert.match(bienvenida.mensaje.cuerpo, /15 días de prueba gratuita del plan Profesional/);
  assert.equal(alerta.destinatarios[0].email, 'alertas@nexuraia.com');
  assert.match(alerta.mensaje.cuerpo, /Teléfono: 600/);
});

test('la página de estado y las tareas exigen ADMIN_TOKEN', async () => {
  assert.equal((await fetch(`${base}/api/estado-sistema`)).status, 401);
  assert.equal((await fetch(`${base}/api/estado-sistema?token=otro`)).status, 401);
  const ok = await fetch(`${base}/api/estado-sistema?token=token-de-prueba-123`);
  assert.equal(ok.status, 200);
  assert.match(await ok.text(), /Estado de VotifAI/);
  assert.equal((await fetch(`${base}/api/tareas/recordatorios-prueba`, { method: 'POST' })).status, 401);
});

test('recordatorio de fin de prueba: se envía y se marca para no repetirlo', async () => {
  pendientesDeRecordatorio = ['t1'];
  const r = await fetch(`${base}/api/tareas/recordatorios-prueba`, { method: 'POST', headers: { 'x-admin-token': 'token-de-prueba-123' } });
  assert.deepEqual(await r.json(), { success: true, enviados: 1 });
  assert.equal(enviados[0].tipo, 'recordatorio_fin_prueba');
  assert.match(enviados[0].mensaje.cuerpo, /modo consulta/);
  assert.deepEqual(marcados, ['t1']);
});
