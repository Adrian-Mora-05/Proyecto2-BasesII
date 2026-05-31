import { MongoBaseDAO } from '../MongoBaseDAO.js';

/**
 * ReservationDAOMongo — DAO de reservaciones para MongoDB.
 *
 * El archivo anterior era en realidad una copia del DAO de Postgres:
 * usaba `query` de Postgres, extendía `ReservationDAO` obsoleto,
 * y la clase se llamaba `ReservationPostgresDAO`. Reescrito completo.
 *
 * cancel() es un método de dominio específico (no está en BaseDAO)
 * porque no todos los recursos tienen el concepto de "cancelar".
 * El servicio valida existencia antes de llamarlo.
 */
export class ReservationDAOMongo extends MongoBaseDAO {
  constructor(db) {
    super(db, 'reservaciones');
  }

  /**
   * @param {{
   *   id_usuario: string,
   *   id_restaurante: string,
   *   id_mesa: string,
   *   fecha: string,
   *   duracion: number,
   *   personas: number
   * }} data
   * @returns {Promise<Object>}
   */
  async create({ id_usuario, id_restaurante, id_mesa, fecha, duracion, personas }) {
    return super.create({
      id_usuario,
      id_restaurante,
      id_mesa,
      fecha: new Date(fecha),
      duracion,
      personas,
      estado: 'pendiente',
      createdAt: new Date(),
    });
  }

  /**
   * Cancela una reserva actualizando su estado a 'cancelada'.
   * No elimina el documento para mantener historial.
   *
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async cancel(id) {
    const result = await this.update(id, {
      estado: 'cancelada',
      canceladaAt: new Date(),
    });
    return result !== null;
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