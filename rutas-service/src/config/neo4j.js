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

export function getSession() {
  return driver.session();
}

export async function cerrarDriver() {
  await driver.close();
}

export default driver;