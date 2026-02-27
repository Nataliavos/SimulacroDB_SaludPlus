
How to run:

-Install mongodb server
-Install mongosh
-Install mongoose

nmp init -y (package js)
npm i express, pg, dotenv
node --watch src/server.js (npm run dev)
npm i csv-parser
npm i mongoose

bash:

mongosh
show dbs
use SaludPlus
show collections / show tables --> ver tablas
b.patienthistories.find() --> ver registros de una tabla
db.createCollection("namecollection")  --> crear nueva colección/tabla

-Install postgreSQL (o usar remoto Supabase)
-Install psql

bash:

sudo -u postgres psql (cambiar al usuario de postgres e ingresar al cliente psql)


Comprobar si Mongodb está encendio:
  sudo systemctl status mongod
Sino, iniciarlo:
  sudo systemctl start mongod

GUÍA SIMULACRO 

ESTRUCTURA DB:
insurance_provider: name, coverage_percentage
patient: name, email, phone, adress
doctor
speciality
treatment
appointment

Diagrama MER (draw.io)

MONGODB:
Crear colecciones (patient_histories)

CREAR API (con express):
usar librería pg (npm i pg)

-Generar package json -> npm -y init
-Crear archivo de variables de entorno -> .env
-Install -> npm i dotenv
-En el package.json cambiar -> "type": "module"
-Install -> npm i pg


# Flujo de trabajo diario — Proyecto SaludPlus

Este documento resume, paso a paso, las acciones que debes realizar antes de ejecutar código en el proyecto. Sigue el orden y adapta comandos según tu entorno (local, Docker, VM).

## Antes de empezar (chequeo rápido)

- Código actualizado: `git pull origin main`
- Dependencias instaladas: `npm install`
- Variables de entorno disponibles: revisar `config/env.js` o `.env`
- Bases de datos levantadas: MongoDB / PostgreSQL
- Migraciones y seeds listos para ejecutar (ver `services/migration_service.js` y `data/`)

## Paso a paso diario

1) Sincronizar el repositorio

```bash
git checkout main
git pull origin main
```

2) Instalar dependencias y revisar paquetes

```bash
npm install
npm run lint   # si existe
npm test       # pruebas rápidas
```

3) Comprobar/establecer variables de entorno

- Revisa `config/env.js` y/o tu archivo `.env`.
- Exporta variables necesarias (ejemplo):

```bash
export NODE_ENV=development
export DATABASE_URL=postgres://user:pass@localhost:5432/saludplus
export MONGO_URI=mongodb://localhost:27017/saludplus
```

4) Levantar bases de datos

- Si usas servicios del sistema:

```bash
sudo systemctl start postgresql
sudo systemctl start mongod
```

- Si usas Docker / docker-compose:

```bash
docker-compose up -d db postgres mongo
```

5) Ejecutar migraciones y/o cargar datos de prueba

- Revisa `services/migration_service.js` y `data/script_saludplus.sql`.

```bash
# SQL directo (si aplica)
psql -U tu_usuario -d saludplus -f data/script_saludplus.sql

# O ejecutar service JS
node services/migration_service.js
```

6) Iniciar la aplicación

- Si hay script en `package.json`:

```bash
npm start          # o npm run dev
```

- O directamente:

```bash
node src/server.js
```

7) Verificar que la API/servidor responde

```bash
curl -I http://localhost:3000/health
```

8) Ejecutar pruebas completas y linters antes de trabajar

```bash
npm test
npm run lint
```

9) Monitoreo y logs mientras trabajas

- Revisa logs en consola o archivos.
- Si usas PM2: `pm2 logs`.
- Para Docker: `docker logs -f <container>`.

10) Antes de finalizar la sesión

- Guardar y commitear cambios locales:

```bash
git add -A
git commit -m "Descripción corta de cambios"
git push origin main
```

- Parar servicios si es necesario:

```bash
docker-compose down
sudo systemctl stop mongod postgresql
```

## Consejos rápidos

- Mantén un archivo `.env.local` con variables sensibles fuera del repo.
- Si trabajas con Docker, agrega `docker-compose.override.yml` para dev.
- Anota pasos o errores recurrentes aquí para estandarizar el flujo.

---

Archivo generado para uso diario — adáptalo a tu entorno.
