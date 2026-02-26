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
        if (clearBefore) {
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
        const specialtyNames = new Set();

        for (const row of rows) {
            console.log(`Processing row: ${JSON.stringify(row)}`);
            // Insert patients
            if (!patientEmails.has(row.patient_email)) {
                await pool.query(`INSERT INTO patients (name, email, phone, address)
                VALUES($1, $2, $3, $4)`,
                    [row.patient_name, row.patient_email, row.patient_phone, row.patient_address])
                patientEmails.add(row.patient_email);
            }

            // Instert specialties
            if (!specialtyNames.has(row.specialty)) {
                await pool.query(`INSERT INTO specialties (specialty)
                VALUES($1)`,
                    [row.specialty])
                specialtyNames.add(row.specialty);
            }

            // Insert doctors
            if (!doctorEmails.has(row.doctor_email)) {
                await pool.query(`INSERT INTO doctors (name, email, specialty)
                    VALUES($1, $2, $3)`,
                    [row.doctor_name, row.doctor_email, row.specialty_id])
                doctorEmails.add(row.doctor_email);
            }

            // Insert treatments
            if (!treatmentCodes.has(row.treatment_code)) {
                await pool.query(`INSERT INTO treatments (code, description, cost)
                    VALUES($1, $2, $3)`,
                    [row.treatment_code, row.treatment_description, row.treatment_cost])
                treatmentCodes.add(row.treatment_code);
            }

            // Insert insurance providers
            if (!insuranceNames.has(row.insurance_name)) {
                await pool.query(`INSERT INTO insurance_providers (insuranceProvider, coveragePercentage)
                    VALUES($1, $2)`,
                    [row.insurance_provider, row.coverage_percentage])
                insuranceNames.add(row.insurance_provider);

            // Insert appointments
            await pool.query(`INSERT INTO appointments (appointmentId, date, patient, doctor, treatment, insurance, amountPaid)
                VALUES($1, $2, $3, $4, $5, $6, $7)`,
                [row.appointment_id, row.appointment_date, row.patient_id, row.doctor_id, row.treatment_code, row.insurance_id, row.amount_paid])
        }


    } catch (error) {
        console.error("Error during migration:", error);
    }
}