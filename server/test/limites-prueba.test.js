import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// Prueba gratuita: máximo 2 juntas iniciadas y voz solo en las 3 primeras
// horas de una junta en curso. Con suscripción pagada no hay límites de
// tiempo, pero la voz siempre exige junta en curso y queda ligada a ella
// (y al punto abierto), para que panel y acta muestren solo las suyas.

let estadoTenant;
let juntasIniciadas;
let iniciadaEn;
let puntoAbierto;

mock.module('../db.js', {
  namedExports: {
    query: async (text) => {
      if (text.startsWith('SELECT suscripcion_estado, juntas_iniciadas FROM tenants')) return { rows: [{ suscripcion_estado: estadoTenant, juntas_iniciadas: juntasIniciadas }] };
      if (text.startsWith('UPDATE tenants SET juntas_iniciadas = juntas_iniciadas + 1')) { juntasIniciadas += 1; return { rows: [], rowCount: 1 }; }
      if (text.includes('SELECT t.suscripcion_estado FROM entities e JOIN tenants t')) return { rows: [{ suscripcion_estado: estadoTenant }] };
      if (text.includes("m.estado = 'en_curso'")) return { rows: iniciadaEn ? [{ id: 'junta-1', iniciada_en: iniciadaEn, punto_id: puntoAbierto }] : [] };
      throw new Error(`Query no esperada en el test: ${text}`);
    }
  }
});

const { query } = await import('../db.js');
const { reservarJuntaIniciada, juntaParaVoz } = await import('../lib/suscripciones.js');
const haceHoras = (h) => new Date(Date.now() - h * 3600 * 1000);

test('en prueba se pueden iniciar 2 juntas y la tercera da 402 sin sumar', async () => {
  estadoTenant = 'trialing';
  juntasIniciadas = 0;
  assert.equal((await reservarJuntaIniciada('t', query)).ok, true);
  assert.equal((await reservarJuntaIniciada('t', query)).ok, true);
  assert.equal(juntasIniciadas, 2);
  const tercera = await reservarJuntaIniciada('t', query);
  assert.equal(tercera.ok, false);
  assert.equal(tercera.status, 402);
  assert.equal(juntasIniciadas, 2);
});

test('con suscripción pagada no hay límite de juntas, pero se siguen contando', async () => {
  estadoTenant = 'active';
  juntasIniciadas = 50;
  assert.equal((await reservarJuntaIniciada('t', query)).ok, true);
  assert.equal(juntasIniciadas, 51);
});

test('sin junta en curso no se graba, en ningún plan', async () => {
  for (const estado of ['trialing', 'active']) {
    estadoTenant = estado;
    iniciadaEn = null;
    const resultado = await juntaParaVoz('e');
    assert.equal(resultado.ok, false);
    assert.equal(resultado.codigo, 'SIN_JUNTA_EN_CURSO');
  }
});

test('la voz queda ligada a la junta en curso y al punto abierto', async () => {
  estadoTenant = 'active';
  iniciadaEn = haceHoras(1);
  puntoAbierto = 'punto-3';
  assert.deepEqual(await juntaParaVoz('e'), { ok: true, meetingId: 'junta-1', puntoId: 'punto-3' });
  puntoAbierto = null;
  assert.deepEqual(await juntaParaVoz('e'), { ok: true, meetingId: 'junta-1', puntoId: null });
});

test('en prueba la voz se corta pasadas 3 horas de junta', async () => {
  estadoTenant = 'trialing';
  iniciadaEn = haceHoras(2.9);
  assert.equal((await juntaParaVoz('e')).ok, true);
  iniciadaEn = haceHoras(3.1);
  const pasada = await juntaParaVoz('e');
  assert.equal(pasada.ok, false);
  assert.equal(pasada.codigo, 'VOZ_LIMITE_PRUEBA');
});

test('con suscripción pagada la voz no tiene límite de tiempo', async () => {
  estadoTenant = 'past_due';
  iniciadaEn = haceHoras(10);
  assert.equal((await juntaParaVoz('e')).ok, true);
});
