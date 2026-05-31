import { BaseDAO } from '../interfaces/BaseDAO.js';

/**
 * PostgresBaseDAO — Implementación base para PostgreSQL.
 *
 * Encapsula toda la interacción con Postgres de forma genérica.
 * Recibe el pool por inyección de dependencias desde DAOFactory.
 *
 * Los DAOs de entidad solo heredan esta clase e indican su tabla.
 * Si necesitan lógica específica (e.g. stored procedures, JOINs),
 * sobreescriben el método correspondiente o añaden métodos propios.
 *
 * NOTA: Los stored procedures del schema SQL existente se llaman
 * desde los DAOs de entidad, no desde aquí, para mantener SRP.
 */
export class PostgresBaseDAO extends BaseDAO {
  /**
   * @param {import('pg').Pool} pool — Pool de conexiones inyectado.
   * @param {string} tableName — Nombre de la tabla (e.g. 'restaurant.menus').
   * @param {string} [primaryKey='id'] — Columna de clave primaria.
   */
  constructor(pool, tableName, primaryKey = 'id') {
    super();
    if (!pool)      throw new Error('PostgresBaseDAO requiere un pool');
    if (!tableName) throw new Error('PostgresBaseDAO requiere un tableName');
    this.pool       = pool;
    this.tableName  = tableName;
    this.primaryKey = primaryKey;
  }

  /**
   * Ejecuta una query SQL con parámetros usando el pool.
   * Adquiere y libera el cliente automáticamente.
   *
   * @param {string} text — Query SQL parametrizada.
   * @param {Array}  [params=[]] — Valores de los parámetros.
   * @returns {Promise<import('pg').QueryResult>}
   */
  async _query(text, params = []) {
    const client = await this.pool.connect();
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  }

  // ── Implementaciones del contrato BaseDAO ──────────────────────

  async findAll() {
    const result = await this._query(
      `SELECT * FROM ${this.tableName}`
    );
    return result.rows;
  }

  async findById(id) {
    const result = await this._query(
      `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Inserción genérica. Los DAOs de entidad pueden sobreescribir
   * este método para usar stored procedures específicos.
   *
   * @param {Object} data — Objeto con las columnas y valores a insertar.
   */
  async create(data) {
    const keys         = Object.keys(data);
    const values       = Object.values(data);
    const columns      = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const result = await this._query(
      `INSERT INTO ${this.tableName} (${columns})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  /**
   * Actualización genérica por clave primaria.
   *
   * @param {string|number} id
   * @param {Object} data — Campos a actualizar.
   */
  async update(id, data) {
    const keys      = Object.keys(data);
    const values    = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    const result = await this._query(
      `UPDATE ${this.tableName}
       SET ${setClause}
       WHERE ${this.primaryKey} = $${keys.length + 1}
       RETURNING *`,
      [...values, id]
    );
    return result.rows[0] ?? null;
  }

  async delete(id) {
    const result = await this._query(
      `DELETE FROM ${this.tableName}
       WHERE ${this.primaryKey} = $1`,
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Búsqueda por múltiples criterios (AND entre todos).
   *
   * @param {Object} criteria — Pares { columna: valor }.
   */
  async findBy(criteria) {
    const keys        = Object.keys(criteria);
    const values      = Object.values(criteria);
    const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');

    const result = await this._query(
      `SELECT * FROM ${this.tableName} WHERE ${whereClause}`,
      values
    );
    return result.rows;
  }
}