import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// withTransaction tiene que mandar BEGIN, todas las sentencias y
// COMMIT/ROLLBACK por la MISMA conexión y devolverla al pool siempre. Antes
// se hacía query('BEGIN') sobre el pool, y cada sentencia podía salir por
// una conexión distinta: el ROLLBACK no deshacía nada.

const clientes = [];
class FakePool {
  async connect() {
    const cliente = { sentencias: [], liberado: false };
    cliente.query = async (text) => {
      cliente.sentencias.push(text);
      if (text === 'FALLA') throw new Error('fallo simulado');
      return { rows: [], rowCount: 1 };
    };
    cliente.release = () => { cliente.liberado = true; };
    clientes.push(cliente);
    return cliente;
  }
  query() { throw new Error('una transacción no debe usar pool.query'); }
}

mock.module('pg', { defaultExport: { Pool: FakePool, types: { setTypeParser() {} } } });
const { withTransaction } = await import('../db.js');

test('todo va por la misma conexión y termina en COMMIT', async () => {
  const resultado = await withTransaction(async (tx) => {
    await tx('UNO');
    await tx('DOS');
    return { ok: true };
  });
  const cliente = clientes.at(-1);
  assert.deepEqual(resultado, { ok: true });
  assert.deepEqual(cliente.sentencias, ['BEGIN', 'UNO', 'DOS', 'COMMIT']);
  assert.equal(cliente.liberado, true);
});

test('devolver { rollback: true } deshace en vez de confirmar', async () => {
  const resultado = await withTransaction(async (tx) => {
    await tx('UNO');
    return { rollback: true };
  });
  assert.equal(resultado.rollback, true);
  assert.deepEqual(clientes.at(-1).sentencias, ['BEGIN', 'UNO', 'ROLLBACK']);
  assert.equal(clientes.at(-1).liberado, true);
});

test('un error a mitad hace ROLLBACK, libera la conexión y se propaga', async () => {
  await assert.rejects(
    withTransaction(async (tx) => {
      await tx('UNO');
      await tx('FALLA');
      await tx('NUNCA');
    }),
    /fallo simulado/
  );
  assert.deepEqual(clientes.at(-1).sentencias, ['BEGIN', 'UNO', 'FALLA', 'ROLLBACK']);
  assert.equal(clientes.at(-1).liberado, true);
});
