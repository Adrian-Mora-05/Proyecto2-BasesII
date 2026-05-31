import { PostgresBaseDAO } from '../PostgresBaseDAO.js';

/**
 * RestaurantDAOPostgres — DAO de restaurantes para PostgreSQL.
 *
 * Sobreescribe create porque usa un stored procedure.
 * findAll se hereda de PostgresBaseDAO pero se sobreescribe para
 * usar la función SQL listar_restaurantes() que puede tener lógica extra.
 */
export class RestaurantDAOPostgres extends PostgresBaseDAO {
  constructor(pool) {
    super(pool, 'restaurant.restaurante', 'id');
  }

  /**
   * @param {{ nombre: string, direccion: string, telefono: string }} data
   * @returns {Promise<{ id: number }>}
   */
  async create({ nombre, direccion, telefono }) {
    const result = await this._query(
      'SELECT restaurant.registrar_restaurante($1, $2, $3) AS id',
      [nombre, direccion, telefono]
    );
    return result.rows[0];
  }

  /**
   * Usa la función SQL que puede incluir lógica de negocio extra
   * (e.g. solo restaurantes activos, con joins, etc.).
   * @returns {Promise<Array>}
   */
  async findAll() {
    const result = await this._query(
      'SELECT * FROM restaurant.listar_restaurantes()'
    );
    return result.rows;
  }

  /**
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const result = await this._query(
      `SELECT * FROM restaurant.restaurante WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  /**
   * @param {number} id
   * @param {Object} data
   * @returns {Promise<Object|null>}
   */
  async update(id, data) {
    // Usa el UPDATE genérico heredado de PostgresBaseDAO
    return super.update(id, data);
  }

  /**
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    return super.delete(id);
  }
}