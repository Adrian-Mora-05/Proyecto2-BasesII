/**
 * DAOFactory — El único lugar del sistema donde se decide qué motor de BD usar.
 *
 * ─────────────────────────────────────────────────────────────────
 *  ÚNICO IF DEL SISTEMA RELACIONADO A LA BD
 *  Se evalúa una sola vez al arrancar en app.js.
 *  Todo el resto del código es 100% agnóstico al motor.
 * ─────────────────────────────────────────────────────────────────
 *
 * Principios SOLID:
 *  - OCP: Para agregar un motor nuevo, solo se añade una entrada en `drivers`.
 *  - DIP: Los servicios reciben DAOs a través de esta fábrica; nunca instancian
 *          implementaciones concretas directamente.
 *
 * ── Cómo agregar soporte a un nuevo motor (e.g. MySQL) ───────────
 *  1. Crear /dao/mysql/MySQLBaseDAO.js extendiendo BaseDAO.
 *  2. Crear los DAOs de entidad en /dao/mysql/entities/.
 *  3. Importarlos aquí y añadir una entrada en `drivers`.
 *  4. Cambiar DB_ENGINE=mysql en .env.
 *  Ningún otro archivo se modifica.
 * ─────────────────────────────────────────────────────────────────
 */

// ── Entidades Postgres ────────────────────────────────────────────
import { RestaurantDAOPostgres }  from './postgres/entities/RestaurantDAOPostgres.js';
import { MenuDAOPostgres }        from './postgres/entities/MenuDAOPostgres.js';
import { ReservationDAOPostgres } from './postgres/entities/ReservationDAOPostgres.js';
import { OrderDAOPostgres }       from './postgres/entities/OrderDAOPostgres.js';
import { UserDAOPostgres }        from './postgres/entities/UserDAOPostgres.js';

// ── Entidades MongoDB ─────────────────────────────────────────────
import { RestaurantDAOMongo }  from './mongodb/entities/RestaurantDAOMongo.js';
import { MenuDAOMongo }        from './mongodb/entities/MenuDAOMongo.js';
import { ReservationDAOMongo } from './mongodb/entities/ReservationDAOMongo.js';
import { OrderDAOMongo }       from './mongodb/entities/OrderDAOMongo.js';
import { UserDAOMongo }        from './mongodb/entities/UserDAOMongo.js';

// ── Registro de drivers ───────────────────────────────────────────
// Cada entrada mapea un nombre de entidad a una función constructora
// que recibe la conexión (pool o db) y devuelve la instancia del DAO.
const drivers = {
  postgres: {
    restaurant:  (conn) => new RestaurantDAOPostgres(conn),
    menu:        (conn) => new MenuDAOPostgres(conn),
    reservation: (conn) => new ReservationDAOPostgres(conn),
    order:       (conn) => new OrderDAOPostgres(conn),
    user:        (conn) => new UserDAOPostgres(conn),
  },
  mongodb: {
    restaurant:  (conn) => new RestaurantDAOMongo(conn),
    menu:        (conn) => new MenuDAOMongo(conn),
    reservation: (conn) => new ReservationDAOMongo(conn),
    order:       (conn) => new OrderDAOMongo(conn),
    user:        (conn) => new UserDAOMongo(conn),
  },

};

export class DAOFactory {
  /**
   * @param {string} engine     — Valor de DB_ENGINE ('postgres' | 'mongodb').
   * @param {Object} connection — Pool de pg o instancia db de Mongo.
   */
  constructor(engine, connection) {
    if (!drivers[engine]) {
      throw new Error(
        `Motor de BD no soportado: "${engine}". ` +
        `Disponibles: ${Object.keys(drivers).join(', ')}`
      );
    }
    // ──────────────────────────────────────────────────────────────

    this._driver = drivers[engine];
    this._conn   = connection;
    this._cache  = {};  // Un DAO por entidad — no se instancia dos veces
  }

  /**
   * Devuelve el DAO de la entidad solicitada.
   * El resultado se cachea para reutilizar la misma instancia.
   *
   * @param {'restaurant'|'menu'|'reservation'|'order'|'user'} entity
   * @returns {import('./interfaces/BaseDAO.js').BaseDAO}
   */
  getDAO(entity) {
    if (!this._driver[entity]) {
      throw new Error(
        `Entidad "${entity}" no registrada para el motor actual.`
      );
    }
    if (!this._cache[entity]) {
      this._cache[entity] = this._driver[entity](this._conn);
    }
    return this._cache[entity];
  }
}