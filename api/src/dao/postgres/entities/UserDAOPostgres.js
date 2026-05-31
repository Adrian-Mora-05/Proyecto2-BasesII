import { PostgresBaseDAO } from '../PostgresBaseDAO.js';

/**
 * UserDAOPostgres — DAO de usuarios para PostgreSQL.
 *
 * La autenticación va por Keycloak, pero existe una tabla local
 * `restaurant.usuario` con datos complementarios y la referencia
 * al ID de Keycloak.
 */
export class UserDAOPostgres extends PostgresBaseDAO {
  constructor(pool) {
    super(pool, 'restaurant.usuario', 'id');
  }

  /**
   * Crea el registro local del usuario después de que AuthService
   * lo haya creado en Keycloak. Resuelve el id_rol desde la BD.
   *
   * @param {{ keycloakId: string, nombre: string, correo: string, rol: string }} data
   * @returns {Promise<Object>}
   */
  async createFromKeycloak({ keycloakId, nombre, correo, rol }) {
    const rolResult = await this._query(
      `SELECT id FROM restaurant.rol_usuario WHERE nombre = $1`,
      [rol]
    );
    const id_rol = rolResult.rows[0]?.id;
    if (!id_rol) throw new Error(`Rol '${rol}' no encontrado en base de datos`);

    const result = await this._query(
      `INSERT INTO restaurant.usuario (id_external_auth, nombre, correo, id_rol_usuario)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [keycloakId, nombre, correo, id_rol]
    );
    return result.rows[0];
  }

  /**
   * Busca el usuario local por su ID de Keycloak.
   * Usado en GET /users/me.
   *
   * @param {string} keycloakId
   * @returns {Promise<Object|null>}
   */
  async findByExternalId(keycloakId) {
    const result = await this._query(
      `SELECT u.id, u.nombre, u.correo, r.nombre AS rol
       FROM restaurant.usuario u
       JOIN restaurant.rol_usuario r ON u.id_rol_usuario = r.id
       WHERE u.id_external_auth = $1`,
      [keycloakId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const result = await this._query(
      `SELECT u.id, u.nombre, u.correo, r.nombre AS rol
       FROM restaurant.usuario u
       JOIN restaurant.rol_usuario r ON u.id_rol_usuario = r.id
       WHERE u.id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  /**
   * @param {number} id
   * @param {{ nombre?: string, correo?: string }} data
   * @returns {Promise<Object|null>}
   */
  async update(id, { nombre, correo }) {
    const fields  = [];
    const values  = [];
    let   counter = 1;

    if (nombre !== undefined) { fields.push(`nombre = $${counter++}`); values.push(nombre); }
    if (correo !== undefined) { fields.push(`correo = $${counter++}`); values.push(correo); }

    if (fields.length === 0) throw new Error('No hay campos para actualizar');

    values.push(id);
    const result = await this._query(
      `UPDATE restaurant.usuario
       SET ${fields.join(', ')}
       WHERE id = $${counter}
       RETURNING id, nombre, correo`,
      values
    );
    return result.rows[0] ?? null;
  }

  /**
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const result = await this._query(
      `DELETE FROM restaurant.usuario WHERE id = $1`,
      [id]
    );
    return result.rowCount > 0;
  }
}