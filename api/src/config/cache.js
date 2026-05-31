import redis from './redis.js';

// Evita errores en tests cuando redis está mockeado
const safeRedis = redis ?? {
  get: async () => null,
  set: async () => null,
  del: async () => null,
  keys: async () => []
};


// Tiempo de expiración en segundos para cada tipo de dato
// Puedes ajustar estos valores según qué tan frecuente cambian los datos
export const TTL = { //(tiempo de vida) Una política de expiración, cuando expira, redis elimina la clave(key)
  RESTAURANTS: 86400,  // 24 horas
  MENUS: 86400,        // 24 horas
  SEARCH: 60         // 1 minuto
};

// Obtiene un valor del caché
// Devuelve el valor parseado o null si no existe
export async function getCache(key) {
  try {
    const data = await safeRedis.get(key);
    // Si existe el dato lo devuelve parseado de JSON a objeto
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error leyendo caché:', error.message);
    // Si Redis falla, devuelve null para que la API siga funcionando
    return null;
  }
}

// Guarda un valor en el caché con tiempo de expiración
// key: identificador único del dato
// value: el dato a guardar
// ttl: tiempo de vida en segundos
export async function setCache(key, value, ttl) {
  try {
    // EX indica que el tiempo es en segundos
   await safeRedis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (error) {
    console.error('Error guardando en caché:', error.message);
    // Si Redis falla, la API sigue funcionando sin caché
  }
}

// Elimina un valor específico del caché
// Se usa cuando los datos cambian para no devolver datos viejos
export async function deleteCache(key) {
  try {
    await safeRedis.del(key);
  } catch (error) {
    console.error('Error eliminando caché:', error.message);
  }
}

// Elimina todos los valores que empiecen con un prefijo
// Por ejemplo deletePattern('restaurants:') borra todos los caché de restaurantes
export async function deletePattern(pattern) {
  try {
    // KEYS busca todas las llaves que coincidan con el patrón
    const keys = await safeRedis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Error eliminando patrón de caché:', error.message);
  }
}