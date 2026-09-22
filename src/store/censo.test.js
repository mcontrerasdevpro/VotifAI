import test from 'node:test';
import assert from 'node:assert/strict';
import { getParticipantesActivos, getCoeficienteTotal } from './censo.js';

test('getCoeficienteTotal suma los coeficientes de todo el censo, no solo el último', () => {
  const censo = [{ coeficiente: 25 }, { coeficiente: 30 }, { coeficiente: 12.5 }];
  assert.equal(getCoeficienteTotal(censo), 67.5);
});

test('getCoeficienteTotal ignora valores no numéricos sin romper la suma', () => {
  const censo = [{ coeficiente: 25 }, { coeficiente: 'no-es-un-numero' }, { coeficiente: 10 }];
  assert.equal(getCoeficienteTotal(censo), 35);
});

test('getCoeficienteTotal devuelve 0 con censo vacío o no-array', () => {
  assert.equal(getCoeficienteTotal([]), 0);
  assert.equal(getCoeficienteTotal(undefined), 0);
});

test('getParticipantesActivos cuenta las entradas verdaderas del censo', () => {
  assert.equal(getParticipantesActivos([{ id: 1 }, { id: 2 }, null, { id: 3 }]), 3);
  assert.equal(getParticipantesActivos([]), 0);
});
