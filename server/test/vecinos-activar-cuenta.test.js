import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

// Alta de vecino sin código: con el email del censo recibe un enlace para
// crear su contraseña. La respuesta es la misma exista o no el correo, para
// no revelar quién figura en un censo.

let censo;
const enviados = [];
const tokens = [];

mock.module('../db.js', {
  namedExports: {
    query: async (text, params) => {
      if (text.includes('FROM propietarios p JOIN entities e')) {
        assert.equal(params.length, 1);
        return { rows: censo.filter((p) => p.email === params[0]) };
      }
      if (text.startsWith('UPDATE propietarios SET reset_token')) {
        assert.equal(params.length, 2);
        tokens.push(params);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Query no esperada en el test: ${text}`);
    }
  }
});
mock.module('../lib/notificaciones.js', { namedExports: { notificar: async (p) => { enviados.push(p); return { enviado: true }; } } });

const { default: vecinosRouter } = await import('../routes/vecinos.js');
const app = express();
app.use(express.json());
app.use('/api', vecinosRouter);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;

const pedir = (email) => fetch(`${base}/api/vecinos/activar-cuenta`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
}).then(async (r) => ({ status: r.status, body: await r.json() }));

beforeEach(() => {
  enviados.length = 0; tokens.length = 0;
  censo = [
    { id: 'p1', email: 'ana@correo.es', nombre_completo: 'Ana', propiedad_detalle: '1ºA', tiene_cuenta: false, finca: 'C.P. Olmo 3' },
    { id: 'p2', email: 'luis@correo.es', nombre_completo: 'Luis', propiedad_detalle: '2ºB', tiene_cuenta: true, finca: 'C.P. Olmo 3' }
  ];
});

test('propietario sin cuenta: recibe el enlace de activación', async () => {
  const r = await pedir('  Ana@Correo.es ');
  assert.equal(r.status, 200);
  assert.equal(tokens[0][1], 'p1');
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].destinatarios[0].email, 'ana@correo.es');
  assert.match(enviados[0].mensaje.cuerpo, /restablecer-password\/comunidad\?token=[0-9a-f]{64}&alta=1/);
  assert.match(enviados[0].mensaje.cuerpo, /C\.P\. Olmo 3/);
});

test('propietario que ya tiene cuenta: recibe un enlace para nueva contraseña', async () => {
  await pedir('luis@correo.es');
  assert.equal(enviados.length, 1);
  assert.doesNotMatch(enviados[0].mensaje.cuerpo, /alta=1/);
  assert.match(enviados[0].mensaje.cuerpo, /Ya tienes una cuenta/);
});

test('correo que no está en ningún censo: misma respuesta y no se envía nada', async () => {
  const noExiste = await pedir('nadie@correo.es');
  const existe = await pedir('ana@correo.es');
  assert.equal(noExiste.status, 200);
  assert.deepEqual(noExiste.body, existe.body);
  assert.equal(enviados.length, 1);
});
