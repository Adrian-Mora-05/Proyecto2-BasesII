// rutas-service/src/services/grafos.service.js
//
// Lógica del Punto 5 del enunciado — Análisis de Grafos.
// Contiene las consultas Cypher para:
//   - Los 5 productos más comprados juntos (co-compra)
//   - Usuarios que recomiendan a otros (influyentes)
//   - Caminos mínimos entre ubicaciones (Dijkstra)

import { getSession } from '../config/neo4j.js';

// ── Co-compras ──────────────────────────────────────────────────────

export async function obtenerCoCompras() {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (p1:Plato)<-[:CONTIENE]-(ped:Pedido)-[:CONTIENE]->(p2:Plato)
      WHERE id(p1) < id(p2)
      RETURN 
        p1.nombre  AS producto1,
        p2.nombre  AS producto2,
        COUNT(ped) AS vecesJuntos
      ORDER BY vecesJuntos DESC
      LIMIT 5
    `);

    return result.records.map(r => ({
      producto1:    r.get('producto1'),
      producto2:    r.get('producto2'),
      vecesJuntos:  r.get('vecesJuntos').toNumber(),
    }));
  } finally {
    await session.close();
  }
}

// ── Usuarios influyentes ────────────────────────────────────────────

export async function obtenerUsuariosInfluyentes() {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (u1:Usuario)-[:RECOMIENDA]->(u2:Usuario)
      RETURN
        u1.nombre          AS usuario,
        COUNT(u2)          AS totalRecomendados,
        COLLECT(u2.nombre) AS recomiendaA
      ORDER BY totalRecomendados DESC
    `);

    return result.records.map(r => ({
      usuario:           r.get('usuario'),
      totalRecomendados: r.get('totalRecomendados').toNumber(),
      recomiendaA:       r.get('recomiendaA'),
    }));
  } finally {
    await session.close();
  }
}

// ── Asegurar que el grafo proyectado para Dijkstra existe ──────────
// Se llama internamente antes de cualquier cálculo de camino mínimo.

async function asegurarGrafoProyectado(session) {
  try {
    await session.run(`
      CALL gds.graph.project(
        'rutasGraph',
        'Ubicacion',
        { CONECTA: { orientation: 'UNDIRECTED', properties: ['distancia_km', 'tiempo_min'] } }
      )
    `);
  } catch (error) {
    // Si ya existe, Neo4J lanza un error — lo ignoramos a propósito
    if (!error.message.includes('already exists')) {
      throw error;
    }
  }
}

// ── Camino mínimo entre dos ubicaciones ─────────────────────────────

export async function obtenerCaminoMinimo(origenId, destinoId, criterio = 'distancia_km') {
  const session = getSession();
  try {
    

    const result = await session.run(`
      MATCH (inicio:Ubicacion { id: $origen })
      MATCH (fin:Ubicacion    { id: $destino })
      CALL gds.shortestPath.dijkstra.stream('rutasGraph', {
        sourceNode: inicio,
        targetNode: fin,
        relationshipWeightProperty: $criterio
      })
      YIELD nodeIds, costs
      RETURN
        [id IN nodeIds | gds.util.asNode(id).id] AS paradas,
        costs[-1] AS costoTotal
    `, { origen: origenId, destino: destinoId, criterio });

    if (result.records.length === 0) {
      return null;
    }

    return {
      paradas:    result.records[0].get('paradas'),
      costoTotal: result.records[0].get('costoTotal'),
    };
  } finally {
    await session.close();
  }
}

// ── Distancia directa o vía Dijkstra entre dos ubicaciones ──────────
// Usado internamente por rutas.service.js para el algoritmo
// de vecino más cercano.

export async function obtenerDistancia(origenId, destinoId) {
  const session = getSession();
  try {
    // Intento 1 — conexión directa
    const directa = await session.run(`
      MATCH (a:Ubicacion { id: $origen })-[c:CONECTA]-(b:Ubicacion { id: $destino })
      RETURN c.distancia_km AS distancia
    `, { origen: origenId, destino: destinoId });

    if (directa.records.length > 0) {
      return directa.records[0].get('distancia');
    }

    // Intento 2 — Dijkstra si no hay conexión directa
    

    const dijkstra = await session.run(`
      MATCH (inicio:Ubicacion { id: $origen })
      MATCH (fin:Ubicacion    { id: $destino })
      CALL gds.shortestPath.dijkstra.stream('rutasGraph', {
        sourceNode: inicio,
        targetNode: fin,
        relationshipWeightProperty: 'distancia_km'
      })
      YIELD costs
      RETURN costs[-1] AS distancia
    `, { origen: origenId, destino: destinoId });

    if (dijkstra.records.length > 0) {
      return dijkstra.records[0].get('distancia');
    }

    return 9999; // sin ruta encontrada
  } finally {
    await session.close();
  }
}

// ── Obtener todas las ubicaciones disponibles ────────────────────────
// Usado para asignar ubicaciones simuladas a los pedidos.

export async function obtenerUbicaciones() {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (u:Ubicacion) RETURN u.id AS id, u.nombre AS nombre
    `);
    return result.records.map(r => ({
      id:     r.get('id'),
      nombre: r.get('nombre'),
    }));
  } finally {
    await session.close();
  }
}

// ── Camino completo con paradas intermedias ──────────────────────
// A diferencia de obtenerDistancia() que solo devuelve el número,
// esta función devuelve el camino completo: todos los nodos por
// los que pasa el repartidor para ir de un punto a otro.

export async function obtenerCaminoCompleto(origenId, destinoId) {
  const session = getSession();
  try {
    

    // Intento 1 — conexión directa (no hay paradas intermedias)
    const directa = await session.run(`
      MATCH (a:Ubicacion { id: $origen })-[c:CONECTA]-(b:Ubicacion { id: $destino })
      RETURN c.distancia_km AS distancia
    `, { origen: origenId, destino: destinoId });

    if (directa.records.length > 0) {
      return {
        paradas: [origenId, destinoId],
        distancia_km: directa.records[0].get('distancia'),
        conexion_directa: true
      };
    }

    // Intento 2 — Dijkstra con paradas intermedias
    const result = await session.run(`
      MATCH (inicio:Ubicacion { id: $origen })
      MATCH (fin:Ubicacion    { id: $destino })
      CALL gds.shortestPath.dijkstra.stream('rutasGraph', {
        sourceNode: inicio,
        targetNode: fin,
        relationshipWeightProperty: 'distancia_km'
      })
      YIELD nodeIds, costs
      RETURN
        [id IN nodeIds | gds.util.asNode(id).id]     AS paradas,
        [id IN nodeIds | gds.util.asNode(id).nombre] AS nombresParadas,
        costs[-1] AS distancia_km
    `, { origen: origenId, destino: destinoId });

    if (result.records.length === 0) {
      return {
        paradas: [origenId, destinoId],
        distancia_km: 9999,
        conexion_directa: false
      };
    }

    return {
      paradas:         result.records[0].get('paradas'),
      nombresParadas:  result.records[0].get('nombresParadas'),
      distancia_km:    result.records[0].get('distancia_km'),
      conexion_directa: false
    };

  } finally {
    await session.close();
  }
}