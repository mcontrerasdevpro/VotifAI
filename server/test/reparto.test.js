import test from 'node:test';
import assert from 'node:assert/strict';
import { repartirImporte, generarPeriodos } from '../lib/reparto.js';

const suma = (repartos) => Math.round(repartos.reduce((t, r) => t + r.importe * 100, 0)) / 100;

test('reparto por coeficiente proporcional', () => {
  const r = repartirImporte(1000, [{ id: 'a', coeficiente: 50 }, { id: 'b', coeficiente: 30 }, { id: 'c', coeficiente: 20 }]);
  assert.deepEqual(r.map((x) => x.importe), [500, 300, 200]);
});

test('el reparto cuadra al céntimo con el total aunque haya decimales', () => {
  // 100 € entre 3 coeficientes iguales = 33,33 + 33,33 + 33,34
  const r = repartirImporte(100, [{ id: 'a', coeficiente: 1 }, { id: 'b', coeficiente: 1 }, { id: 'c', coeficiente: 1 }]);
  assert.equal(suma(r), 100);
  assert.deepEqual(r.map((x) => x.importe).sort(), [33.33, 33.33, 33.34]);

  // Coeficientes reales con 4 decimales que no suman 100.
  const censo = [7.1234, 12.5, 3.3333, 18.0421, 9.9999, 14.25].map((c, i) => ({ id: `p${i}`, coeficiente: c }));
  for (const total of [1234.56, 0.07, 99999.99, 12000]) {
    assert.equal(suma(repartirImporte(total, censo)), total);
  }
});

test('a partes iguales ignora el coeficiente', () => {
  const r = repartirImporte(90, [{ id: 'a', coeficiente: 80 }, { id: 'b', coeficiente: 10 }, { id: 'c', coeficiente: 10 }], 'partes_iguales');
  assert.deepEqual(r.map((x) => x.importe), [30, 30, 30]);
});

test('sin importe, sin propietarios o con coeficientes a cero no reparte', () => {
  assert.deepEqual(repartirImporte(0, [{ id: 'a', coeficiente: 1 }]), []);
  assert.deepEqual(repartirImporte(100, []), []);
  assert.deepEqual(repartirImporte(100, [{ id: 'a', coeficiente: 0 }]), []);
});

test('periodos mensuales y trimestrales con su nombre y vencimiento', () => {
  assert.deepEqual(generarPeriodos({ frecuencia: 'mensual', numero: 3, primerVencimiento: '2027-01-10' }), [
    { fecha_vencimiento: '2027-01-10', periodo: 'Enero 2027' },
    { fecha_vencimiento: '2027-02-10', periodo: 'Febrero 2027' },
    { fecha_vencimiento: '2027-03-10', periodo: 'Marzo 2027' }
  ]);
  assert.deepEqual(generarPeriodos({ frecuencia: 'trimestral', numero: 4, primerVencimiento: '2027-01-05' }).map((p) => p.periodo), ['T1 2027', 'T2 2027', 'T3 2027', 'T4 2027']);
});

test('un vencimiento a día 31 cae en el último día de los meses cortos', () => {
  const p = generarPeriodos({ frecuencia: 'mensual', numero: 3, primerVencimiento: '2027-01-31' });
  assert.deepEqual(p.map((x) => x.fecha_vencimiento), ['2027-01-31', '2027-02-28', '2027-03-31']);
});
