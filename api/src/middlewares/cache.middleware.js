import { getCache, setCache } from '../config/cache.js';

/**
 * cacheMiddleware — Middleware de caché Redis para rutas GET.
 *
 * Uso en rutas:
 *   router.get('/', checkJwt, cacheMiddleware('restaurants:all', TTL.RESTAURANTS), controller.findAll);
 *   router.get('/:id', checkJwt, cacheMiddleware((req) => `menus:item:${req.params.id}`, TTL.MENUS), controller.findById);
 *
 * La clave puede ser:
 *  - string fijo:    'restaurants:all'
 *  - función:        (req) => `menus:item:${req.params.id}`
 *
 * Flujo:
 *  HIT  → responde desde Redis, no llega al controlador
 *  MISS → llega al controlador, intercepta res.json() para guardar en Redis
 *
 * Si Redis falla en cualquier punto, el request continúa normalmente
 * sin caché (fail-open) para no romper la API.
 *
 * @param {string|Function} keyOrFn — Clave fija o función que recibe req y retorna la clave
 * @param {number} ttl — Tiempo de vida en segundos
 */
export function cacheMiddleware(keyOrFn, ttl) {
  return async (req, res, next) => {
    // Solo cachear GETs
    if (req.method !== 'GET') return next();

    const key = typeof keyOrFn === 'function' ? keyOrFn(req) : keyOrFn;

    // ── Intento HIT ──────────────────────────────────────────────
    const cached = await getCache(key);
    if (cached) {
      console.log(`[cache HIT] ${key}`);
      return res.status(200).json(cached);
    }

    console.log(`[cache MISS] ${key}`);

    // ── MISS: interceptar res.json para guardar en Redis ─────────
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Guardar en Redis en paralelo — no bloqueamos la respuesta.
      // Si Redis falla, el .catch() lo absorbe y la API sigue funcionando.
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setCache(key, body, ttl).catch(err =>
          console.error(`[cache] Error guardando ${key}:`, err.message)
        );
      }
      // Restaurar res.json original para evitar llamadas recursivas
      res.json = originalJson;
      return originalJson(body);
    };

    next();
  };
}