# Guía Paso a Paso: Replicar SaludPlusSim

Sigue estos pasos en orden. Al final tendrás el proyecto funcionando en un nuevo directorio.

---

## Paso 1 — Crear la estructura de carpetas

Abre una terminal y ejecuta:

```bash
mkdir mi-saludplus-api
cd mi-saludplus-api
mkdir -p saludplus-api/src/config
mkdir -p saludplus-api/src/routes
mkdir -p saludplus-api/src/services
mkdir -p saludplus-api/scripts
mkdir -p saludplus-api/data
```

---

## Paso 2 — Copiar el archivo CSV de datos

Copia el CSV de datos (el mismo que está en el proyecto original):

```bash
cp /home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/data/simulacro_saludplus_data.csv \
   saludplus-api/data/
```

---

## Paso 3 — Inicializar el proyecto Node.js e instalar dependencias

```bash
cd saludplus-api
npm init -y
npm install express pg mongoose dotenv csv-parse
```

---

## Paso 4 — Crear el archivo [package.json](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/package.json) con los scripts

Reemplaza el contenido del [package.json](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/package.json) que se generó con esto:

```json
{
  "name": "saludplus-api",
  "version": "1.0.0",
  "description": "SaludPlus hybrid persistence API — PostgreSQL + MongoDB",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "migrate": "node scripts/run-migration.js"
  },
  "dependencies": {
    "csv-parse": "^5.5.6",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "mongoose": "^8.4.1",
    "pg": "^8.12.0"
  }
}
```

---

## Paso 5 — Crear el archivo [.env](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/.env)

Crea el archivo [.env](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/.env) dentro de `saludplus-api/`:

```bash
touch .env
```

Pega este contenido y ajusta los valores a tu configuración local:

```
# Puerto donde escuchará el servidor
PORT=3000

# Cadena de conexión a PostgreSQL
# Formato: postgresql://usuario:contraseña@host:puerto/nombre_base_de_datos
DATABASE_URL=postgresql://postgres:password@localhost:5432/saludplus

# URI de conexión a MongoDB
MONGODB_URI=mongodb://localhost:27017

# Nombre de la base de datos en MongoDB
MONGODB_DB=saludplus

# Ruta al archivo CSV de datos
SIMULACRO_CSV_PATH=./data/simulacro_saludplus_data.csv
```

> **Importante:** Reemplaza `password` con tu contraseña real de PostgreSQL y `postgres` con tu usuario real.

---

## Paso 6 — Crear el [.gitignore](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/.gitignore)

```bash
touch .gitignore
```

Contenido:

```
node_modules/
.env
```

---

## Paso 7 — Crear [src/config/env.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/src/config/env.js)

```javascript
/**
 * src/config/env.js
 * 
 * Carga y valida las variables de entorno desde el archivo .env.
 * Si falta alguna variable obligatoria, el servidor falla rápido con un mensaje claro.
 */
const dotenv = require('dotenv');
const path = require('path');

// Usamos __dirname para construir la ruta absoluta al .env
// Esto garantiza que funcione sin importar desde qué directorio se ejecute el proceso
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Variables obligatorias que deben existir
const required = ['DATABASE_URL', 'MONGODB_URI', 'MONGODB_DB'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`❌ Falta la variable de entorno: ${key}. Revisa tu archivo .env`);
  }
}

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  mongodbUri: process.env.MONGODB_URI,
  mongodbDb: process.env.MONGODB_DB,
  csvPath: process.env.SIMULACRO_CSV_PATH || './data/simulacro_saludplus_data.csv',
};
```

---

## Paso 8 — Crear [src/config/postgres.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/src/config/postgres.js)

