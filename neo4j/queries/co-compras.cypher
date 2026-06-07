// neo4j/queries/co-compras.cypher
//
// Encuentra los 5 pares de platos que más se piden juntos.
// Útil para hacer recomendaciones: "los que pidieron X también pidieron Y"
//
// Cómo funciona:
//   Busca todos los pedidos que contienen al menos 2 platos.
//   Cuenta cuántas veces aparece cada par juntos en un pedido.
//   Ordena de mayor a menor y muestra los 5 primeros.
//
// Cómo correrla en Neo4J Browser:
//   Copiar y pegar en http://localhost:7474

MATCH (p1:Plato)<-[:CONTIENE]-(ped:Pedido)-[:CONTIENE]->(p2:Plato)
// id(p1) < id(p2) evita contar el mismo par dos veces
// (p1,p2) y (p2,p1) son el mismo par
WHERE id(p1) < id(p2)
RETURN 
  p1.nombre        AS producto_1,
  p2.nombre        AS producto_2,
  p1.categoria     AS categoria_1,
  p2.categoria     AS categoria_2,
  COUNT(ped)       AS veces_juntos
ORDER BY veces_juntos DESC
LIMIT 5;