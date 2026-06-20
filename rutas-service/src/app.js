// rutas-service/src/app.js
//
// Configuración de la app Express — separado de server.js
// para poder testear sin levantar un puerto real.

import express from 'express';
import grafosRoutes from './routes/grafos.routes.js';
import rutasRoutes  from './routes/rutas.routes.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  // Healthcheck
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Rutas del Punto 5 — Análisis de Grafos
  app.use('/grafos', grafosRoutes);

  // Rutas del Punto 6 — Asignación de Rutas de Entrega
  app.use('/rutas', rutasRoutes);

  return app;
}