```javascript
/**
 * src/config/postgres.js
 *
 * Configura la conexión a PostgreSQL y crea las tablas al iniciar el servidor.
 * 
 * Por qué PostgreSQL para estos datos:
 *  - Datos maestros (pacientes, médicos) requieren unicidad garantizada (UNIQUE constraint)
 *  - Las citas deben referenciar pacientes y médicos existentes (integridad referencial con FK)
 *  - El reporte de recaudación usa agregaciones (SUM, GROUP BY) que SQL maneja eficientemente
 */
const { Pool } = require('pg');
const env = require('./env');

// Pool de conexiones: reutiliza conexiones en lugar de abrir una nueva por request
const pool = new Pool({ connectionString: env.databaseUrl });

/**
 * Crea todas las tablas si aún no existen.
 * El uso de IF NOT EXISTS hace que este script sea IDEMPOTENTE:
 * puedes ejecutarlo múltiples veces sin errores ni datos duplicados.
 */
async function createTables() {
    // Usamos un cliente dedicado para ejecutar todo en la misma conexión
    const client = await pool.connect();
    try {
        // Ejecuta todas las creaciones dentro de una transacción
        // Si una falla, se revierten todas (atomicidad)
        await client.query('BEGIN');

        // ── Tabla: patients (pacientes) ──────────────────────────────────────────
        // email es UNIQUE: garantiza que no haya dos pacientes con el mismo email
        await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id      SERIAL PRIMARY KEY,
        name    VARCHAR(255) NOT NULL,
        email   VARCHAR(255) UNIQUE NOT NULL,  -- clave natural de identidad
        phone   VARCHAR(50),
        address TEXT
      )
    `);

        // ── Tabla: doctors (médicos) ─────────────────────────────────────────────
        await client.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id        SERIAL PRIMARY KEY,
        name      VARCHAR(255) NOT NULL,
        email     VARCHAR(255) UNIQUE NOT NULL,
        specialty VARCHAR(255) NOT NULL
      )
    `);

        // ── Tabla: insurances (seguros médicos) ──────────────────────────────────
        await client.query(`
      CREATE TABLE IF NOT EXISTS insurances (
        id                  SERIAL PRIMARY KEY,
        name                VARCHAR(255) UNIQUE NOT NULL,
        coverage_percentage INTEGER NOT NULL  -- porcentaje de cobertura (0-100)
      )
    `);

        // ── Tabla: appointments (citas médicas) ──────────────────────────────────
        // Cada cita referencia a un paciente, un médico y un seguro.
        // ON DELETE RESTRICT evita borrar un paciente si tiene citas asociadas.
        await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id                    SERIAL PRIMARY KEY,
        appointment_id        VARCHAR(50) UNIQUE NOT NULL,  -- ej: APT-1001
        appointment_date      DATE NOT NULL,
        patient_id            INTEGER NOT NULL REFERENCES patients(id)   ON DELETE RESTRICT,
        doctor_id             INTEGER NOT NULL REFERENCES doctors(id)    ON DELETE RESTRICT,
        treatment_code        VARCHAR(50),
        treatment_description TEXT,
        treatment_cost        NUMERIC(12, 2) NOT NULL,
        insurance_id          INTEGER NOT NULL REFERENCES insurances(id) ON DELETE RESTRICT,
        amount_paid           NUMERIC(12, 2) NOT NULL
      )
    `);

        // ── Índices para búsquedas frecuentes ────────────────────────────────────
        await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_patient_id  ON appointments(patient_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_insurance_id ON appointments(insurance_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_date         ON appointments(appointment_date)`);

        await client.query('COMMIT');
        console.log('✅ Tablas PostgreSQL listas');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        // Siempre libera el cliente al pool, incluso si hubo un error
        client.release();
    }
}

module.exports = { pool, createTables };
```

---

## Paso 9 — Crear [src/config/mongodb.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/src/config/mongodb.js)

```javascript
/**
 * src/config/mongodb.js
 *
 * Configura la conexión a MongoDB usando Mongoose.
 * 
 * Por qué MongoDB para el historial de pacientes:
 *  - Un documento contiene TODA la información del paciente y sus citas (embedding)
 *  - No necesitamos JOINs: una sola consulta devuelve todo el historial
 *  - Ideal para lecturas frecuentes con estructura semi-flexible
 */
const mongoose = require('mongoose');
const env = require('./env');

/**
 * Schema de Mongoose para el historial de un paciente.
 * 
 * Decisión de diseño: EMBEDDING (incrustar) vs REFERENCING (referenciar)
 * 
 * ✅ Elegimos EMBEDDING para las citas dentro del historial porque:
 *  - Siempre consultamos todas las citas de un paciente juntas
 *  - Evita JOINs costosos (en Mongo se llaman $lookup)
 *  - Una sola consulta por email trae todo el historial
 * 
 * ⚠️  Tradeoff: si actualizamos datos del médico, debemos actualizar
 *     también los documentos del historial (propagación manual)
 */
const appointmentSchema = new mongoose.Schema({
    appointmentId: { type: String, required: true },
    date: { type: String, required: true },
    doctorName: { type: String, required: true },
    doctorEmail: { type: String, required: true },
    specialty: { type: String, required: true },
    treatmentCode: { type: String },
    treatmentDescription: { type: String },
    treatmentCost: { type: Number, required: true },
    insuranceProvider: { type: String, required: true },
    coveragePercentage: { type: Number, required: true },
    amountPaid: { type: Number, required: true },
}, { _id: false }); // _id: false porque la cita no necesita su propio ID en Mongo

const patientHistorySchema = new mongoose.Schema({
    patientEmail: { type: String, required: true, unique: true, index: true },
    patientName: { type: String, required: true },
    appointments: { type: [appointmentSchema], default: [] },
}, { timestamps: true }); // timestamps agrega createdAt y updatedAt automáticamente

// El modelo representa la colección "patient_histories" en MongoDB
const PatientHistory = mongoose.model('PatientHistory', patientHistorySchema);

/**
 * Conecta a MongoDB. Se llama una sola vez al arrancar el servidor.
 */
async function connectMongo() {
    const uri = `${env.mongodbUri}/${env.mongodbDb}`;
    await mongoose.connect(uri);
    console.log('✅ MongoDB conectado');
}

module.exports = { connectMongo, PatientHistory };
```

---

## Paso 10 — Crear [src/app.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/src/app.js)

```javascript
/**
 * src/app.js
 *
 * Configura Express: middlewares y montaje de rutas.
 * Separamos la configuración del servidor (server.js) de la app (app.js)
 * para facilitar pruebas unitarias.
 */
const express = require('express');

const simulacroRouter = require('./routes/simulacro');
const doctorsRouter = require('./routes/doctors');
const reportsRouter = require('./routes/reports');
const patientsRouter = require('./routes/patients');

const app = express();

// ── Middlewares globales ─────────────────────────────────────────────────────

// Permite recibir JSON en el body de las requests
app.use(express.json());

// Log de todas las requests entrantes (ayuda a depurar durante desarrollo)
app.use((req, res, next) => {
    console.log(`→ ${req.method} ${req.path}`);
    next(); // llama al siguiente middleware o ruta
});

// ── Montaje de rutas ─────────────────────────────────────────────────────────
// Cada router maneja las rutas que empiezan con su prefijo

app.use('/api/simulacro', simulacroRouter); // POST /api/simulacro/migrate
app.use('/api/doctors', doctorsRouter);   // GET/PUT /api/doctors
app.use('/api/reports', reportsRouter);   // GET /api/reports/revenue
app.use('/api/patients', patientsRouter);  // GET /api/patients/:email/history

// ── Rutas no encontradas (404) ───────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ ok: false, error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

module.exports = app;
```

---

## Paso 11 — Crear [src/server.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/src/server.js)

```javascript
/**
 * src/server.js
 *
 * Punto de entrada de la aplicación.
 * 
 * Secuencia de arranque:
 *  1. Conectar a PostgreSQL y crear tablas (si no existen)
 *  2. Conectar a MongoDB
 *  3. Iniciar el servidor Express
 * 
 * Si cualquiera de los pasos falla, el proceso termina con un error descriptivo.
 */
const app = require('./app');
const env = require('./config/env');
const { createTables } = require('./config/postgres');
const { connectMongo } = require('./config/mongodb');

async function startServer() {
    try {
        // Paso 1: PostgreSQL — conexión y creación de tablas
        console.log('🔌 Conectando a PostgreSQL...');
        await createTables();

        // Paso 2: MongoDB — conexión
        console.log('🔌 Conectando a MongoDB...');
        await connectMongo();

        // Paso 3: Iniciar servidor HTTP
        app.listen(env.port, () => {
            console.log(`\n🚀 Servidor corriendo en http://localhost:${env.port}`);
            console.log(`📋 Info de la API: http://localhost:${env.port}/api/simulacro`);
            console.log('\nEndpoints disponibles:');
            console.log(`  POST http://localhost:${env.port}/api/simulacro/migrate`);
            console.log(`  GET  http://localhost:${env.port}/api/doctors`);
            console.log(`  GET  http://localhost:${env.port}/api/doctors/:id`);
            console.log(`  PUT  http://localhost:${env.port}/api/doctors/:id`);
            console.log(`  GET  http://localhost:${env.port}/api/reports/revenue`);
            console.log(`  GET  http://localhost:${env.port}/api/patients/:email/history`);
        });
    } catch (error) {
        console.error('\n❌ Error al iniciar el servidor:', error.message);
        console.error('Verifica que PostgreSQL y MongoDB estén corriendo y que el archivo .env esté configurado.');
        process.exit(1); // terminar el proceso con código de error
    }
}

