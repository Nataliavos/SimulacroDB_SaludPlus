import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';

const { Pool } = pg;

// Necesario para usar __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// crear pull de conexión (pool trae el paquete de conexiones por defecto)
export const pool = new Pool({
    connectionString: env.postgresUri
});

// crear tablas de la db
export async function executeSQL(){
    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN"); // Iniciar transacción

        // Leer archivo SQL local
        const sqlPath = path.join(__dirname, '../data/script_saludplus.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');


        // Ejecutar la query
        await client.query(sql);
        await client.query("COMMIT"); // Confirmar transacción

        console.log("Tables created successfully");

    } catch (error) {
        console.error("Error creating tables", error);

        if (client) {
            await client.query("ROLLBACK"); // Rollback, si falla, se devuelve y no se guarda nada
        }
        
    } finally {
        if (client) client.release(); // release libera la conexión que se había creado
    }
}