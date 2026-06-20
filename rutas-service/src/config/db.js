// rutas-service/src/config/db.js
//
// Conexión a la base de datos — versión simple sin patrón DAO.
// Lee de PostgreSQL o MongoDB según DB_ENGINE, igual que el resto
// del sistema, pero aquí solo se necesita LECTURA de pedidos
// pendientes, no CRUD completo. Por eso no se justifica el DAO.

import pg from 'pg';
import { MongoClient } from 'mongodb';

const DB_ENGINE = process.env.DB_ENGINE || 'postgres';

let pgPool = null;
let mongoClient = null;
let mongoDb = null;

// ── PostgreSQL ──────────────────────────────────────────────────────

function getPgPool() {
  if (!pgPool) {
    pgPool = new pg.Pool({
      host:     process.env.DB_HOST,
      port:     process.env.DB_PORT,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
  }
  return pgPool;
}

// ── MongoDB ───────────────────────────────────────────────────────

async function getMongoDb() {
  if (!mongoDb) {
    mongoClient = new MongoClient(process.env.MONGO_URL);
    await mongoClient.connect();
    mongoDb = mongoClient.db(process.env.MONGO_DB);
  }
  return mongoDb;
}

// ── Leer pedidos pendientes ─────────────────────────────────────────
// Pendiente = id_estado_pedido 1 ("solicitado") en Postgres
// o estado: "solicitado" en Mongo

export async function leerPedidosPendientes() {
  if (DB_ENGINE === 'mongodb') {
    const db = await getMongoDb();
    const pedidos = await db.collection('pedidos')
      .find({ estado: 'solicitado' })
      .toArray();

    return pedidos.map(p => ({
      id_pedido: p._id.toString(),
      id_usuario: p.id_usuario,
      id_restaurante: p.id_restaurante,
      descripcion: p.descripcion,
    }));
  }

  // PostgreSQL
  const pool = getPgPool();
  const result = await pool.query(`
    SELECT p.id AS id_pedido, p.id_usuario, p.id_restaurante, p.descripcion,
           u.nombre AS cliente
    FROM restaurant.pedido p
    JOIN restaurant.usuario u ON p.id_usuario = u.id
    WHERE p.id_estado_pedido = (
      SELECT id FROM restaurant.estado_pedido WHERE nombre = 'solicitado'
    )
  `);

  return result.rows;
}

// ── Cerrar conexiones (para tests o shutdown limpio) ────────────────

export async function cerrarConexiones() {
  if (pgPool) await pgPool.end();
  if (mongoClient) await mongoClient.close();
}