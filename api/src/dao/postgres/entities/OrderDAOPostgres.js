import { PostgresBaseDAO } from '../PostgresBaseDAO.js';

/**
 * OrderDAOPostgres — DAO de pedidos para PostgreSQL.
 *
 * Cambios respecto al código anterior:
 *  - Extiende PostgresBaseDAO
 *  - Recibe pool por inyección
 *  - getUserByKeycloakId se elimina → pertenece al servicio porque es
 *    resolución de identidad (lógica de negocio), no acceso a datos de pedidos
 *  - validateRestaurant se elimina → el servicio o el SP deben manejar esto
 *  - create recibe un objeto data para cumplir el contrato de BaseDAO
 */
export class OrderDAOPostgres extends PostgresBaseDAO {
  constructor(pool) {
    super(pool, 'restaurant.pedido', 'id');
  }

  /**
   * @param {{
   *   id_usuario: number,
   *   id_restaurante: number,
   *   descripcion: string,
   *   tipo_pedido: string,
   *   platos: Array
   * }} data
   * @returns {Promise<{ id: number }>}
   */
  async create({ id_usuario, id_restaurante, descripcion, tipo_pedido, platos }) {
    const result = await this._query(
      'SELECT restaurant.realizar_pedido($1, $2, $3, $4, $5) AS id',
      [id_usuario, id_restaurante, descripcion, tipo_pedido, JSON.stringify(platos)]
    );
    const id = result.rows[0]?.id ?? result.rows[0]?.realizar_pedido;
    if (!id) throw new Error('No se pudo crear el pedido');
    return { id };
  }

  /**
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const result = await this._query(
      'SELECT * FROM restaurant.get_detalles_pedido($1)',
      [id]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Retorna todos los pedidos de un usuario.
   * @param {number} idUsuario
   * @returns {Promise<Array>}
   */
  async findByUser(idUsuario) {
    return this.findBy({ id_usuario: idUsuario });
  }

  /**
   * Retorna todos los pedidos de un restaurante.
   * @param {number} idRestaurante
   * @returns {Promise<Array>}
   */
  async findByRestaurant(idRestaurante) {
    return this.findBy({ id_restaurante: idRestaurante });
  }
}