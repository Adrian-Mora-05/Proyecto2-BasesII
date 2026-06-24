// neo4j/queries/usuarios-influyentes.cypher
//
// Encuentra los usuarios que más recomiendan a otros usuarios.
// Útil para identificar usuarios influyentes en el sistema.
//
// Las relaciones RECOMIENDA se crean en la migración.
// En este proyecto son simuladas porque el sistema no tiene
// un módulo de recomendaciones real. En producción vendrían
// de datos reales como referidos o invitaciones.
//(Usuario)-[HIZO]->(Pedido)
//(Pedido)-[CONTIENE]->(Plato)
//(Pedido)-[ES_DE]->(Restaurante)
//(Usuario)-[RECOMIENDA]->(Usuario)
// Cómo correrla en Neo4J Browser:
//   Copiar y pegar en http://localhost:7474

MATCH (u1:Usuario)-[:RECOMIENDA]->(u2:Usuario)
RETURN
  u1.nombre                    AS usuario_influyente,
  u1.correo                    AS correo,
  COUNT(u2)                    AS total_recomendados,
  COLLECT(u2.nombre)           AS recomienda_a
ORDER BY total_recomendados DESC
LIMIT 10;