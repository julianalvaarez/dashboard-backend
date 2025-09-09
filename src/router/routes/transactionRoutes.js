import { Router } from "express";
import { addTransaction, deleteTransaction, deleteTransactions, getTransactions, getTransactionsByPlayer, updateTransaction } from "../../controllers/transactionController.js";


export const transactionRoutes = Router();

// TRANSACCIONES
transactionRoutes.post('/transactions', addTransaction)

transactionRoutes.put('/transactions/:id', updateTransaction)

transactionRoutes.delete('/transactions/:id', deleteTransaction)

transactionRoutes.delete("/transactions", deleteTransactions);

transactionRoutes.get('/transactions', getTransactions)

transactionRoutes.get('/transactions/player/:playerId', getTransactionsByPlayer)
