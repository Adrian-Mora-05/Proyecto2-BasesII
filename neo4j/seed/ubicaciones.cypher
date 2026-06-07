// neo4j/seed/ubicaciones.cypher
//
// Crea los nodos de ubicación y las conexiones entre ellas
// con distancia en km y tiempo estimado en minutos.
//
// Se carga UNA SOLA VEZ con:
//   docker compose -f deploy/local/docker/docker-compose.neo4j.yml \
//     --project-directory . exec neo4j \
//     cypher-shell -u neo4j -p password123 \
//     -f /var/lib/neo4j/import/ubicaciones.cypher
//
// Usa MERGE para no duplicar si se corre más de una vez.

// ── Nodos de Ubicación ────────────────────────────────────────────
// Zonas de la provincia de Cartago — donde están los restaurantes

MERGE (:Ubicacion { 
  id: 'cartago-centro', 
  nombre: 'Cartago Centro',
  lat: 9.8647, 
  lng: -83.9192 
});

MERGE (:Ubicacion { 
  id: 'tres-rios', 
  nombre: 'Tres Rios',
  lat: 9.9003, 
  lng: -83.9917 
});

MERGE (:Ubicacion { 
  id: 'la-union', 
  nombre: 'La Union',
  lat: 9.9086, 
  lng: -83.9614 
});

MERGE (:Ubicacion { 
  id: 'san-diego', 
  nombre: 'San Diego',
  lat: 9.8891, 
  lng: -83.9456 
});

MERGE (:Ubicacion { 
  id: 'paraiso', 
  nombre: 'Paraiso',
  lat: 9.8358, 
  lng: -83.8650 
});

MERGE (:Ubicacion { 
  id: 'el-tejar', 
  nombre: 'El Tejar',
  lat: 9.8514, 
  lng: -83.9758 
});

MERGE (:Ubicacion { 
  id: 'san-rafael', 
  nombre: 'San Rafael',
  lat: 9.9200, 
  lng: -83.9300 
});

MERGE (:Ubicacion { 
  id: 'agua-caliente', 
  nombre: 'Agua Caliente',
  lat: 9.8750, 
  lng: -83.9050 
});


// ── Conexiones entre ubicaciones ──────────────────────────────────
// Cada conexión tiene distancia_km y tiempo_min
// Se crean en ambas direcciones para poder ir y volver

// Cartago Centro ↔ San Diego
MATCH (a:Ubicacion { id: 'cartago-centro' })
MATCH (b:Ubicacion { id: 'san-diego' })
MERGE (a)-[:CONECTA { distancia_km: 3.2, tiempo_min: 8 }]->(b)
MERGE (b)-[:CONECTA { distancia_km: 3.2, tiempo_min: 8 }]->(a);

// Cartago Centro ↔ Agua Caliente
MATCH (a:Ubicacion { id: 'cartago-centro' })
MATCH (b:Ubicacion { id: 'agua-caliente' })
MERGE (a)-[:CONECTA { distancia_km: 2.5, tiempo_min: 6 }]->(b)
MERGE (b)-[:CONECTA { distancia_km: 2.5, tiempo_min: 6 }]->(a);

// Cartago Centro ↔ El Tejar
MATCH (a:Ubicacion { id: 'cartago-centro' })
MATCH (b:Ubicacion { id: 'el-tejar' })
MERGE (a)-[:CONECTA { distancia_km: 4.1, tiempo_min: 10 }]->(b)
MERGE (b)-[:CONECTA { distancia_km: 4.1, tiempo_min: 10 }]->(a);

// Cartago Centro ↔ Paraíso
MATCH (a:Ubicacion { id: 'cartago-centro' })
MATCH (b:Ubicacion { id: 'paraiso' })
MERGE (a)-[:CONECTA { distancia_km: 7.8, tiempo_min: 15 }]->(b)
MERGE (b)-[:CONECTA { distancia_km: 7.8, tiempo_min: 15 }]->(a);

// San Diego ↔ La Unión
MATCH (a:Ubicacion { id: 'san-diego' })
MATCH (b:Ubicacion { id: 'la-union' })
MERGE (a)-[:CONECTA { distancia_km: 4.5, tiempo_min: 10 }]->(b)
MERGE (b)-[:CONECTA { distancia_km: 4.5, tiempo_min: 10 }]->(a);

// San Diego ↔ Agua Caliente
MATCH (a:Ubicacion { id: 'san-diego' })
MATCH (b:Ubicacion { id: 'agua-caliente' })
MERGE (a)-[:CONECTA { distancia_km: 2.8, tiempo_min: 7 }]->(b)
MERGE (b)-[:CONECTA { distancia_km: 2.8, tiempo_min: 7 }]->(a);

// La Unión ↔ Tres Ríos
MATCH (a:Ubicacion { id: 'la-union' })
MATCH (b:Ubicacion { id: 'tres-rios' })
MERGE (a)-[:CONECTA { distancia_km: 3.9, tiempo_min: 9 }]->(b)
MERGE (b)-[:CONECTA { distancia_km: 3.9, tiempo_min: 9 }]->(a);

// La Unión ↔ San Rafael
MATCH (a:Ubicacion { id: 'la-union' })
MATCH (b:Ubicacion { id: 'san-rafael' })
MERGE (a)-[:CONECTA { distancia_km: 5.2, tiempo_min: 12 }]->(b)
MERGE (b)-[:CONECTA { distancia_km: 5.2, tiempo_min: 12 }]->(a);

// Tres Ríos ↔ San Rafael
MATCH (a:Ubicacion { id: 'tres-rios' })
MATCH (b:Ubicacion { id: 'san-rafael' })
MERGE (a)-[:CONECTA { distancia_km: 4.7, tiempo_min: 11 }]->(b)
MERGE (b)-[:CONECTA { distancia_km: 4.7, tiempo_min: 11 }]->(a);

// Agua Caliente ↔ Paraíso
MATCH (a:Ubicacion { id: 'agua-caliente' })
MATCH (b:Ubicacion { id: 'paraiso' })
MERGE (a)-[:CONECTA { distancia_km: 6.3, tiempo_min: 13 }]->(b)
MERGE (b)-[:CONECTA { distancia_km: 6.3, tiempo_min: 13 }]->(a);

// El Tejar ↔ San Rafael
MATCH (a:Ubicacion { id: 'el-tejar' })
MATCH (b:Ubicacion { id: 'san-rafael' })
MERGE (a)-[:CONECTA { distancia_km: 8.1, tiempo_min: 18 }]->(b)
MERGE (b)-[:CONECTA { distancia_km: 8.1, tiempo_min: 18 }]->(a);