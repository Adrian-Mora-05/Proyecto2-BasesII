import { MongoBaseDAO } from '../MongoBaseDAO.js';

/**
 * OrderDAOMongo — DAO de pedidos para MongoDB.
 *
 *  - Extiende MongoBaseDAO (recibe db por inyección)
 *  - create recibe objeto data — cumple contrato BaseDAO
 *  - getUserByKeycloakId eliminado → va al servicio (resolución de identidad)
 *  - validateRestaurant eliminado → va al servicio
 *  - El cálculo de totales y validación de platos se eliminó del DAO:
 *    esa es lógica de negocio que pertenece a OrderService.
 *    El DAO recibe el pedido ya construido y validado por el servicio.
 */
export class OrderDAOMongo extends MongoBaseDAO {
  constructor(db) {
    super(db, 'pedidos');
  }

  /**
   * Persiste un pedido ya validado y calculado por el servicio.
   *
   * @param {{
   *   id_usuario: string,
   *   id_restaurante: string,
   *   descripcion: string,
   *   tipo_pedido: string,
   *   precio_total: number,
   *   platos: Array<{ id_plato: string, cantidad: number, subtotal: number }>,
   * }} data
   * @returns {Promise<Object>}
   */
  async create({ id_usuario, id_restaurante, descripcion, tipo_pedido, precio_total, platos }) {
    return super.create({
      id_usuario,
      id_restaurante,
      descripcion,
      tipo_pedido,
      precio_total,
      estado: 'pendiente',
      platos,
      createdAt: new Date(),
    });
  }

  /**
   * @param {string} idUsuario
   * @returns {Promise<Array>}
   */
  async findByUser(idUsuario) {
    return this.findBy({ id_usuario: idUsuario });
  }

  /**
   * @param {string} idRestaurante
   * @returns {Promise<Array>}
   */
  async findByRestaurant(idRestaurante) {
    return this.findBy({ id_restaurante: idRestaurante });
  }
}