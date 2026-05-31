// data/postgres/product.postgres.js

import pkg from 'pg';
const { Pool } = pkg;

export class PostgresProductRepository {
  async findAll() {
    const pool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    try {
        const result = await pool.query(`
        SELECT 
            p.id,
            p.nombre,
            p.descripcion,
            p.precio,
            m.id_restaurante,
            COALESCE(p.categoria, 'Sin categoría') as categoria
        FROM restaurant.plato p
        JOIN restaurant.menu m ON p.id_menu = m.id
        `);
      return result.rows;
    } finally {
      await pool.end();
    }
  }
}