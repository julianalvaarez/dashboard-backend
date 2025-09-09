import express from 'express';
import cors from 'cors';
import { router } from './src/router/routerApp.js';

const port = process.env.PORT ?? 3000;
const app = express()

app.use(express.json())
app.use(cors())
app.use(router)


app.listen(port, () => console.log(`Server on port ${port}`));
// Julialva08