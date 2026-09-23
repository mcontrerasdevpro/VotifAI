import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// Prueba gratuita: máximo 2 juntas iniciadas y voz solo en las 3 primeras
// horas de una junta en curso. Con suscripción pagada no hay límites.

let estadoTenant;
let juntasIniciadas;
let iniciadaEn;

mock.module('../db.js', {
  namedExports: {
    query: async (text) => {
      if (text.startsWith('SELECT suscripcion_estado FROM tenants')) return { rows: [{ suscripcion_estado: estadoTenant }] };
      if (text.includes('SELECT t.suscripcion_estado FROM entities e JOIN tenants t')) return { rows: [{ suscripcion_estado: estadoTenant }] };
      if (text.includes('m.iniciada_en IS NOT NULL')) return { rows: [{ total: juntasIniciadas }] };
      if (text.includes("estado = 'en_curso' ORDER BY iniciada_en")) return { rows: iniciadaEn ? [{ iniciada_en: iniciadaEn }] : [] };
      throw new Error(`Query no esperada en el test: ${text}`);
    }
  }
});

const { exigirJuntaDisponibleEnPrueba, motivoSinVozEnPrueba } = await import('../lib/suscripciones.js');
const haceHoras = (h) => new Date(Date.now() - h * 3600 * 1000);

test('en prueba se pueden iniciar 2 juntas y la tercera da 402', async () => {
  estadoTenant = 'trialing';
  juntasIniciadas = 1;
  assert.equal((await exigirJuntaDisponibleEnPrueba('t')).ok, true);
  juntasIniciadas = 2;
  const tercera = await exigirJuntaDisponibleEnPrueba('t');
  assert.equal(tercera.ok, false);
  assert.equal(tercera.status, 402);
});

test('con suscripción pagada no hay límite de juntas', async () => {
  estadoTenant = 'active';
  juntasIniciadas = 50;
  assert.equal((await exigirJuntaDisponibleEnPrueba('t')).ok, true);
});

test('en prueba la voz exige junta en curso y se corta pasadas 3 horas', async () => {
  estadoTenant = 'trialing';
  iniciadaEn = null;
  assert.match(await motivoSinVozEnPrueba('e'), /junta en curso/);
  iniciadaEn = haceHoras(1);
  assert.equal(await motivoSinVozEnPrueba('e'), null);
  iniciadaEn = haceHoras(3.1);
  assert.match(await motivoSinVozEnPrueba('e'), /3 primeras horas/);
});

test('con suscripción pagada la voz no tiene límite de tiempo', async () => {
  estadoTenant = 'past_due';
  iniciadaEn = haceHoras(10);
  assert.equal(await motivoSinVozEnPrueba('e'), null);
});
