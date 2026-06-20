// rutas-service/src/routes/grafos.routes.js

import express from 'express';
import {
  getCoCompras,
  getUsuariosInfluyentes,
  getCaminoMinimo,
} from '../controllers/grafos.controller.js';

const router = express.Router();

// GET /grafos/co-compras
router.get('/co-compras', getCoCompras);

// GET /grafos/usuarios-influyentes
router.get('/usuarios-influyentes', getUsuariosInfluyentes);

// GET /grafos/camino-minimo?origen=cartago-centro&destino=tres-rios&criterio=distancia_km
router.get('/camino-minimo', getCaminoMinimo);

export default router;