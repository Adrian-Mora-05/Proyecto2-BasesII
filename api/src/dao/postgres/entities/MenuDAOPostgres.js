import { PostgresBaseDAO } from '../PostgresBaseDAO.js';

/**
 * MenuDAOPostgres — DAO de menús para PostgreSQL.
 *
 * Usa los stored procedures definidos en el schema SQL.
 * Sobreescribe create/update/delete porque la lógica de negocio
 * vive en funciones SQL, no en INSERTs/UPDATEs genéricos.
 *
 * findAll y findBy se heredan de PostgresBaseDAO sin cambios.
 */
export class MenuDAOPostgres extends PostgresBaseDAO {
  constructor(pool) {
    // Tabla y PK para que findAll/findBy genéricos funcionen
    super(pool, 'restaurant.menu', 'id');
  }

  /**
   * @param {{ nombre: string, id_restaurante: number }} data
   * @returns {Promise<{ id: number }>}
   */
  async create({ nombre, id_restaurante }) {
    const result = await this._query(
      'SELECT restaurant.crear_menu($1, $2) AS id',
      [nombre, id_restaurante]
    );
    return result.rows[0];
  }

  /**
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const result = await this._query(
      'SELECT * FROM restaurant.get_detalles_menu($1)',
      [id]
    );
    return result.rows[0] ?? null;
  }

  /**
   * @param {number} id
   * @param {{ nombre: string }} data
   * @returns {Promise<Object|null>} — El menú actualizado, o null si no existe.
   */
  async update(id, { nombre }) {
    const result = await this._query(
      'SELECT restaurant.actualizar_menu($1, $2) AS updated',
      [id, nombre]
    );
    // Si el SP no retorna nada útil, confirmamos leyendo el registro
    return this.findById(id);
  }

  /**
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    await this._query(
      'SELECT restaurant.borrar_menu($1)',
      [id]
    );
    return true;
  }

  /**
   * Retorna todos los menús de un restaurante específico.
   * @param {number} idRestaurante
   * @returns {Promise<Array>}
   */
  async findByRestaurant(idRestaurante) {
    return this.findBy({ id_restaurante: idRestaurante });
  }
}