import Redis from 'ioredis';
import 'dotenv/config';

// Crea el cliente de Redis usando la URL del .env
// Redis corre en su propio contenedor Docker
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

// Evento que confirma la conexión exitosa
redis.on('connect', () => {
  console.log('Conectado a Redis correctamente');
});

// Evento que captura errores de conexión
redis.on('error', (err) => {
  console.error('Error en Redis:', err.message);
});

export default redis;