import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularEjecucion, estadoFondo } from '../lib/presupuestos.js';

test('ejecución: cada gasto va a su partida por categoría, sin distinguir mayúsculas', () => {
  const r = calcularEjecucion(
    [{ nombre: 'Limpieza', importe_previsto: '1200' }, { nombre: 'Ascensor', importe_previsto: '800' }],
    [{ categoria: 'limpieza ', total: '1300' }, { categoria: 'Ascensor', total: '600' }]
  );
  assert.deepEqual(r.partidas, [
    { nombre: 'Limpieza', previsto: 1200, gastado: 1300, desviacion: 100, porcentaje: 108.3 },
    { nombre: 'Ascensor', previsto: 800, gastado: 600, desviacion: -200, porcentaje: 75 }
  ]);
  assert.deepEqual(r.totales, { previsto: 2000, gastado: 1900, desviacion: -100, porcentaje: 95 });
});

test('ejecución: los gastos que no encajan en ninguna partida quedan aparte y cuentan en el total', () => {
  const r = calcularEjecucion([{ nombre: 'Seguro', importe_previsto: 500 }], [{ categoria: 'Seguro', total: 500 }, { categoria: 'Pintura portal', total: 350 }, { categoria: null, total: 20 }]);
  assert.deepEqual(r.sinPartida.map((s) => s.gastado).sort((a, b) => a - b), [20, 350]);
  assert.equal(r.totales.gastado, 870);
  assert.equal(r.partidas[0].desviacion, 0);
});

test('fondo de reserva: mínimo del 10 % del último presupuesto ordinario (art. 9.1.f LPH)', () => {
  const presupuesto = { id: 'p', nombre: 'Ordinario 2027', anio: 2027, importe_previsto: '24000' };
  assert.deepEqual(
    { ...estadoFondo(1800, presupuesto), presupuestoReferencia: undefined },
    { saldo: 1800, minimo: 2400, cumple: false, falta: 600, presupuestoReferencia: undefined }
  );
  assert.equal(estadoFondo(2400, presupuesto).cumple, true);
  assert.equal(estadoFondo(3000, presupuesto).falta, 0);
});

test('fondo de reserva sin presupuesto ordinario: no se puede calcular el mínimo', () => {
  const e = estadoFondo(500, null);
  assert.equal(e.minimo, null);
  assert.equal(e.cumple, null);
});
