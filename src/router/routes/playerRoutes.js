import { Router } from "express";
import { addPlayerMiddleware } from '../../middlewares/middlewares.js';
import { deletePlayer, getPlayerById, getPlayers, updatePlayer, addPlayer } from "../../controllers/playerController.js";


export const playerRoutes = Router();


// JUGADORES
playerRoutes.get('/players', getPlayers)

playerRoutes.get('/players/:id', getPlayerById)

playerRoutes.put('/players/:id', updatePlayer)

playerRoutes.delete('/players/:id', deletePlayer)

playerRoutes.use(addPlayerMiddleware)

playerRoutes.post('/players', addPlayer)