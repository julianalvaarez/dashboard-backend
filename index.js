import express from 'express';
import cors from 'cors';
import { router } from './src/router/routerApp.js';
import { runDailyFixedTransactionJob } from './src/controllers/fixedTransactions.js';
import cron from "node-cron";

const port = process.env.PORT ?? 3000;
const app = express()

app.use(express.json())
app.use(cors())
app.use(router)

// Cron job: corre todos los días a las 00:05 (server timezone)
cron.schedule("5 0 * * *", async () => {
    console.log("Cron: Ejecutando job de transacciones fijas -", new Date().toISOString());
    await runDailyFixedTransactionJob();
});

app.listen(port, () => console.log(`Server on port ${port}`));
// Julialva08