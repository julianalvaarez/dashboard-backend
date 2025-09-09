import { Router } from "express";
import { playerRoutes } from "./routes/playerRoutes.js";
import { transactionRoutes } from "./routes/transactionRoutes.js";


export const router = Router()

router.use(transactionRoutes)
router.use(playerRoutes)