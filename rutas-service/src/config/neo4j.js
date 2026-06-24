// rutas-service/src/config/neo4j.js
//
// Conexión a Neo4J usando el driver oficial bolt.
// Se reutiliza una sola instancia del driver en todo el servicio.

import neo4j from 'neo4j-driver';

const NEO4J_URI      = process.env.NEO4J_URI;
const NEO4J_USER     = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
);

// ── Proyectar el grafo de rutas una sola vez al arrancar ──────────
// Esto evita proyectarlo en cada consulta, que es muy lento.

export async function inicializarGrafo() {
  const session = driver.session();
  try {
    // Intentar borrar si ya existe (por si hubo un reinicio)
    try {
      await session.run(`CALL gds.graph.drop('rutasGraph')`);
    } catch (e) {
      // No existía, ignorar
    }

    // Proyectar el grafo en memoria
    await session.run(`
      CALL gds.graph.project(
        'rutasGraph',
        'Ubicacion',
        {
          CONECTA: {
            orientation: 'UNDIRECTED',
            properties: ['distancia_km', 'tiempo_min']
          }
        }
      )
    `);
    console.log(' Grafo rutasGraph proyectado en Neo4J');
  } catch (e) {
    console.error('Error proyectando grafo:', e.message);
  } finally {
    await session.close();
  }
}

export function getSession() {
  return driver.session();
}

export async function cerrarDriver() {
  await driver.close();
}

export default driver;