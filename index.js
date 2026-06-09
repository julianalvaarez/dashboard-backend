import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router } from './src/router/routerApp.js';

const port = process.env.PORT ?? 3000;
const app = express()

app.use(express.json())
app.use(cors())
app.use(router)

// Global error handler
app.use((err, req, res, next) => {
    console.error('!!! ERROR GLOBAL !!!');
    console.error(err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
});


app.listen(port, () => {
    console.log(`=================================`);
    console.log(`SERVIDOR INICIADO EN PUERTO ${port}`);
    console.log(`=================================`);
});
// Julialva08