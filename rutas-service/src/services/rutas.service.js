// rutas-service/src/services/rutas.service.js
//
// Lógica del Punto 6 del enunciado — Asignación de Rutas de Entrega.
// Usa grafos.service.js para las distancias y aplica el algoritmo
// de vecino más cercano para optimizar el orden de visita.

import { leerPedidosPendientes } from '../config/db.js';
import { obtenerDistancia, obtenerUbicaciones } from './grafos.service.js';

// ── Asignar una ubicación simulada a cada pedido ────────────────────
// Como no hay geolocalización real de clientes, se simula
// asignando una ubicación aleatoria de las que existen en Neo4J.

async function simularUbicacionesDePedidos(pedidos) {
  const ubicaciones = await obtenerUbicaciones();

  return pedidos.map(pedido => {
    const ubicacionAleatoria = ubicaciones[Math.floor(Math.random() * ubicaciones.length)];
    return {
      ...pedido,
      ubicacion: ubicacionAleatoria.id,
      ubicacionNombre: ubicacionAleatoria.nombre,
    };
  });
}

// ── Distribuir pedidos entre repartidores (round-robin) ─────────────

function distribuirPedidos(pedidos, repartidores) {
  const asignaciones = {};
  repartidores.forEach(r => asignaciones[r.id] = []);

  pedidos.forEach((pedido, index) => {
    const repartidor = repartidores[index % repartidores.length];
    asignaciones[repartidor.id].push(pedido);
  });

  return asignaciones;
}

// ── Algoritmo de Vecino Más Cercano ─────────────────────────────────

async function vecinoMasCercano(ubicacionInicial, pedidos) {
  const pendientes = [...pedidos];
  const ruta = [];
  let actual = ubicacionInicial;
  let distanciaTotal = 0;

  while (pendientes.length > 0) {
    let masCercano = null;
    let menorDistancia = Infinity;
    let indiceMasCercano = -1;

    for (let i = 0; i < pendientes.length; i++) {
      const distancia = await obtenerDistancia(actual, pendientes[i].ubicacion);
      if (distancia < menorDistancia) {
        menorDistancia   = distancia;
        masCercano       = pendientes[i];
        indiceMasCercano = i;
      }
    }

    ruta.push({ ...masCercano, distanciaDesdeAnterior: menorDistancia });
    distanciaTotal += menorDistancia;
    actual = masCercano.ubicacion;

    pendientes.splice(indiceMasCercano, 1);
  }

  return { ruta, distanciaTotal };
}

// ── Función principal — orquesta todo el proceso ────────────────────

export async function asignarRutas(repartidores) {
  if (!repartidores || repartidores.length === 0) {
    throw new Error('Se requiere al menos un repartidor');
  }

  // 1. Leer pedidos pendientes de la base de datos real
  const pedidosPendientes = await leerPedidosPendientes();

  if (pedidosPendientes.length === 0) {
    return { mensaje: 'No hay pedidos pendientes para asignar', asignaciones: [] };
  }

  // 2. Simular ubicación de cliente para cada pedido
  const pedidosConUbicacion = await simularUbicacionesDePedidos(pedidosPendientes);

  // 3. Distribuir pedidos entre repartidores
  const distribucion = distribuirPedidos(pedidosConUbicacion, repartidores);

  // 4. Calcular ruta óptima para cada repartidor
  const asignaciones = [];

  for (const repartidor of repartidores) {
    const pedidosAsignados = distribucion[repartidor.id];

    if (pedidosAsignados.length === 0) {
      asignaciones.push({
        repartidor,
        ruta: [],
        distanciaTotal: 0,
        mensaje: 'Sin pedidos asignados',
      });
      continue;
    }

    const { ruta, distanciaTotal } = await vecinoMasCercano(
      repartidor.ubicacion_base,
      pedidosAsignados
    );

    asignaciones.push({
      repartidor,
      ruta,
      distanciaTotal,
    });
  }

  return { asignaciones };
}