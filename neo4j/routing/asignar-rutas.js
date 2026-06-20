// neo4j/routing/asignar-rutas.js
//
// Módulo de Asignación de Rutas de Entrega — Punto 6 del Proyecto 2
//
// Qué hace:
//  1. Lee pedidos pendientes (simulados con ubicación de cliente)
//  2. Distribuye los pedidos entre los repartidores disponibles
//  3. Para cada repartidor, calcula el orden óptimo de entrega
//     usando el algoritmo de vecino más cercano
//  4. Usa las distancias reales guardadas en Neo4J (relación CONECTA)
//  5. Imprime las rutas optimizadas y el total de km por repartidor
//
// Cómo correrlo:
//   docker compose -f deploy/local/docker/docker-compose.neo4j.yml \
//     --project-directory . exec neo4j-migrate node routing/asignar-rutas.js
//
// (o agregándolo como servicio aparte — ver más abajo)

import neo4j from 'neo4j-driver';
import fs from 'fs';

const NEO4J_URI      = process.env.NEO4J_URI      || 'bolt://neo4j:7687';
const NEO4J_USER     = process.env.NEO4J_USER     || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password123';

// ── Pedidos simulados con ubicación de cliente ─────────────────────
// En un sistema real esto vendría de la base de datos
// (pedidos pendientes con dirección del cliente geocodificada).
// Aquí se simula asignando una ubicación de las que ya existen en Neo4J.

const pedidosPendientes = [
  { id_pedido: 'P-1', cliente: 'María Pérez',   ubicacion: 'san-diego' },
  { id_pedido: 'P-2', cliente: 'Juan Mora',     ubicacion: 'la-union' },
  { id_pedido: 'P-3', cliente: 'Laura Jiménez', ubicacion: 'paraiso' },
  { id_pedido: 'P-4', cliente: 'Diego Rojas',   ubicacion: 'tres-rios' },
  { id_pedido: 'P-5', cliente: 'Ana Vargas',    ubicacion: 'san-rafael' },
  { id_pedido: 'P-6', cliente: 'Carlos Admin',  ubicacion: 'agua-caliente' },
];

// ── Cargar repartidores ────────────────────────────────────────────

function cargarRepartidores() {
  const data = fs.readFileSync(new URL('./repartidores.json', import.meta.url));
  return JSON.parse(data).repartidores;
}

// ── Distribuir pedidos entre repartidores de forma equilibrada ─────
// Reparto simple tipo round-robin: el pedido 1 va al repartidor 1,
// el pedido 2 al repartidor 2, etc. Cuando se acaban los repartidores
// vuelve a empezar desde el primero.

function distribuirPedidos(pedidos, repartidores) {
  const asignaciones = {};
  repartidores.forEach(r => asignaciones[r.id] = []);

  pedidos.forEach((pedido, index) => {
    const repartidor = repartidores[index % repartidores.length];
    asignaciones[repartidor.id].push(pedido);
  });

  return asignaciones;
}

// ── Obtener la distancia entre dos ubicaciones desde Neo4J ─────────
// Usa la relación CONECTA que ya existe en el grafo (creada en el
// punto 5). Si no hay conexión directa, usa Dijkstra para encontrar
// el camino más corto pasando por ubicaciones intermedias.

async function obtenerDistancia(session, origenId, destinoId) {
  // Primero intenta conexión directa
  const directa = await session.run(`
    MATCH (a:Ubicacion { id: $origen })-[c:CONECTA]-(b:Ubicacion { id: $destino })
    RETURN c.distancia_km AS distancia
  `, { origen: origenId, destino: destinoId });

  if (directa.records.length > 0) {
    return directa.records[0].get('distancia');
  }

  // Si no hay conexión directa, usa Dijkstra sobre el grafo proyectado
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

  // Si no se encuentra ninguna ruta, distancia muy alta para que
  // el algoritmo evite ese punto si es posible
  return 9999;
}

// ── Algoritmo de Vecino Más Cercano ─────────────────────────────────
// Dado un punto de partida y una lista de pedidos por visitar,
// encuentra el orden de visita que minimiza la distancia total,
// visitando siempre el punto más cercano no visitado todavía.

async function vecinoMasCercano(session, ubicacionInicial, pedidos) {
  const pendientes = [...pedidos];
  const ruta = [];
  let actual = ubicacionInicial;
  let distanciaTotal = 0;

  while (pendientes.length > 0) {
    let masCercano = null;
    let menorDistancia = Infinity;
    let indiceMasCercano = -1;

    // Buscar cuál pedido pendiente está más cerca de la ubicación actual
    for (let i = 0; i < pendientes.length; i++) {
      const distancia = await obtenerDistancia(session, actual, pendientes[i].ubicacion);
      if (distancia < menorDistancia) {
        menorDistancia  = distancia;
        masCercano      = pendientes[i];
        indiceMasCercano = i;
      }
    }

    // Visitar el más cercano encontrado
    ruta.push({ ...masCercano, distancia_desde_anterior: menorDistancia });
    distanciaTotal += menorDistancia;
    actual = masCercano.ubicacion;

    // Quitarlo de pendientes
    pendientes.splice(indiceMasCercano, 1);
  }

  return { ruta, distanciaTotal };
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n Iniciando asignación de rutas de entrega\n');

  const repartidores = cargarRepartidores();
  const driver  = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session();

  try {
    // Asegurar que el grafo proyectado existe para Dijkstra
    // Si ya existe, ignora el error y continúa
    try {
      await session.run(`
        CALL gds.graph.project(
          'rutasGraph',
          'Ubicacion',
          { CONECTA: { orientation: 'UNDIRECTED', properties: ['distancia_km', 'tiempo_min'] } }
        )
      `);
    } catch (e) {
      // El grafo ya existe, continuar normalmente
    }

    // Distribuir pedidos entre repartidores
    const asignaciones = distribuirPedidos(pedidosPendientes, repartidores);

    console.log(` Total de pedidos: ${pedidosPendientes.length}`);
    console.log(` Repartidores disponibles: ${repartidores.length}\n`);
    console.log('═'.repeat(60));

    // Para cada repartidor, calcular su ruta óptima
    for (const repartidor of repartidores) {
      const pedidosAsignados = asignaciones[repartidor.id];

      console.log(`\n Repartidor: ${repartidor.nombre} (${repartidor.id})`);
      console.log(`   Punto de partida: ${repartidor.ubicacion_base}`);
      console.log(`   Pedidos asignados: ${pedidosAsignados.length}`);

      if (pedidosAsignados.length === 0) {
        console.log('   Sin pedidos asignados.');
        continue;
      }

      const { ruta, distanciaTotal } = await vecinoMasCercano(
        session,
        repartidor.ubicacion_base,
        pedidosAsignados
      );

      console.log(`\n    Ruta optimizada (vecino más cercano):`);
      ruta.forEach((parada, index) => {
        console.log(`      ${index + 1}. ${parada.cliente} → ${parada.ubicacion} (+${parada.distancia_desde_anterior.toFixed(1)} km)`);
      });

      console.log(`\n    Distancia total recorrida: ${distanciaTotal.toFixed(1)} km`);
      console.log('-'.repeat(60));
    }

    console.log('\n Asignación de rutas completada\n');

  } finally {
    await session.close();
    await driver.close();
  }
}

main();