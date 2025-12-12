import { Router } from "express";
import { playerRoutes } from "./routes/playerRoutes.js";
import { transactionRoutes } from "./routes/transactionRoutes.js";
import { fixedTransactionsRoutes } from "./routes/fixedTransactions.js";


export const router = Router()

router.use(fixedTransactionsRoutes)
router.use(transactionRoutes)
router.use(playerRoutes)