import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularResultado } from '../lib/mayorias.js';

// Finca de 10 viviendas al 10 % cada una (coeficiente total 100).
const censo = { propietarios: 10, coeficiente: 100 };
const sinPrivados = { propietarios: 0, coeficiente: 0 };
const votos = (si, no = 0, abstencion = 0, coef = 10) => ({ si, no, abstencion, coefSi: si * coef, coefNo: no * coef, coefAbs: abstencion * coef });
const calc = (mayoria, convocatoria, v, privados = sinPrivados) => calcularResultado({ mayoria, convocatoria, censo, privados, votos: v });

test('antes: 3 SÍ contra 1 NO salía "aprobado"; en 1ª convocatoria no llega a la mayoría del total', () => {
  // Solo votan 4 de 10: 3 a favor no es más de la mitad del total (5).
  // Los 6 ausentes podrían completarla (17.8) -> pendiente, no aprobado.
  assert.equal(calc('simple', 'primera', votos(3, 1)).estado, 'pendiente_ausentes');
});

test('simple 1ª: 6 de 10 a favor es aprobado; exactamente la mitad no', () => {
  assert.equal(calc('simple', 'primera', votos(6, 4)).estado, 'aprobado');
  assert.equal(calc('simple', 'primera', votos(5, 5)).estado, 'rechazado');
});

test('doble mayoría: más cabezas a favor pero menos cuotas no aprueba', () => {
  // 6 viviendas pequeñas (5 % cada una) a favor = 30 %; 4 grandes en contra = 70 %.
  const v = { si: 6, no: 4, abstencion: 0, coefSi: 30, coefNo: 70, coefAbs: 0 };
  assert.equal(calc('simple', 'primera', v).estado, 'rechazado');
  assert.equal(calc('simple', 'segunda', v).estado, 'rechazado');
});

test('simple 2ª: se computa sobre los asistentes, no sobre el total', () => {
  assert.equal(calc('simple', 'segunda', votos(3, 1)).estado, 'aprobado');
  // Las abstenciones cuentan como asistentes: 2 SÍ de 4 asistentes no es más de la mitad.
  assert.equal(calc('simple', 'segunda', votos(2, 1, 1)).estado, 'rechazado');
});

test('tres quintos: 6 de 10 aprueba, 5 de 10 con los demás en contra no', () => {
  assert.equal(calc('tres_quintos', 'primera', votos(6, 4)).estado, 'aprobado');
  assert.equal(calc('tres_quintos', 'segunda', votos(5, 5)).estado, 'rechazado');
});

test('un tercio: 4 de 10 aprueba; 3 de 10 sin ausentes que lo completen no', () => {
  assert.equal(calc('un_tercio', 'primera', votos(4, 6)).estado, 'aprobado');
  assert.equal(calc('un_tercio', 'primera', votos(3, 7)).estado, 'rechazado');
});

test('unanimidad: un solo NO la rompe; si faltan ausentes queda pendiente', () => {
  assert.equal(calc('unanimidad', 'primera', votos(9, 1)).estado, 'rechazado');
  assert.equal(calc('unanimidad', 'primera', votos(10)).estado, 'aprobado');
  assert.equal(calc('unanimidad', 'primera', votos(8)).estado, 'pendiente_ausentes');
  assert.equal(calc('unanimidad', 'primera', votos(9, 0, 1)).estado, 'rechazado');
});

test('los privados de voto (art. 15.2) no cuentan en cabezas ni en cuotas', () => {
  // 2 morosos fuera: la base es 8 viviendas / 80 %. 5 a favor = más de la mitad de 8.
  const privados = { propietarios: 2, coeficiente: 20 };
  const resultado = calc('simple', 'primera', votos(5, 3), privados);
  assert.equal(resultado.estado, 'aprobado');
  assert.deepEqual(resultado.baseComputo, { propietarios: 8, coeficiente: 80 });
  // Sin descontarlos, 5 de 10 no bastaría.
  assert.equal(calc('simple', 'primera', votos(5, 5)).estado, 'rechazado');
});

test('tipo de mayoría desconocido se trata como simple', () => {
  assert.equal(calc('inventada', 'primera', votos(6, 4)).mayoria, 'simple');
});
