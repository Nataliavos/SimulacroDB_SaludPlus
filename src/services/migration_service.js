import { readFile } from "fs/promises"; // para leer el csv y pasarlo a un formato entendible
import { pool } from "../config/postgres.js";
import { parse } from "csv-parse/sync"; // para parsear el csv a un formato entendible
import { resolve } from "path";
import { env } from "../config/env.js";

export async function migrate(clearBefore = false) {
    try {
        let csvString = await readFile(resolve(env.fileDataCsv), "utf-8"); // fileDataCsv es la ruta del csv, está en env.js
        
        // parseamos el csv a un formato entendible, rows es un array de arrays, cada array interno es una fila del csv
        const rows = parse(csvString, {
            columns: true,
            trim: true,
            skip_empty_lines: true
        }); 

        console.log(`Read ${rows.length} rows from CSV file`);

        // -- Clear existing data if requested (vaciar todas las tablas)
        if(clearBefore){
            pool.query('BEGIN');
            pool.query('TRUNCATE TABLE appointments, doctors, patients, specialities, treatments, insurance_providers, CASCADE');
            pool.query('COMMIT');
            console.log('Previous data cleared succesfully');
        }

        // Insert uniques entities in PostgreSQL
        const patientEmails = new Set();
        const doctorEmails = new Set();
        const treatmentCodes = new Set();
        const insuranceNames = new Set();
        const specialityNames = new Set();



        

        
    } catch (error) {
        console.error("Error during migration:", error);
    }
}