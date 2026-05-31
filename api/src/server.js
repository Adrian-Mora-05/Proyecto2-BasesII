import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;

const app = await createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});