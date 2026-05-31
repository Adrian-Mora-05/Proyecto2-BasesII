import { PostgresBaseDAO } from '../PostgresBaseDAO.js';

/**
 * ReservationDAOPostgres — DAO de reservaciones para PostgreSQL.
 *
 * Cambios respecto al código anterior:
 *  - Extiende PostgresBaseDAO (antes extendía ReservationDAO, interfaz obsoleta)
 *  - Recibe pool por inyección (antes importaba query directamente)
 *  - getUserByKeycloakId se elimina de aquí → pertenece al servicio/controller
 *    porque es lógica de negocio (resolver identidad), no acceso a datos de reservas
 *  - create recibe un objeto data para cumplir el contrato de BaseDAO
 *  - cancel es un método específico de dominio que se mantiene (no está en BaseDAO)
 */
export class ReservationDAOPostgres extends PostgresBaseDAO {
  constructor(pool) {
    super(pool, 'restaurant.reservacion', 'id');
  }

  /**
   * @param {{
   *   id_usuario: number,
   *   id_restaurante: number,
   *   id_mesa: number,
   *   fecha: string,
   *   duracion: number,
   *   personas: number
   * }} data
   * @returns {Promise<{ id: number }>}
   */
  async create({ id_usuario, id_restaurante, id_mesa, fecha, duracion, personas }) {
    const result = await this._query(
      'SELECT restaurant.reservar($1, $2, $3, $4, $5, $6) AS id',
      [id_usuario, id_restaurante, id_mesa, fecha, duracion, personas]
    );
    const id = result.rows[0]?.id ?? result.rows[0]?.reservar;
    if (!id) throw new Error('No se pudo crear la reserva');
    return { id };
  }

  /**
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const result = await this._query(
      `SELECT * FROM restaurant.reservacion WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Cancela una reserva. Método específico de dominio que no existe
   * en BaseDAO porque no todos los recursos se "cancelan".
   * El servicio valida existencia antes de llamar esto.
   *
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async cancel(id) {
    await this._query(
      'SELECT restaurant.cancelar_reserva($1)',
      [id]
    );
    return true;
  }

  /**
   * Retorna todas las reservas de un usuario.
   * @param {number} idUsuario
   * @returns {Promise<Array>}
   */
  async findByUser(idUsuario) {
    return this.findBy({ id_usuario: idUsuario });
  }

  /**
   * Retorna todas las reservas de un restaurante.
   * @param {number} idRestaurante
   * @returns {Promise<Array>}
   */
  async findByRestaurant(idRestaurante) {
    return this.findBy({ id_restaurante: idRestaurante });
  }
}