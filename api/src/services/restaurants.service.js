//import { deletePattern } from '../config/cache.js';
import { getCache, setCache, TTL, deletePattern } from '../config/cache.js';
/**
 * RestaurantService — Lógica de negocio para restaurantes.
 *
 * El caché de lecturas (GET) ahora vive en cacheMiddleware.
 * Solo se mantiene deletePattern en escrituras para invalidar
 * el caché cuando los datos cambian.
 */
export class RestaurantService {
  /** @param {import('../dao/interfaces/BaseDAO.js').BaseDAO} restaurantDAO */
  constructor(restaurantDAO) {
    this.dao = restaurantDAO;
  }

  async create(data) {
    if (!data.nombre) throw new Error('El nombre del restaurante es obligatorio');
    const result = await this.dao.create(data);
    // Invalida caché de lista al crear un restaurante nuevo
    await deletePattern('restaurants:*');
    return result;
  }

  async findAll() {
    return this.dao.findAll();
    
  

  }
}