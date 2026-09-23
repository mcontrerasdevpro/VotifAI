import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool, types } = pkg;

// El parser por defecto de pg convierte las columnas DATE a un objeto Date
// en medianoche LOCAL del proceso Node; al serializarlo a JSON (que usa
// toISOString, siempre en UTC) el valor se desplaza un día hacia atrás en
// cualquier huso horario positivo (España incluida). Devolvemos el texto
// tal cual ('YYYY-MM-DD', OID 1082) para eliminar esa ambigüedad en
// cualquier consulta que use una columna DATE (agenda, cuotas, reservas...).
types.setTypeParser(1082, (val) => val);

const databaseSsl = process.env.DATABASE_SSL === 'false'
  ? false
  : {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
      ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA } : {})
    };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: databaseSsl
});

export const query = (text, params) => pool.query(text, params);
export { pool };

// Una transacción tiene que ir entera por la misma conexión: con
// query('BEGIN') sobre el pool, cada sentencia puede salir por una conexión
// distinta, así que el ROLLBACK no deshace nada y el BEGIN deja una conexión
// "colgada" dentro de una transacción abierta que luego reutiliza otra
// petición cualquiera.
//
// `fn` recibe un `tx(text, params)` con la misma forma que `query`. Para
// abortar sin error (p. ej. una validación que falla a mitad), `fn` devuelve
// un objeto con `rollback: true` y se hace ROLLBACK en vez de COMMIT; lo
// que devuelva `fn` se devuelve tal cual en ambos casos.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn((text, params) => client.query(text, params));
    await client.query(resultado?.rollback ? 'ROLLBACK' : 'COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}