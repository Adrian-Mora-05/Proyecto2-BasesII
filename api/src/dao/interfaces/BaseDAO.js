

/**
 * BaseDAO — Contrato abstracto que todo DAO debe cumplir.
 *
 * Principios SOLID:
 *  - SRP: Solo define el contrato, no implementa lógica.
 *  - OCP: Abierto a extensión (nuevos motores), cerrado a modificación.
 *  - LSP: Cualquier subclase reemplaza a BaseDAO sin romper el sistema.
 *  - ISP: Cada entidad extiende solo los métodos que necesita.
 *  - DIP: La lógica de negocio depende de esta abstracción, nunca de implementaciones concretas.
 *
 * ── Cómo agregar un nuevo motor de BD (e.g. MySQL) ───────────────
 *  1. Crear /dao/mysql/MySQLBaseDAO.js extendiendo BaseDAO.
 *  2. Crear los DAOs de entidad en /dao/mysql/entities/.
 *  3. Registrarlos en DAOFactory.js (solo ahí).
 *  4. Cambiar DB_ENGINE=mysql en .env.
 *  Ningún otro archivo se toca.
 * ─────────────────────────────────────────────────────────────────
 */
export class BaseDAO {
  /** @returns {Promise<Array>} */
  async findAll() {
    throw new Error(`${this.constructor.name} must implement findAll()`);
  }

  /**
   * @param {string|number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    throw new Error(`${this.constructor.name} must implement findById()`);
  }

  /**
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    throw new Error(`${this.constructor.name} must implement create()`);
  }

  /**
   * @param {string|number} id
   * @param {Object} data
   * @returns {Promise<Object|null>}
   */
  async update(id, data) {
    throw new Error(`${this.constructor.name} must implement update()`);
  }

  /**
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error(`${this.constructor.name} must implement delete()`);
  }

  /**
   * @param {Object} criteria — Pares clave-valor para filtrar.
   * @returns {Promise<Array>}
   */
  async findBy(criteria) {
    throw new Error(`${this.constructor.name} must implement findBy()`);
  }
}