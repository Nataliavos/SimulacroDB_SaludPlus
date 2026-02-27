import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { pool } from '../config/postgres.js';

/**
 * Ejecuta el script SQL que crea la estructura de la base de datos.
 * Es idempotente: puede ejecutarse varias veces sin romperse.
 */
export async function ensureSchema() {
    try {
        const sqlPath = resolve('data', "script_saludplus.sql");
        const sql = await readFile(sqlPath, "utf-8");

        await pool.query(sql);

        console.log("Database schema ensured successfully");

    } catch (error) {
        console.error("Error ensuring shema:", error);
        throw error; // importante: propagamos error si falla
    }
}
