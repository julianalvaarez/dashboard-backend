import { Router } from "express";
import { addFixedTransaction, deleteFixedTransaction, deleteFixedTransactions, getFixedTransactionsByPlayer, updateFixedTransaction } from "../../controllers/fixedTransactionsController.js";


export const fixedTransactionRoutes = Router();

// TRANSACCIONES
fixedTransactionRoutes.post('/fixed-transactions', addFixedTransaction)

fixedTransactionRoutes.put('/fixed-transactions/:id', updateFixedTransaction)

fixedTransactionRoutes.delete('/fixed-transactions/:id', deleteFixedTransaction)

fixedTransactionRoutes.delete("/fixed-transactions", deleteFixedTransactions);

fixedTransactionRoutes.get('/fixed-transactions/player/:playerId', getFixedTransactionsByPlayer)