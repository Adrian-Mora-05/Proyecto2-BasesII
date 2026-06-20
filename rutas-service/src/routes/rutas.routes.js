// rutas-service/src/routes/rutas.routes.js

import express from 'express';
import { postAsignarRutas } from '../controllers/rutas.controller.js';

const router = express.Router();

// POST /rutas/asignar
router.post('/asignar', postAsignarRutas);

export default router;