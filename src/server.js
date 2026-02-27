import { executeSQL } from "./config/postgres.js";
//import app from "./app.js"; 
import { env } from "./config/env.js";
import { migrate } from "./services/migration_service.js";

try{
    console.log("Connecting to postgres...");
    await executeSQL();
    console.log("Connected to postgres successfully");

    // Corremos con migrate(true) una vez para vaciar registros antiguos de las tablas
    //await migrate(true);
    await migrate();

    /* app.listen(env.port, () => {
        console.log(`Server running on port ${env.port}`);
    }); */
}catch(error){
    console.error("Error starting server:", error);
    process.exit(1);
}