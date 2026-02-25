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

        console.log(rows);
        
    } catch (error) {
        console.error("Error during migration:", error);
    }
}