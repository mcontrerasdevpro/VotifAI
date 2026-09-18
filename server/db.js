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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

export const query = (text, params) => pool.query(text, params);
export { pool };