import { Router } from "express";
import multer from "multer";
import { uploadDocument, getDocumentsByPlayer, deleteDocument } from "../../controllers/documentsControllers.js";

export const documentsRoutes = Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Routes
documentsRoutes.post("/documents", upload.single("file"), uploadDocument);
documentsRoutes.get("/documents/player/:playerId", getDocumentsByPlayer);
documentsRoutes.delete("/documents/:id", deleteDocument);
