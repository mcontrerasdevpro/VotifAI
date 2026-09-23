import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';

// Regresión del bug real encontrado el 2026-09-22: /vecinos/registro
// rechazaba el registro con "ya existe una cuenta con ese correo" cuando
// el despacho había precargado el email del propietario al darlo de alta
// en el censo (sin password_hash todavía) — la comprobación de "email ya
// usado" encontraba la propia fila del propietario que se está
// registrando. Este test cubre exactamente ese caso.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const ENTITY_ID = 'entity-1';
const CODIGO_ACCESO = 'VAI-TEST-1';
const PROPIETARIO_ID = 'propietario-1';
const EMAIL_PRECARGADO = 'vecino-precargado@example.com';

const calls = [];
mock.module('../db.js', {
  namedExports: {
    query: async (text, params) => {
      calls.push({ text, params });

      if (text.includes('SELECT codigo_acceso FROM entities')) {
        return { rows: [{ codigo_acceso: CODIGO_ACCESO }] };
      }
      if (text.includes('FROM propietarios WHERE id = $1::uuid AND entity_id = $2::uuid')) {
        // El propietario ya existe en el censo, con el email precargado
        // por el despacho pero SIN cuenta todavía (password_hash null).
        return { rows: [{ id: PROPIETARIO_ID, entity_id: ENTITY_ID, nombre_completo: 'Vecino Test', password_hash: null }] };
      }
      if (text.includes('SELECT id FROM propietarios WHERE email = $1')) {
        // Esta es la comprobación de "email ya en uso" que causaba el bug:
        // el email precargado ya está en la fila del propio propietario_id.
        const excluyeAsiMismo = text.includes('id != $2');
        if (excluyeAsiMismo && params[1] === PROPIETARIO_ID) return { rows: [] };
        return { rows: [{ id: PROPIETARIO_ID }] }; // simula la fila propia sin excluir
      }
      if (text.includes('UPDATE propietarios SET email')) {
        return { rows: [{ id: PROPIETARIO_ID, entity_id: ENTITY_ID, nombre_completo: 'Vecino Test', propiedad_detalle: '1oA' }] };
      }
      if (text.includes('FROM entities e JOIN tenants t')) {
        return { rows: [{ plan_suscripcion: 'profesional', suscripcion_estado: 'active', trial_fin: null }] };
      }
      throw new Error(`Query no esperada en el test: ${text}`);
    }
  }
});

const { default: vecinosRouter } = await import('../routes/vecinos.js');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', vecinosRouter);

const server = app.listen(0);
const baseUrl = await new Promise((resolve) => server.on('listening', () => resolve(`http://127.0.0.1:${server.address().port}`)));
after(() => server.close());

test('vecinos/registro: funciona aunque el despacho haya precargado el email del propietario al darlo de alta', async () => {
  const respuesta = await fetch(`${baseUrl}/api/vecinos/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity_id: ENTITY_ID,
      propietario_id: PROPIETARIO_ID,
      codigo_acceso: CODIGO_ACCESO,
      email: EMAIL_PRECARGADO,
      password: 'PasswordDePrueba1234'
    })
  });

  const cuerpo = await respuesta.json();
  assert.equal(respuesta.status, 201, `Se esperaba 201, la API respondió: ${JSON.stringify(cuerpo)}`);
  assert.equal(cuerpo.success, true);
});
