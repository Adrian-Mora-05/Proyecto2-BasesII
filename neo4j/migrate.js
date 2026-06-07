// neo4j/migrate.js
// Script de migración que lee datos de PostgreSQL o MongoDB
// y los carga en Neo4J como nodos y relaciones.
//
// Sigue el mismo patrón del Proyecto 1:
//   DB_ENGINE=postgres → lee de PostgreSQL
//   DB_ENGINE=mongodb  → lee de MongoDB
//
// Se ejecuta una sola vez y termina.
// Se puede correr múltiples veces sin duplicar datos
// porque usa MERGE en lugar de CREATE.
//
// Cómo correrlo:
//   docker compose -f deploy/local/docker/docker-compose.neo4j.yml \
//     --project-directory . run neo4j-migrate

import neo4j from 'neo4j-driver';
import pg    from 'pg';
import { MongoClient } from 'mongodb';

// ── Variables de entorno ───────────────────────────────────────────
// Todas vienen del .env a través del docker-compose.neo4j.yml
// No hay valores hardcodeados aquí por seguridad

const DB_ENGINE = process.env.DB_ENGINE;

// Neo4J
const NEO4J_URI      = process.env.NEO4J_URI;
const NEO4J_USER     = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

// PostgreSQL
const PG_HOST     = process.env.PG_HOST;
const PG_PORT     = process.env.PG_PORT;
const PG_USER     = process.env.PG_USER;
const PG_PASSWORD = process.env.PG_PASSWORD;
const PG_DB       = process.env.PG_DB;

// MongoDB
const MONGO_URL = process.env.MONGO_URL;
const MONGO_DB  = process.env.MONGO_DB;

