import { deletePattern } from '../config/cache.js';

/**
 * MenuService — Lógica de negocio para menús.
 *
 * El caché de lecturas (GET) ahora vive en cacheMiddleware.
 * deletePattern se mantiene en escrituras para invalidar caché.
 */
export class MenuService {
  /** @param {import('../dao/interfaces/BaseDAO.js').BaseDAO} menuDAO */
  constructor(menuDAO) {
    this.dao = menuDAO;
  }

  async create({ nombre, id_restaurante }) {
    if (!nombre || !id_restaurante) {
      throw new Error('nombre e id_restaurante son obligatorios');
    }
    const result = await this.dao.create({ nombre, id_restaurante });
    await deletePattern(`menus:restaurant:${id_restaurante}`);
    return result;
  }

  async findById(id) {
    const result = await this.dao.findById(id);
    return result ?? null;
  }

  async update(id, { nombre }) {
    if (!nombre) throw new Error('nombre es obligatorio');
    const menu = await this.dao.findById(id);
    if (!menu) throw new Error('Menú no encontrado');
    const updated = await this.dao.update(id, { nombre });
    // Invalida el ítem y la lista del restaurante
    await deletePattern(`menus:item:${id}`);
    await deletePattern(`menus:restaurant:${menu.id_restaurante}`);
    return updated;
  }

  async delete(id) {
    const menu = await this.dao.findById(id);
    if (!menu) throw new Error('Menú no encontrado');
    await this.dao.delete(id);
    await deletePattern(`menus:item:${id}`);
    await deletePattern(`menus:restaurant:${menu.id_restaurante}`);
    return true;
  }

  async findByRestaurant(idRestaurante) {
    return this.dao.findByRestaurant(idRestaurante);
  }
}