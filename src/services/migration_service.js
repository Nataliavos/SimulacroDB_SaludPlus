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
            /*
            ¿Por qué quitar la transacción?
            Porque TRUNCATE en PostgreSQL es atómico: o se ejecuta completo o falla. Además:
            TRUNCATE ... CASCADE ya es una operación “todo o nada”.
            Si haces BEGIN; TRUNCATE; COMMIT; no ganas mucho en este caso.
            Y si no manejas ROLLBACK cuando falla, dejas la transacción abierta y el cliente puede quedar en un estado feo (conexión “en transacción”, locks, etc.).
            */
            // await pool.query('BEGIN');
            await pool.query('TRUNCATE TABLE appointments, doctors, patients, specialties, treatments, insurance_providers CASCADE');
            // await pool.query('COMMIT');
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

            // Normalizamos y limpiamos los campos clave del CSV (minúsculas y trim)
            // para garantizar consistencia en comparaciones, evitar duplicados
            // y prevenir errores por espacios o valores nulos.
            const patientEmail = row.patient_email?.toLowerCase().trim();
            const doctorEmail = row.doctor_email?.toLowerCase().trim();
            const insuranceName = row.insurance_provider?.toLowerCase().trim();
            const specialtyName = row.specialty?.toLowerCase().trim();
            const treatmentCode = row.treatment_code?.trim();
            
            const appointmentId = row.appointment_id?.trim();
            const appointmentDate = row.appointment_date?.trim();

            const treatmentCost = row.treatment_cost?.trim() ? parseFloat(row.treatment_cost) : null;
            
            const amountPaid = row.amount_paid?.trim() ? parseFloat(row.amount_paid) : null;
            

            // Validación temprana: si faltan campos esenciales, omitimos la fila
            // para evitar violaciones de NOT NULL o claves foráneas.
            if (!appointmentId || !appointmentDate || !patientEmail || !doctorEmail || !insuranceName || !specialtyName || !treatmentCode ||
                treatmentCost === null || Number.isNaN(treatmentCost)) {
                console.warn("Skipping row due to missing required fields:", {
                    appointmentId: row.appointment_id,
                    appointment_date: row.appointment_date,
                    treatment_cost: row.treatment_cost,
                    patientEmail,
                    doctorEmail,
                    insuranceName,
                    specialtyName,
                    treatmentCode
                });
                continue;
            }

            // Insert patients
            if (!patientEmails.has(patientEmail)) {
                await pool.query(`INSERT INTO patients (name, email, phone, address)
                VALUES($1, $2, $3, $4)
                ON CONFLICT (email) DO NOTHING`,
                    [row.patient_name, patientEmail, row.patient_phone, row.patient_address])
                patientEmails.add(patientEmail);
            }

            // Instert specialties
            if (!specialtyNames.has(specialtyName)) {
                await pool.query(`INSERT INTO specialties (specialty)
                VALUES($1)
                ON CONFLICT (specialty) DO NOTHING`,
                    [specialtyName])
                specialtyNames.add(specialtyName);
            }

            // Insert treatments
            if (!treatmentCodes.has(treatmentCode)) {
                await pool.query(`INSERT INTO treatments (treatment_code, description, cost)
                    VALUES($1, $2, $3)
                    ON CONFLICT (treatment_code) DO NOTHING`,
                    [treatmentCode, row.treatment_description, treatmentCost])
                treatmentCodes.add(treatmentCode);
            }

            // Insert insurance providers
            if (!insuranceNames.has(insuranceName)) {

                await pool.query(`INSERT INTO insurance_providers (insurance_name, coverage_percentage)
                    VALUES($1, $2)
                    ON CONFLICT (insurance_name) DO NOTHING`,
                    [insuranceName, parseInt(row.coverage_percentage, 10)])
                insuranceNames.add(insuranceName);

            }

            // Insert doctors
            if (!doctorEmails.has(doctorEmail)) {
                // Primero obtenemos ID de la especialidad para poder insertarlo
                const specRes = await pool.query(`SELECT specialty_id FROM specialties WHERE specialty = $1`, [specialtyName]);
                const specialtyId = specRes.rows[0]?.specialty_id;

                await pool.query(`INSERT INTO doctors (doctor_name, doctor_email, specialty_id)
                    VALUES($1, $2, $3)
                    ON CONFLICT (doctor_email) DO NOTHING`,
                    [row.doctor_name, doctorEmail, specialtyId]);
                doctorEmails.add(doctorEmail);
            }

            // Insert appointments

            // Obtener los id referenciados para las FK
            const patRes = await pool.query(`SELECT patient_id FROM patients WHERE email = $1`, [patientEmail]);
            const docRes = await pool.query(`SELECT doctor_id FROM doctors  WHERE doctor_email = $1`, [doctorEmail]);
            const insRes = await pool.query(`SELECT insurance_id FROM insurance_providers WHERE insurance_name = $1`, [insuranceName]);

            const patientId = patRes.rows[0]?.patient_id;
            const doctorId = docRes.rows[0]?.doctor_id;
            const insuranceId = insRes.rows[0]?.insurance_id;

            if (!patientId || !doctorId || !insuranceId) {
                console.warn("Skipping appointment due to missing FK:", {
                    appointment_id: row.appointment_id,
                    patientId,
                    doctorId,
                    insuranceId,
                    treatmentCode: treatmentCode
                });
                continue;
            }

            await pool.query(`INSERT INTO appointments (appointment_id, date, patient_id, doctor_id, treatment_code, insurance_id, amount_paid)
                VALUES($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (appointment_id) DO NOTHING`,
                [
                    appointmentId,
                    appointmentDate,
                    patientId,
                    doctorId,
                    treatmentCode,
                    insuranceId,
                    amountPaid
                ]);
        }


    } catch (error) {
        console.error("Error during migration:", error);
    }
}