import { Router } from "express";
import { createFixedTransaction, deleteFixedTransaction, getFixedTransactionsByPlayer, updateFixedTransaction } from "../../controllers/fixedTransactions.js";


export const fixedTransactionsRoutes = Router();

// Fixed transactions
fixedTransactionsRoutes.get("/fixed-transactions/player/:playerId", getFixedTransactionsByPlayer);
fixedTransactionsRoutes.post("/fixed-transactions", createFixedTransaction);
fixedTransactionsRoutes.put("/fixed-transactions/:id", updateFixedTransaction);
fixedTransactionsRoutes.delete("/fixed-transactions/:id", deleteFixedTransaction);
