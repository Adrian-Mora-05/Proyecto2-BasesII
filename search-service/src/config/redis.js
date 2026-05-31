import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  enableOfflineQueue: false, // Si Redis cae, falla rápido sin acumular requests
});

redis.on('error', (err) => {
  // No crashear el servicio si Redis falla — el caché es opcional
  console.error('[Redis] Error de conexión:', err.message);
});

export const SEARCH_TTL = 60; // 1 minuto para resultados de búsqueda

export async function getCached(key) {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function setCached(key, value, ttl = SEARCH_TTL) {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // Fail silently — la búsqueda funciona sin caché
  }
}

export async function deleteCached(key) {
  try {
    await redis.del(key);
  } catch {}
}

export default redis;