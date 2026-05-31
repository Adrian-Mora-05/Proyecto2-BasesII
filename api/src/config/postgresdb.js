import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;

/**
 * pool — Instancia única del Pool de conexiones PostgreSQL.
 *
 * Se exporta para inyectarlo en PostgresBaseDAO a través de DAOFactory.
 * Esto permite mockear el pool en tests sin tocar la lógica de negocio.
 */
export const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

/**
 * query — Atajo para queries directas fuera del patrón DAO.
 * Se mantiene por compatibilidad con código existente que lo use.
 * Los DAOs NO deben usar esto; deben recibir el pool por inyección.
 */
export const query = (text, params) => pool.query(text, params);