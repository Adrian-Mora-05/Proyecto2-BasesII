// rutas-service/src/server.js
//
// Punto de entrada del microservicio.

import 'dotenv/config';
import { createApp } from './app.js';

const PORT = process.env.PORT || 5000;

const app = createApp();

app.listen(PORT, () => {
  console.log(` rutas-service corriendo en el puerto ${PORT}`);
});