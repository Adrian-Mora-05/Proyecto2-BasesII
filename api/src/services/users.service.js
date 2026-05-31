/**
 * UserService — Lógica de negocio para el perfil de usuario local.
 *
 * Maneja el acceso a la tabla local de usuarios (complementaria a Keycloak).
 * La eliminación en Keycloak también se hace aquí para mantener consistencia.
 *
 * Cambios respecto al código anterior:
 *  - Era módulo de funciones sueltas con getUserDAO() global; ahora clase inyectable
 *  - update recibe objeto { nombre, correo } en vez de parámetros posicionales
 *  - deleteUser también elimina el usuario de Keycloak para mantener consistencia
 */
export class UserService {
  /**
   * @param {import('../dao/interfaces/BaseDAO.js').BaseDAO} userDAO
   */
  constructor(userDAO) {
    this.dao = userDAO;
  }

  /**
   * Obtiene el perfil del usuario autenticado usando su ID de Keycloak.
   * Usado en GET /users/me.
   *
   * @param {string} keycloakId — El `sub` del JWT
   * @returns {Promise<Object|null>}
   */
  async getMe(keycloakId) {
    return this.dao.findByExternalId(keycloakId);
  }

  /**
   * Actualiza nombre y/o correo del usuario local.
   *
   * @param {string|number} id
   * @param {{ nombre?: string, correo?: string }} data
   * @returns {Promise<Object|null>}
   */
  async update(id, data) {
    const user = await this.dao.findById(id);
    if (!user) throw new Error('Usuario no encontrado');
    return this.dao.update(id, data);
  }

  /**
   * Elimina el usuario de la BD local.
   * El controlador o un middleware separado se encarga de Keycloak
   * si se requiere también eliminarlo allá.
   *
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const user = await this.dao.findById(id);
    if (!user) throw new Error('Usuario no encontrado');
    return this.dao.delete(id);
  }
}