// ── Validar que las variables necesarias existen ───────────────────
function validarVariables() {
  const requeridas = ['DB_ENGINE', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD'];

  if (DB_ENGINE === 'postgres') {
    requeridas.push('PG_HOST', 'PG_PORT', 'PG_USER', 'PG_PASSWORD', 'PG_DB');
  } else {
    requeridas.push('MONGO_URL', 'MONGO_DB');
  }

  const faltantes = requeridas.filter(v => !process.env[v]);

  if (faltantes.length > 0) {
    console.error(`❌ Variables de entorno faltantes: ${faltantes.join(', ')}`);
    console.error('Verifica que el .env tiene todas las variables necesarias.');
    process.exit(1);
  }
}
// ── Leer datos de PostgreSQL ───────────────────────────────────────

async function leerDePostgres() {
  console.log('Conectando a PostgreSQL...');

  const pool = new pg.Pool({
    host:     PG_HOST,
    port:     PG_PORT,
    user:     PG_USER,
    password: PG_PASSWORD,
    database: PG_DB,
  });

  try {
    // Leer usuarios
    const usuariosRes = await pool.query(`
      SELECT u.id, u.nombre, u.correo, r.nombre AS rol
      FROM restaurant.usuario u
      JOIN restaurant.rol_usuario r ON u.id_rol_usuario = r.id
    `);

    // Leer restaurantes
    const restaurantesRes = await pool.query(`
      SELECT id, nombre, direccion, telefono
      FROM restaurant.restaurante
    `);

    // Leer platos con su categoría y menú
    const platosRes = await pool.query(`
      SELECT p.id, p.nombre, p.precio, p.categoria,
             p.descripcion, p.id_menu, m.id_restaurante
      FROM restaurant.plato p
      JOIN restaurant.menu m ON p.id_menu = m.id
    `);

    // Leer pedidos
    const pedidosRes = await pool.query(`
      SELECT id, id_usuario, id_restaurante, descripcion
      FROM restaurant.pedido
    `);

    // Leer relación pedido-plato
    const pedidoPlatoRes = await pool.query(`
      SELECT id_pedido, id_plato, cantidad
      FROM restaurant.plato_x_pedido
    `);

    await pool.end();

    console.log(`PostgreSQL — usuarios: ${usuariosRes.rows.length}, restaurantes: ${restaurantesRes.rows.length}, platos: ${platosRes.rows.length}, pedidos: ${pedidosRes.rows.length}`);

    return {
      usuarios:     usuariosRes.rows,
      restaurantes: restaurantesRes.rows,
      platos:       platosRes.rows,
      pedidos:      pedidosRes.rows,
      pedidoPlatos: pedidoPlatoRes.rows,
    };

  } catch (error) {
    await pool.end();
    throw error;
  }
}

// ── Leer datos de MongoDB ──────────────────────────────────────────

async function leerDeMongo() {
  console.log('Conectando a MongoDB...');

  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(MONGO_DB);

  try {
    // Leer usuarios
    const usuarios = await db.collection('usuarios').find({}).toArray();

    // Leer restaurantes
    const restaurantes = await db.collection('restaurantes').find({}).toArray();

    // Leer platos
    const platos = await db.collection('platos').find({}).toArray();

    // Leer pedidos
    const pedidos = await db.collection('pedidos').find({}).toArray();

    await client.close();

    // Normalizar IDs de MongoDB (ObjectId → string)
    // para que sean compatibles con Neo4J
    const normalizar = (doc) => ({
      ...doc,
      id: doc._id.toString(),
      id_usuario:     doc.id_usuario?.toString(),
      id_restaurante: doc.id_restaurante?.toString(),
      id_menu:        doc.id_menu?.toString(),
    });

    // Extraer relaciones pedido-plato desde los pedidos de MongoDB
    // En MongoDB los platos están embebidos dentro del pedido
    const pedidoPlatos = [];
    for (const pedido of pedidos) {
      if (pedido.platos && Array.isArray(pedido.platos)) {
        for (const plato of pedido.platos) {
          pedidoPlatos.push({
            id_pedido: pedido._id.toString(),
            id_plato:  plato.id_plato?.toString(),
            cantidad:  plato.cantidad,
          });
        }
      }
    }

    console.log(`MongoDB — usuarios: ${usuarios.length}, restaurantes: ${restaurantes.length}, platos: ${platos.length}, pedidos: ${pedidos.length}`);

    return {
      usuarios:     usuarios.map(normalizar),
      restaurantes: restaurantes.map(normalizar),
      platos:       platos.map(normalizar),
      pedidos:      pedidos.map(normalizar),
      pedidoPlatos,
    };

  } catch (error) {
    await client.close();
    throw error;
  }
}

// ── Cargar datos en Neo4J ──────────────────────────────────────────
// Esta función es igual para ambos motores de BD.
// Recibe los datos ya normalizados y los carga en Neo4J.

async function cargarEnNeo4J({ usuarios, restaurantes, platos, pedidos, pedidoPlatos }) {
  console.log('Conectando a Neo4J...');

  const driver  = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session();

  try {

    // ── 1. Crear nodos Usuario ───────────────────────────────────
    console.log('Creando nodos Usuario...');
    for (const u of usuarios) {
      await session.run(`
        MERGE (u:Usuario { id: $id })
        SET u.nombre = $nombre,
            u.correo = $correo,
            u.rol    = $rol
      `, {
        id:     String(u.id),
        nombre: u.nombre || 'Sin nombre',
        correo: u.correo || '',
        rol:    u.rol    || 'cliente',
      });
    }
    console.log(`  ${usuarios.length} usuarios creados`);

    // ── 2. Crear nodos Restaurante ───────────────────────────────
    console.log('Creando nodos Restaurante...');
    for (const r of restaurantes) {
      await session.run(`
        MERGE (r:Restaurante { id: $id })
        SET r.nombre    = $nombre,
            r.direccion = $direccion,
            r.telefono  = $telefono
      `, {
        id:        String(r.id),
        nombre:    r.nombre    || 'Sin nombre',
        direccion: r.direccion || '',
        telefono:  r.telefono  || '',
      });
    }
    console.log(`  ${restaurantes.length} restaurantes creados`);

    // ── 3. Crear nodos Plato ─────────────────────────────────────
    console.log('Creando nodos Plato...');
    for (const p of platos) {
      await session.run(`
        MERGE (p:Plato { id: $id })
        SET p.nombre       = $nombre,
            p.precio       = $precio,
            p.categoria    = $categoria,
            p.descripcion  = $descripcion,
            p.id_restaurante = $id_restaurante
      `, {
        id:             String(p.id),
        nombre:         p.nombre      || 'Sin nombre',
        precio:         p.precio      || 0,
        categoria:      p.categoria   || 'sin categoria',
        descripcion:    p.descripcion || 'Producto sin descripción',
        id_restaurante: String(p.id_restaurante || ''),
      });
    }
    console.log(`  ${platos.length} platos creados`);

    // ── 4. Crear nodos Pedido ────────────────────────────────────
    console.log('Creando nodos Pedido...');
    for (const p of pedidos) {
      await session.run(`
        MERGE (p:Pedido { id: $id })
        SET p.descripcion    = $descripcion,
            p.id_restaurante = $id_restaurante
      `, {
        id:             String(p.id),
        descripcion:    p.descripcion    || '',
        id_restaurante: String(p.id_restaurante || ''),
      });
    }
    console.log(`  ${pedidos.length} pedidos creados`);

    // ── 5. Relación Usuario -[HIZO]-> Pedido ─────────────────────
    console.log('Creando relaciones HIZO...');
    for (const p of pedidos) {
      if (!p.id_usuario) continue;
      await session.run(`
        MATCH (u:Usuario { id: $userId })
        MATCH (p:Pedido  { id: $pedidoId })
        MERGE (u)-[:HIZO]->(p)
      `, {
        userId:   String(p.id_usuario),
        pedidoId: String(p.id),
      });
    }
    console.log(`  ${pedidos.length} relaciones HIZO creadas`);

    // ── 6. Relación Pedido -[CONTIENE]-> Plato ───────────────────
    console.log('Creando relaciones CONTIENE...');
    for (const pp of pedidoPlatos) {
      if (!pp.id_pedido || !pp.id_plato) continue;
      await session.run(`
        MATCH (ped:Pedido { id: $pedidoId })
        MATCH (pla:Plato  { id: $platoId })
        MERGE (ped)-[r:CONTIENE]->(pla)
        SET r.cantidad = $cantidad
      `, {
        pedidoId: String(pp.id_pedido),
        platoId:  String(pp.id_plato),
        cantidad: pp.cantidad || 1,
      });
    }
    console.log(`  ${pedidoPlatos.length} relaciones CONTIENE creadas`);

    // ── 7. Relación Pedido -[ES_DE]-> Restaurante ────────────────
    console.log('Creando relaciones ES_DE...');
    for (const p of pedidos) {
      if (!p.id_restaurante) continue;
      await session.run(`
        MATCH (ped:Pedido      { id: $pedidoId })
        MATCH (r:Restaurante   { id: $restId })
        MERGE (ped)-[:ES_DE]->(r)
      `, {
        pedidoId: String(p.id),
        restId:   String(p.id_restaurante),
      });
    }
    console.log(`  ${pedidos.length} relaciones ES_DE creadas`);

    // ── 8. Relaciones RECOMIENDA simuladas ───────────────────────
    // Como no hay datos reales de recomendaciones en el sistema,
    // se crean relaciones simuladas entre usuarios para
    // demostrar la funcionalidad del grafo.
    // En producción esto vendría de datos reales.
    console.log('Creando relaciones RECOMIENDA simuladas...');
    if (usuarios.length >= 2) {
      for (let i = 0; i < usuarios.length - 1; i++) {
        // Cada usuario recomienda al siguiente
        // Solo si ambos son clientes
        if (usuarios[i].rol === 'cliente' && usuarios[i+1].rol === 'cliente') {
          await session.run(`
            MATCH (u1:Usuario { id: $id1 })
            MATCH (u2:Usuario { id: $id2 })
            MERGE (u1)-[:RECOMIENDA]->(u2)
          `, {
            id1: String(usuarios[i].id),
            id2: String(usuarios[i+1].id),
          });
        }
      }
    }
    console.log('  Relaciones RECOMIENDA creadas');

    console.log('\n Migración completada exitosamente');

  } finally {
    await session.close();
    await driver.close();
  }
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log(`\n Iniciando migración con motor: ${DB_ENGINE}\n`);
    // Validar variables antes de intentar conectar
  validarVariables();

  
  try {
    // Leer datos según el motor configurado
    let datos;
    if (DB_ENGINE === 'mongodb') {
      datos = await leerDeMongo();
    } else {
      datos = await leerDePostgres();
    }

    // Cargar en Neo4J — igual para ambos motores
    await cargarEnNeo4J(datos);

  } catch (error) {
    console.error('\n Error durante la migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();