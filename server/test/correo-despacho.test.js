import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Buzón propio del despacho: los emails a sus vecinos salen de su cuenta
// (nunca de VotifAI) si la tiene conectada; WhatsApp sigue por n8n sin
// duplicar el email; sin buzón, n8n recibe el nombre y el email del
// despacho como remitente. La contraseña va cifrada y nunca se devuelve.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';
process.env.CORREOS_CLAVE_CIFRADO = 'clave-de-prueba-de-al-menos-32-caracteres!!';
process.env.N8N_WEBHOOK_URL = 'http://n8n.test/webhook';

const TENANT_ID = '99999999-0000-0000-0000-000000000001';
let buzon;
const enviadosSmtp = [];
const enviadosN8n = [];
const probados = [];
const inserts = [];
let fallarSmtp = false;

mock.module('../db.js', {
  namedExports: {
    query: async (text, params) => {
      if (text.includes('FROM tenants') && text.includes('COALESCE($1::uuid')) return { rows: [{ nombre_entidad: 'Gestiones Olmo', email_maestro: 'info@olmo.es' }] };
      if (text.startsWith('SELECT id FROM correos_despacho WHERE tenant_id = $1 AND LOWER(email)')) return { rows: [] };
      throw new Error(`Query no esperada en el test: ${text}`);
    },
    withTransaction: async (fn) => fn(async (text, params) => {
      if (text.startsWith('SELECT COUNT(*)::int AS total FROM correos_despacho')) return { rows: [{ total: 0 }] };
      if (text.startsWith('INSERT INTO correos_despacho')) { inserts.push(params); return { rows: [{ id: 'nuevo' }] }; }
      if (text.startsWith('UPDATE correos_despacho')) return { rows: [] };
      if (text.startsWith('SELECT id, etiqueta')) return { rows: [{ id: 'nuevo', email: inserts.at(-1)?.[2], principal: true }] };
      throw new Error(`Query no esperada en la transacción: ${text}`);
    })
  }
});

mock.module('../lib/correoDespacho.js', {
  namedExports: {
    AREAS: { juntas: 'Juntas', accesos: 'Accesos' },
    PROVEEDORES: ['gmail', 'otro'],
    buzonParaEnvio: async () => buzon,
    enviarConBuzon: async (b, datos) => {
      enviadosSmtp.push({ desde: b.email, ...datos });
      return fallarSmtp
        ? { enviados: 0, fallidos: datos.destinatarios.map((d) => ({ email: d.email, error: 'contraseña rechazada' })) }
        : { enviados: datos.destinatarios.length, fallidos: [] };
    },
    probarBuzon: async (datos, password) => { probados.push({ datos, password }); if (password === 'mala') throw Object.assign(new Error('535 bad'), { code: 'EAUTH' }); },
    explicarErrorSmtp: (err) => (err.code === 'EAUTH' ? 'El servidor de correo ha rechazado el usuario o la contraseña.' : err.message)
  }
});

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opciones) => {
  if (String(url).startsWith('http://n8n.test')) { enviadosN8n.push(JSON.parse(opciones.body)); return new Response('ok', { status: 200 }); }
  return realFetch(url, opciones);
};

const { notificar } = await import('../lib/notificaciones.js');
const { cifrar, descifrar } = await import('../lib/cifrado.js');
const { default: correosRouter } = await import('../routes/correos.js');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', correosRouter);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;
const cookie = `votifai_session=${jwt.sign({ tenantId: TENANT_ID }, process.env.JWT_SECRET)}`;

const VECINOS = [
  { nombre: 'Ana', email: 'ana@correo.es', telefono: '600', canal_preferido: 'ambos' },
  { nombre: 'Luis', email: 'luis@correo.es', telefono: null, canal_preferido: 'email' },
  { nombre: 'Marta', email: null, telefono: '611', canal_preferido: 'whatsapp' }
];
const convocatoria = () => notificar({ tipo: 'convocatoria', envio: { area: 'juntas', tenantId: TENANT_ID }, mensaje: { titulo: 'Convocatoria', cuerpo: 'Se convoca...' }, destinatarios: VECINOS });

beforeEach(() => { buzon = null; fallarSmtp = false; enviadosSmtp.length = 0; enviadosN8n.length = 0; probados.length = 0; inserts.length = 0; });

