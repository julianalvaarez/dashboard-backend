import { Router } from "express";
import { playerRoutes } from "./routes/playerRoutes.js";
import { transactionRoutes } from "./routes/transactionRoutes.js";
import { fixedTransactionRoutes } from "./routes/fixedTransactionsRoutes.js";
import { documentsRoutes } from "./routes/documentsRoutes.js";


export const router = Router()

router.use(transactionRoutes)
router.use(fixedTransactionRoutes)
router.use(playerRoutes)
router.use(documentsRoutes)