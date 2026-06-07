// neo4j/queries/camino-minimo.cypher
//
// Encuentra el camino más corto entre dos ubicaciones
// usando el algoritmo de Dijkstra del plugin Graph Data Science.
//
// IMPORTANTE: Antes de correr esta consulta hay que proyectar
// el grafo en memoria con gds.graph.project (ver abajo).
//
// ── Paso 1: Proyectar el grafo ────────────────────────────────────
// Solo hay que correrlo una vez por sesión de Neo4J.
// Si ya está proyectado dará error — ignorarlo y pasar al Paso 2.

CALL gds.graph.project(
  'rutasGraph',
  'Ubicacion',
  {
    CONECTA: {
      orientation: 'UNDIRECTED',
      properties: ['distancia_km', 'tiempo_min']
    }
  }
);

// ── Paso 2: Encontrar camino mínimo por distancia ─────────────────
// Cambia los nombres de origen y destino según necesites.

MATCH (inicio:Ubicacion { id: 'cartago-centro' })
MATCH (fin:Ubicacion    { id: 'tres-rios' })
CALL gds.shortestPath.dijkstra.stream('rutasGraph', {
  sourceNode:                 inicio,
  targetNode:                 fin,
  relationshipWeightProperty: 'distancia_km'
})
YIELD nodeIds, costs
RETURN
  [id IN nodeIds | gds.util.asNode(id).id] AS paradas,
  costs[-1]                                 AS km_totales,
  SIZE(nodeIds) - 1                         AS cantidad_paradas;


// ── Paso 3 (opcional): Camino mínimo por tiempo ───────────────────

MATCH (inicio:Ubicacion { id: 'cartago-centro' })
MATCH (fin:Ubicacion    { id: 'tres-rios' })
CALL gds.shortestPath.dijkstra.stream('rutasGraph', {
  sourceNode:                 inicio,
  targetNode:                 fin,
  relationshipWeightProperty: 'tiempo_min'
})
YIELD nodeIds, costs
RETURN
  [id IN nodeIds | gds.util.asNode(id).id] AS paradas,
  costs[-1]                                 AS minutos_totales,
  SIZE(nodeIds) - 1                         AS cantidad_paradas;

// ── Limpiar cuando ya no se necesite ─────────────────────────────
// CALL gds.graph.drop('rutasGraph');