test('cifrado: ida y vuelta, y el texto cifrado no contiene la contraseña', () => {
  const c = cifrar('mi-contraseña-secreta');
  assert.doesNotMatch(c, /secreta/);
  assert.equal(descifrar(c), 'mi-contraseña-secreta');
  assert.notEqual(cifrar('x'), cifrar('x'));
});

test('con buzón propio: el email sale del despacho y a n8n solo va el WhatsApp', async () => {
  buzon = { id: 'b1', email: 'convocatorias@olmo.es' };
  const r = await convocatoria();
  assert.equal(r.desde, 'convocatorias@olmo.es');
  assert.deepEqual(enviadosSmtp[0].destinatarios.map((d) => d.email), ['ana@correo.es', 'luis@correo.es']);
  assert.equal(enviadosN8n.length, 1);
  assert.deepEqual(enviadosN8n[0].destinatarios.map((d) => [d.nombre, d.email]), [['Ana', null], ['Marta', null]]);
});

test('sin buzón propio: va por n8n con el despacho como remitente', async () => {
  await convocatoria();
  assert.equal(enviadosSmtp.length, 0);
  assert.deepEqual(enviadosN8n[0].remitente, { nombre: 'Gestiones Olmo', responder_a: 'info@olmo.es' });
  assert.equal(enviadosN8n[0].destinatarios.length, 3);
});

test('emails de VotifAI (sin área) no usan el buzón de ningún despacho', async () => {
  buzon = { id: 'b1', email: 'convocatorias@olmo.es' };
  await notificar({ tipo: 'bienvenida_despacho', mensaje: { titulo: 't', cuerpo: 'c' }, destinatarios: [{ email: 'x@y.es' }] });
  assert.equal(enviadosSmtp.length, 0);
  assert.equal(enviadosN8n[0].remitente, null);
});

test('si el buzón falla con todos, notificar lanza el error (la junta lo registra)', async () => {
  buzon = { id: 'b1', email: 'convocatorias@olmo.es' };
  fallarSmtp = true;
  await assert.rejects(convocatoria(), /No se pudo enviar desde convocatorias@olmo.es: contraseña rechazada/);
});

test('conectar buzón: se prueba antes de guardar, se cifra y nunca se devuelve la contraseña', async () => {
  const cuerpo = { email: 'Info@Olmo.es', nombre_remitente: 'Gestiones Olmo', proveedor: 'gmail', smtp_host: 'smtp.gmail.com', smtp_puerto: 465, smtp_seguro: true, smtp_password: 'abcd efgh ijkl mnop' };
  const r = await fetch(`${base}/api/despacho/correos`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const data = await r.json();
  assert.equal(r.status, 201);
  assert.equal(probados[0].datos.email, 'info@olmo.es');
  assert.equal(probados[0].datos.smtp_usuario, 'info@olmo.es');
  const cifrada = inserts[0][9];
  assert.doesNotMatch(cifrada, /abcd/);
  assert.equal(descifrar(cifrada), 'abcd efgh ijkl mnop');
  assert.doesNotMatch(JSON.stringify(data), /abcd|smtp_password/);
});

test('conectar buzón: credenciales rechazadas → no se guarda y se explica', async () => {
  const cuerpo = { email: 'info@olmo.es', nombre_remitente: 'Olmo', smtp_host: 'smtp.gmail.com', smtp_puerto: 465, smtp_password: 'mala' };
  const r = await fetch(`${base}/api/despacho/correos`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /rechazado el usuario o la contraseña/);
  assert.equal(inserts.length, 0);
});

test('conectar buzón: datos no válidos', async () => {
  const mal = (extra) => fetch(`${base}/api/despacho/correos`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@b.es', nombre_remitente: 'X', smtp_host: 'smtp.b.es', smtp_puerto: 465, smtp_password: 'p', ...extra }) }).then((r) => r.status);
  assert.equal(await mal({ email: 'no-email' }), 400);
  assert.equal(await mal({ smtp_host: 'http://raro' }), 400);
  assert.equal(await mal({ smtp_puerto: 99999 }), 400);
  assert.equal(await mal({ smtp_password: '' }), 400);
  assert.equal(probados.length, 0);
});