startServer();
```

---

## Paso 12 — Crear [src/routes/simulacro.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/src/routes/simulacro.js)

```javascript
/**
 * src/routes/simulacro.js
 *
 * Endpoints de información y migración del simulacro.
 */
const { Router } = require('express');
const { migrate } = require('../services/migrationService');

const router = Router();

// GET /api/simulacro — información general de la API
router.get('/', (req, res) => {
    res.json({
        ok: true,
        name: 'SaludPlus API',
        version: '1.0.0',
        endpoints: [
            'GET  /api/simulacro',
            'POST /api/simulacro/migrate',
            'GET  /api/doctors',
            'GET  /api/doctors/:id',
            'PUT  /api/doctors/:id',
            'GET  /api/reports/revenue',
            'GET  /api/patients/:email/history',
        ],
    });
});

// POST /api/simulacro/migrate — ejecutar la migración del CSV
router.post('/migrate', async (req, res) => {
    try {
        // clearBefore es opcional; si no se envía, por defecto es false
        const clearBefore = req.body?.clearBefore === true;

        console.log(`🚀 Iniciando migración (clearBefore: ${clearBefore})...`);
        const result = await migrate(clearBefore);
        console.log('✅ Migración completada:', result);

        res.json({
            ok: true,
            message: 'Migration completed successfully',
            result,
        });
    } catch (error) {
        console.error('❌ Error en migración:', error.message);
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;
```

---

## Paso 13 — Crear [src/routes/doctors.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/src/routes/doctors.js)

```javascript
/**
 * src/routes/doctors.js
 *
 * Endpoints para gestión de médicos.
 * Los datos maestros viven en PostgreSQL (via doctorService).
 */
const { Router } = require('express');
const { getAllDoctors, getDoctorById, updateDoctor } = require('../services/doctorService');

const router = Router();

// GET /api/doctors — listar todos los médicos (con filtro opcional por especialidad)
router.get('/', async (req, res) => {
    try {
        const { specialty } = req.query; // ?specialty=Cardiology
        const doctors = await getAllDoctors(specialty);
        res.json({ ok: true, doctors });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

// GET /api/doctors/:id — obtener un médico por su ID
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);

        // Validar que el ID es un número válido
        if (isNaN(id)) {
            return res.status(400).json({ ok: false, error: 'El ID debe ser un número entero' });
        }

        const doctor = await getDoctorById(id);
        res.json({ ok: true, doctor });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ ok: false, error: error.message });
    }
});

