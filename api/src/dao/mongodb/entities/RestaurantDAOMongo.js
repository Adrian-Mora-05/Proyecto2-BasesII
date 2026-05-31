import { MongoBaseDAO } from '../MongoBaseDAO.js';

/**
 * RestaurantDAOMongo — DAO de restaurantes para MongoDB.
 *
 * Cambios respecto al código anterior:
 *  - Extiende MongoBaseDAO (recibe db por inyección)
 *  - create recibe objeto data — cumple contrato BaseDAO
 *  - findAll se hereda directamente de MongoBaseDAO (sin duplicar)
 *  - Agrega findById, update, delete heredados del base
 */
export class RestaurantDAOMongo extends MongoBaseDAO {
  constructor(db) {
    super(db, 'restaurantes');
  }

  /**
   * @param {{ nombre: string, direccion: string, telefono: string }} data
   * @returns {Promise<Object>}
   */
  async create({ nombre, direccion, telefono }) {
    return super.create({
      nombre,
      direccion,
      telefono,
      createdAt: new Date(),
    });
  }
}