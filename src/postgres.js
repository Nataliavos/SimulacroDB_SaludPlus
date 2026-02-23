import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// crear pull de conexión (pool trae el paquete de conexiones por defecto)
const pool = new Pool({
    connectionString: env.postgresUri
});

// crear tablas de la db
async function createTable(){
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        await client.query("script para crear tablas")
        
    } catch (error) {
        console.error("Error creating tables", error);
        await client.query("ROLLBACK"); // Rollback, si falla, se devuelve y no se guarda nada
    } finally {
        client.release(); // release libera la conexión que se había creado

    }
}