// PUT /api/doctors/:id — actualizar un médico
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id)) {
            return res.status(400).json({ ok: false, error: 'El ID debe ser un número entero' });
        }

        const { name, email, specialty } = req.body;

        // Validar campos obligatorios
        if (!name || !email || !specialty) {
            return res.status(400).json({
                ok: false,
                error: 'Se requieren los campos: name, email, specialty',
            });
        }

        const doctor = await updateDoctor(id, { name, email, specialty });
        res.json({ ok: true, message: 'Doctor updated successfully', doctor });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ ok: false, error: error.message });
    }
});

module.exports = router;
```

---

## Paso 14 — Crear [src/routes/reports.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/src/routes/reports.js)

```javascript
/**
 * src/routes/reports.js
 *
 * Endpoints para reportes de recaudación.
 * Los cálculos se hacen en PostgreSQL (agregaciones SQL precisas).
 */
const { Router } = require('express');
const { getRevenueReport } = require('../services/reportService');

const router = Router();

// GET /api/reports/revenue — reporte de recaudación por seguro
// Query params opcionales: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/revenue', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Validación simple del formato de fecha si se proporcionan
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (startDate && !dateRegex.test(startDate)) {
            return res.status(400).json({ ok: false, error: 'startDate debe tener formato YYYY-MM-DD' });
        }
        if (endDate && !dateRegex.test(endDate)) {
            return res.status(400).json({ ok: false, error: 'endDate debe tener formato YYYY-MM-DD' });
        }

        const report = await getRevenueReport(startDate, endDate);
        res.json({ ok: true, report });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;
```

---

## Paso 15 — Crear [src/routes/patients.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/src/routes/patients.js)

```javascript
/**
 * src/routes/patients.js
 *
 * Endpoints para historial de pacientes.
 * Los datos se leen desde MongoDB (una sola consulta, sin JOINs).
 */
const { Router } = require('express');
const { getPatientHistory } = require('../services/patientService');

const router = Router();

// GET /api/patients/:email/history — historial completo de un paciente
router.get('/:email/history', async (req, res) => {
    try {
        const { email } = req.params;

        // Validación básica de formato de email
        if (!email.includes('@')) {
            return res.status(400).json({ ok: false, error: 'Formato de email inválido' });
        }

        const result = await getPatientHistory(email);
        res.json({ ok: true, ...result });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ ok: false, error: error.message });
    }
});

module.exports = router;
```

---

## Paso 16 — Crear [src/services/migrationService.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/src/services/migrationService.js)

```javascript
/**
 * src/services/migrationService.js
 *
 * Servicio de migración: lee el CSV y distribuye los datos entre PostgreSQL y MongoDB.
 *
 * Estrategia:
 *  1. Leer todas las filas del CSV
 *  2. Extraer entidades únicas: pacientes, médicos, seguros (deduplicar por email/nombre)
 *  3. Insertar en PostgreSQL con ON CONFLICT DO NOTHING (idempotente)
 *  4. Insertar citas referenciando los IDs generados
 *  5. Crear/actualizar documentos de historial en MongoDB
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { pool } = require('../config/postgres');
const { PatientHistory } = require('../config/mongodb');
const env = require('../config/env');

/**
 * Ejecuta la migración completa.
 * @param {boolean} clearBefore - Si es true, borra todos los datos antes de migrar
 * @returns {object} Estadísticas de la migración
 */
