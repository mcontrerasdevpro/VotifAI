import test from 'node:test';
import assert from 'node:assert/strict';
import { closeCurrentPoint, openVotingForPoint } from './junta.js';

test('closeCurrentPoint closes the active point and prepares the next one', () => {
  const points = [
    { id: 1, estado: 'Votando', si: 40, no: 35, abs: 25 },
    { id: 2, estado: 'Pendiente', si: 0, no: 0, abs: 0 },
    { id: 3, estado: 'Pendiente', si: 0, no: 0, abs: 0 }
  ];

  const result = closeCurrentPoint(points, 0, { si: 70, no: 20, abs: 10 });

  assert.equal(result[0].estado, 'Cerrado');
  assert.equal(result[0].si, 70);
  assert.equal(result[1].estado, 'Debatiendo');
});

test('openVotingForPoint starts the vote on the selected point', () => {
  const points = [
    { id: 1, estado: 'Debatiendo', si: 0, no: 0, abs: 0 },
    { id: 2, estado: 'Pendiente', si: 0, no: 0, abs: 0 }
  ];

  const result = openVotingForPoint(points, 0);
  assert.equal(result[0].estado, 'Votando');
  assert.equal(result[1].estado, 'Pendiente');
});
