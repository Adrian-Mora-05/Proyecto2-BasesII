import { createApp } from './app.js';

const PORT = process.env.PORT || 4000;

createApp()
  .then(app => {
    app.listen(PORT, () => {
      console.log(`[Search Service] Corriendo en puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error('[Search Service] Error al iniciar:', err.message);
    process.exit(1);
  });