async function migrate(clearBefore = false) {
    // ── 1. Leer y parsear el CSV ────────────────────────────────────────────────
    const csvPath = path.resolve(env.csvPath);
    const fileContent = fs.readFileSync(csvPath, 'utf-8');

    // csv-parse/sync convierte cada fila en un objeto con los headers como claves
    const rows = parse(fileContent, {
        columns: true,        // primera fila = nombres de columnas
        skip_empty_lines: true,
        trim: true,           // elimina espacios en blanco alrededor de los valores
    });

    console.log(`📄 CSV leído: ${rows.length} filas encontradas`);

    // ── 2. Si se pidió limpiar, borrar datos existentes ────────────────────────
    if (clearBefore) {
        // Orden importante: primero las tablas que tienen FK, luego las referenciadas
        await pool.query('DELETE FROM appointments');
        await pool.query('DELETE FROM patients');
        await pool.query('DELETE FROM doctors');
        await pool.query('DELETE FROM insurances');
        await PatientHistory.deleteMany({});
        console.log('🗑️  Datos anteriores eliminados');
    }

    // ── 3. Insertar datos maestros en PostgreSQL ────────────────────────────────
    // ON CONFLICT DO NOTHING: si el registro ya existe (misma email), lo ignora.
    // Esto hace el proceso IDEMPOTENTE: puedes ejecutarlo N veces sin duplicar datos.

    // Pacientes únicos (agrupados por email)
    const patientEmails = new Set();
    for (const row of rows) {
        const email = row.patient_email.toLowerCase().trim();
        if (!patientEmails.has(email)) {
            patientEmails.add(email);
            await pool.query(
                `INSERT INTO patients (name, email, phone, address)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
                [row.patient_name, email, row.patient_phone, row.patient_address]
            );
        }
    }

    // Médicos únicos (agrupados por email)
    const doctorEmails = new Set();
    for (const row of rows) {
        const email = row.doctor_email.toLowerCase().trim();
        if (!doctorEmails.has(email)) {
            doctorEmails.add(email);
            await pool.query(
                `INSERT INTO doctors (name, email, specialty)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING`,
                [row.doctor_name, email, row.specialty]
            );
        }
    }

    // Seguros únicos (agrupados por nombre del proveedor)
    const insuranceNames = new Set();
    for (const row of rows) {
        const name = row.insurance_provider.trim();
        if (!insuranceNames.has(name)) {
            insuranceNames.add(name);
            await pool.query(
                `INSERT INTO insurances (name, coverage_percentage)
         VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING`,
                [name, parseInt(row.coverage_percentage, 10)]
            );
        }
    }

    // ── 4. Insertar citas en PostgreSQL ────────────────────────────────────────
    // Necesitamos los IDs generados por Postgres para construir las FKs
    let appointmentsInserted = 0;

    for (const row of rows) {
        const patientEmail = row.patient_email.toLowerCase().trim();
        const doctorEmail = row.doctor_email.toLowerCase().trim();
        const insuranceName = row.insurance_provider.trim();

        // Obtener IDs referenciados
        const { rows: [patient] } = await pool.query('SELECT id FROM patients WHERE email = $1', [patientEmail]);
        const { rows: [doctor] } = await pool.query('SELECT id FROM doctors WHERE email = $1', [doctorEmail]);
        const { rows: [insurance] } = await pool.query('SELECT id FROM insurances WHERE name = $1', [insuranceName]);

        // Insertar cita (ON CONFLICT DO NOTHING para idempotencia)
        const result = await pool.query(
            `INSERT INTO appointments
         (appointment_id, appointment_date, patient_id, doctor_id,
          treatment_code, treatment_description, treatment_cost, insurance_id, amount_paid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (appointment_id) DO NOTHING`,
            [
                row.appointment_id,
                row.appointment_date,
                patient.id,
                doctor.id,
                row.treatment_code,
                row.treatment_description,
                parseFloat(row.treatment_cost),
                insurance.id,
                parseFloat(row.amount_paid),
            ]
        );

        if (result.rowCount > 0) appointmentsInserted++;
    }

    // ── 5. Crear/actualizar historial en MongoDB ────────────────────────────────
    // Agrupamos las citas por paciente para construir el documento a incrustar
    const historiesByEmail = {};

    for (const row of rows) {
        const email = row.patient_email.toLowerCase().trim();

        if (!historiesByEmail[email]) {
            historiesByEmail[email] = {
                patientEmail: email,
                patientName: row.patient_name,
                appointments: [],
            };
        }

        historiesByEmail[email].appointments.push({
            appointmentId: row.appointment_id,
            date: row.appointment_date,
            doctorName: row.doctor_name,
            doctorEmail: row.doctor_email.toLowerCase().trim(),
            specialty: row.specialty,
            treatmentCode: row.treatment_code,
            treatmentDescription: row.treatment_description,
            treatmentCost: parseFloat(row.treatment_cost),
            insuranceProvider: row.insurance_provider,
            coveragePercentage: parseInt(row.coverage_percentage, 10),
            amountPaid: parseFloat(row.amount_paid),
        });
    }

    // upsert: actualiza si ya existe, crea si no existe
    for (const history of Object.values(historiesByEmail)) {
        await PatientHistory.updateOne(
            { patientEmail: history.patientEmail },
            { $set: history },
            { upsert: true }
        );
    }

    // ── 6. Retornar estadísticas ────────────────────────────────────────────────
    const { rows: [{ count: pCount }] } = await pool.query('SELECT COUNT(*) FROM patients');
    const { rows: [{ count: dCount }] } = await pool.query('SELECT COUNT(*) FROM doctors');
    const { rows: [{ count: iCount }] } = await pool.query('SELECT COUNT(*) FROM insurances');
    const { rows: [{ count: aCount }] } = await pool.query('SELECT COUNT(*) FROM appointments');
    const hCount = await PatientHistory.countDocuments();

    return {
        patients: parseInt(pCount),
        doctors: parseInt(dCount),
        insurances: parseInt(iCount),
        appointments: parseInt(aCount),
        histories: hCount,
        csvPath: csvPath,
    };
}

module.exports = { migrate };
```

---

## Paso 17 — Crear [src/services/doctorService.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/src/services/doctorService.js)

```javascript
/**
 * src/services/doctorService.js
 *
 * Lógica de negocio para médicos.
 * Usa PostgreSQL para datos maestros y propaga cambios a MongoDB cuando corresponde.
 */
const { pool } = require('../config/postgres');
const { PatientHistory } = require('../config/mongodb');

/**
 * Retorna todos los médicos.
 * @param {string|undefined} specialty - Filtro opcional por especialidad
 */
async function getAllDoctors(specialty) {
    if (specialty) {
        // Filtramos con ILIKE para que no distinga mayúsculas/minúsculas
        const { rows } = await pool.query(
            'SELECT id, name, email, specialty FROM doctors WHERE specialty ILIKE $1 ORDER BY name',
            [specialty]
        );
        return rows;
    }

    const { rows } = await pool.query(
        'SELECT id, name, email, specialty FROM doctors ORDER BY name'
    );
    return rows;
}

/**
 * Retorna un médico por su ID.
 * @throws {Error} Si el médico no existe
 */
async function getDoctorById(id) {
    const { rows } = await pool.query(
        'SELECT id, name, email, specialty FROM doctors WHERE id = $1',
        [id]
    );

    if (rows.length === 0) {
        const error = new Error('Doctor not found');
        error.status = 404;
        throw error;
    }

    return rows[0];
}

/**
 * Actualiza un médico en PostgreSQL y propaga los cambios a MongoDB.
 *
 * Desafío de consistencia en arquitectura híbrida:
 * Si el nombre o email del médico cambia, los documentos de historial de pacientes
 * en MongoDB también deben actualizarse porque contienen esos datos embebidos.
 * Esto es un TRADEOFF de la decisión de embedding: más rápida lectura, pero
 * actualizaciones requieren propagación manual.
 *
 * @param {number} id - ID del médico
 * @param {object} data - Campos a actualizar {name, email, specialty}
 */
async function updateDoctor(id, data) {
    const { name, email, specialty } = data;

    // Verificar que el médico existe antes de actualizar
    const existing = await getDoctorById(id);

    // Actualizar en PostgreSQL
    const { rows } = await pool.query(
        `UPDATE doctors
     SET name = $1, email = $2, specialty = $3
     WHERE id = $4
     RETURNING id, name, email, specialty`,
        [name, email.toLowerCase().trim(), specialty, id]
    );

    const updatedDoctor = rows[0];

    // ── Propagación a MongoDB ────────────────────────────────────────────────
    // Actualizamos todos los documentos de historial que tenían datos de este médico.
    await PatientHistory.updateMany(
        { 'appointments.doctorEmail': existing.email },  // buscar citas del médico
        {
            $set: {
                'appointments.$[appt].doctorName': updatedDoctor.name,
                'appointments.$[appt].doctorEmail': updatedDoctor.email,
                'appointments.$[appt].specialty': updatedDoctor.specialty,
            }
        },
        {
            // arrayFilters identifica cuáles elementos del array actualizar
            arrayFilters: [{ 'appt.doctorEmail': existing.email }]
        }
    );

    return updatedDoctor;
}

module.exports = { getAllDoctors, getDoctorById, updateDoctor };
```

---

## Paso 18 — Crear [src/services/patientService.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/src/services/patientService.js)

```javascript
/**
 * src/services/patientService.js
 *
 * Obtiene el historial completo de un paciente desde MongoDB.
 *
 * Por qué usamos MongoDB para esto:
 *  - El documento ya contiene todas las citas embebidas
 *  - Una sola consulta por email devuelve todo el historial (sin JOINs)
 *  - Rendimiento óptimo para lecturas frecuentes de documentos completos
 */
const { PatientHistory } = require('../config/mongodb');

/**
 * Retorna el historial completo de un paciente identificado por su email.
 * Incluye estadísticas de resumen calculadas al vuelo.
 * @param {string} email - Email del paciente
 */
async function getPatientHistory(email) {
    const normalizedEmail = email.toLowerCase().trim();

    // Buscar el documento en MongoDB (el índice en patientEmail hace esto muy rápido)
    const history = await PatientHistory.findOne({ patientEmail: normalizedEmail });

    if (!history) {
        const error = new Error('Patient not found');
        error.status = 404;
        throw error;
    }

    // ── Calcular estadísticas de resumen ─────────────────────────────────────
    const appointments = history.appointments;

    const totalSpent = appointments.reduce((sum, apt) => sum + apt.amountPaid, 0);

    // Especialidad más frecuente: contamos cuántas citas tiene cada especialidad
    const specialtyCounts = {};
    for (const apt of appointments) {
        specialtyCounts[apt.specialty] = (specialtyCounts[apt.specialty] || 0) + 1;
    }

    // Ordenar por frecuencia y tomar la primera
    const mostFrequentSpecialty = Object.entries(specialtyCounts)
        .sort(([, a], [, b]) => b - a)  // descendente por conteo
        .map(([specialty]) => specialty)[0] || null;

    return {
        patient: {
            email: history.patientEmail,
            name: history.patientName,
        },
        appointments: appointments,
        summary: {
            totalAppointments: appointments.length,
            totalSpent: totalSpent,
            mostFrequentSpecialty: mostFrequentSpecialty,
        },
    };
}

module.exports = { getPatientHistory };
```

---

## Paso 19 — Crear [src/services/reportService.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/src/services/reportService.js)

```javascript
/**
 * src/services/reportService.js
 *
 * Genera el reporte de recaudación agrupado por seguro médico.
 *
 * Por qué usamos SQL para esto:
 *  - Las operaciones de agregación (SUM, GROUP BY) son la fortaleza de SQL
 *  - Garantía ACID: los montos se calculan sobre datos transaccionalmente consistentes
 *  - El filtro por fecha es simple con WHERE appointment_date BETWEEN ... AND ...
 */
const { pool } = require('../config/postgres');

/**
 * Retorna el reporte de recaudación total, agrupado por seguro médico.
 * @param {string|undefined} startDate - Fecha inicio (YYYY-MM-DD), opcional
 * @param {string|undefined} endDate   - Fecha fin (YYYY-MM-DD), opcional
 */
async function getRevenueReport(startDate, endDate) {
    // Construimos la query dinámicamente según si hay filtros de fecha
    let whereClause = '';
    const params = [];

    if (startDate && endDate) {
        // $1 y $2 son placeholders que pg reemplaza con los valores reales (previene SQL injection)
        whereClause = 'WHERE a.appointment_date BETWEEN $1 AND $2';
        params.push(startDate, endDate);
    } else if (startDate) {
        whereClause = 'WHERE a.appointment_date >= $1';
        params.push(startDate);
    } else if (endDate) {
        whereClause = 'WHERE a.appointment_date <= $1';
        params.push(endDate);
    }

    // Consulta principal: JOIN entre appointments e insurances para obtener el nombre del seguro
    const query = `
    SELECT
      i.name                    AS "insuranceName",
      SUM(a.amount_paid)        AS "totalAmount",
      COUNT(a.id)               AS "appointmentCount"
    FROM appointments a
    JOIN insurances i ON a.insurance_id = i.id
    ${whereClause}
    GROUP BY i.name
    ORDER BY "totalAmount" DESC
  `;

    const { rows } = await pool.query(query, params);

    // Calcular el total general sumando todos los seguros
    const totalRevenue = rows.reduce((sum, row) => sum + parseFloat(row.totalAmount), 0);

    // Formatear los valores numéricos
    const byInsurance = rows.map(row => ({
        insuranceName: row.insuranceName,
        totalAmount: parseFloat(row.totalAmount),
        appointmentCount: parseInt(row.appointmentCount),
    }));

    return {
        totalRevenue,
        byInsurance,
        period: {
            startDate: startDate || null,
            endDate: endDate || null,
        },
    };
}

module.exports = { getRevenueReport };
```

---

## Paso 20 — Crear [scripts/run-migration.js](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/scripts/run-migration.js)

```javascript
/**
 * scripts/run-migration.js
 *
 * Script CLI para ejecutar la migración desde la terminal.
 * Uso: node scripts/run-migration.js [--clear]
 *
 * Ejemplo:
 *   node scripts/run-migration.js          # migra sin borrar datos previos
 *   node scripts/run-migration.js --clear  # borra todo y migra desde cero
 */
const { createTables } = require('../src/config/postgres');
const { connectMongo } = require('../src/config/mongodb');
const { migrate } = require('../src/services/migrationService');

async function run() {
    // Verificar si se pasó el flag --clear
    const clearBefore = process.argv.includes('--clear');

    console.log('🏥 SaludPlus — Script de Migración');
    console.log('─────────────────────────────────────');
    console.log(`Modo: ${clearBefore ? '🗑️  Limpiar y migrar' : '📥  Solo migrar'}\n`);

    try {
        // Conectar a las bases de datos
        console.log('🔌 Conectando a PostgreSQL...');
        await createTables();

        console.log('🔌 Conectando a MongoDB...');
        await connectMongo();

        // Ejecutar migración
        console.log('\n📄 Procesando CSV...');
        const result = await migrate(clearBefore);

        // Mostrar resultados
        console.log('\n✅ Migración completada exitosamente!');
        console.log('─────────────────────────────────────');
        console.log(`  Pacientes migrados:  ${result.patients}`);
        console.log(`  Médicos migrados:    ${result.doctors}`);
        console.log(`  Seguros migrados:    ${result.insurances}`);
        console.log(`  Citas migradas:      ${result.appointments}`);
        console.log(`  Historiales (Mongo): ${result.histories}`);
        console.log(`  Archivo CSV:         ${result.csvPath}`);
    } catch (error) {
        console.error('\n❌ Error durante la migración:', error.message);
        process.exit(1);
    } finally {
        // Cerrar conexiones y terminar el proceso
        process.exit(0);
    }
}

run();
```

---

## Paso 21 — Crear la base de datos en PostgreSQL

Abre `psql` o DBeaver y ejecuta:

```sql
CREATE DATABASE saludplus;
```

> Si ya tienes una base de datos con ese nombre de una sesión anterior, puedes usar un nombre diferente. Solo recuerda actualizar el [.env](file:///home/angela-monsalve/Documentos/projects/SaludPlusSim/saludplus-api/.env).

---

## Paso 22 — Verificar que MongoDB esté corriendo

```bash
# Verificar que el servicio esté activo
sudo systemctl status mongod

# Si no está activo, iniciarlo
sudo systemctl start mongod
```

---

## Paso 23 — Iniciar el servidor

Desde la carpeta `saludplus-api/`:

```bash
npm run dev
```

Deberías ver:

```
🔌 Conectando a PostgreSQL...
✅ Tablas PostgreSQL listas
🔌 Conectando a MongoDB...
✅ MongoDB conectado

🚀 Servidor corriendo en http://localhost:3000
```

---

## Paso 24 — Ejecutar la migración del CSV

Con el servidor corriendo, abre otra terminal y ejecuta:

```bash
curl -X POST http://localhost:3000/api/simulacro/migrate \
  -H "Content-Type: application/json" \
  -d '{"clearBefore": true}'
```

O alternativamente, usando el script CLI (sin necesitar que el servidor esté corriendo):

```bash
node scripts/run-migration.js --clear
```

---

## Paso 25 — Probar los endpoints

```bash
# Ver todos los médicos
curl http://localhost:3000/api/doctors

# Filtrar por especialidad
curl "http://localhost:3000/api/doctors?specialty=Cardiology"

# Ver un médico por ID
curl http://localhost:3000/api/doctors/1

# Reporte de recaudación
curl http://localhost:3000/api/reports/revenue

# Reporte con filtro de fechas
curl "http://localhost:3000/api/reports/revenue?startDate=2024-01-01&endDate=2024-12-31"

# Historial de un paciente (reemplaza el email por uno real del CSV)
curl "http://localhost:3000/api/patients/juan.perez@example.com/history"
```

---

## Estructura final del proyecto

```
saludplus-api/
├── .env                          ← variables de entorno (NO subir a git)
├── .gitignore
├── package.json
├── data/
│   └── simulacro_saludplus_data.csv
├── scripts/
│   └── run-migration.js          ← script CLI para migrar desde terminal
└── src/
    ├── app.js                    ← configura Express y monta rutas
    ├── server.js                 ← punto de entrada, arranca el servidor
    ├── config/
    │   ├── env.js                ← carga y valida variables de entorno
    │   ├── postgres.js           ← pool de conexión + creación de tablas
    │   └── mongodb.js            ← conexión + schemas de Mongoose
    ├── routes/
    │   ├── simulacro.js          ← GET /api/simulacro, POST /api/simulacro/migrate
    │   ├── doctors.js            ← GET/PUT /api/doctors
    │   ├── reports.js            ← GET /api/reports/revenue
    │   └── patients.js           ← GET /api/patients/:email/history
    └── services/
        ├── migrationService.js   ← lógica de migración CSV → PG + Mongo
        ├── doctorService.js      ← CRUD de médicos con propagación a Mongo
        ├── patientService.js     ← historial desde MongoDB
        └── reportService.js      ← reporte de recaudación con SQL
```
