import { MongoBaseDAO } from '../MongoBaseDAO.js';

/**
 * UserDAOMongo — DAO de usuarios para MongoDB.
 *
 * Colección local `usuarios` con datos complementarios y referencia
 * al ID de Keycloak. En Mongo el rol se guarda como string directamente,
 * sin tabla de roles separada.
 */
export class UserDAOMongo extends MongoBaseDAO {
  constructor(db) {
    super(db, 'usuarios');
  }

  /**
   * Crea el registro local del usuario después de que AuthService
   * lo haya creado en Keycloak.
   *
   * En Mongo el rol se almacena como string (sin tabla de lookup).
   *
   * @param {{ keycloakId: string, nombre: string, correo: string, rol: string }} data
   * @returns {Promise<Object>}
   */
  async createFromKeycloak({ keycloakId, nombre, correo, rol }) {
    return super.create({
      id_external_auth: keycloakId,
      nombre,
      correo,
      rol,
      createdAt: new Date(),
    });
  }

  /**
   * Busca el usuario local por su ID de Keycloak.
   * Usado en GET /users/me.
   *
   * @param {string} keycloakId
   * @returns {Promise<Object|null>}
   */
  async findByExternalId(keycloakId) {
    const doc = await this.collection.findOne({ id_external_auth: keycloakId });
    return this._normalize(doc);
  }

  /**
   * @param {string} id
   * @param {{ nombre?: string, correo?: string }} data
   * @returns {Promise<Object|null>}
   */
  async update(id, { nombre, correo }) {
    const fields = {};
    if (nombre !== undefined) fields.nombre = nombre;
    if (correo !== undefined) fields.correo = correo;

    if (Object.keys(fields).length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    return super.update(id, fields);
  }
}