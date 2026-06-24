// rutas-service/src/server.js
//
// Punto de entrada del microservicio.

import 'dotenv/config';
import { createApp } from './app.js';
import { inicializarGrafo } from './config/neo4j.js';

const PORT = process.env.PORT || 5000;

const app = createApp();

// Proyectar el grafo antes de empezar a recibir peticiones
await inicializarGrafo();


app.listen(PORT, () => {
  console.log(` rutas-service corriendo en el puerto ${PORT}`);
});