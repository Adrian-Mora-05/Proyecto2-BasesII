/**
 * ReservationService — Lógica de negocio para reservaciones.
 *
 */
export class ReservationService {
  /**
   * @param {import('../dao/interfaces/BaseDAO.js').BaseDAO} reservationDAO
   * @param {import('../dao/interfaces/BaseDAO.js').BaseDAO} userDAO
   */
  constructor(reservationDAO, userDAO) {
    this.reservationDAO = reservationDAO;
    this.userDAO        = userDAO;
  }

  /**
   * Crea una reservación resolviendo el usuario local primero.
   *
   * @param {{
   *   keycloakId: string,
   *   id_restaurante: string|number,
   *   id_mesa: string|number,
   *   fecha: string,
   *   duracion: number,
   *   personas: number
   * }} data
   * @returns {Promise<{ id: string|number }>}
   */
  async create({ keycloakId, id_restaurante, id_mesa, fecha, duracion, personas }) {
    // Resolver usuario local desde su keycloakId
    const usuario = await this.userDAO.findByExternalId(keycloakId);
    if (!usuario) throw new Error('Usuario no encontrado en base de datos');

    return this.reservationDAO.create({
      id_usuario: usuario.id,
      id_restaurante,
      id_mesa,
      fecha,
      duracion,
      personas,
    });
  }

  /**
   * Cancela una reservación validando que exista primero.
   *
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  async cancel(id) {
    const reservacion = await this.reservationDAO.findById(id);
    if (!reservacion) throw new Error('Reserva no encontrada');
    return this.reservationDAO.cancel(id);
  }
}