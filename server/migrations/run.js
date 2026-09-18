import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool } from '../db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  // Usamos un único cliente dedicado (no pool.query) para que BEGIN/COMMIT
  // se ejecuten realmente en la misma conexión y la transacción sea atómica.
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nombre_archivo VARCHAR(255) PRIMARY KEY,
        aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const aplicadasResultado = await client.query('SELECT nombre_archivo FROM schema_migrations');
    const aplicadas = new Set(aplicadasResultado.rows.map(r => r.nombre_archivo));

    const archivos = fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let ejecutadas = 0;

    for (const archivo of archivos) {
      if (aplicadas.has(archivo)) {
        console.log(`⏭️  Ya aplicada, se omite: ${archivo}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(__dirname, archivo), 'utf8');
      console.log(`▶️  Aplicando: ${archivo}`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nombre_archivo) VALUES ($1)', [archivo]);
        await client.query('COMMIT');
        console.log(`✅ Aplicada: ${archivo}`);
        ejecutadas++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Fallo al aplicar ${archivo}:`, err.message);
        process.exit(1);
      }
    }

    const totalResultado = await client.query('SELECT COUNT(*) FROM schema_migrations');
    console.log(`\nMigraciones ejecutadas en esta pasada: ${ejecutadas}. Total registradas: ${totalResultado.rows[0].count}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
