// rutas-service/src/controllers/grafos.controller.js
//
// Controller del Punto 5 — Análisis de Grafos.
// Expone las consultas Cypher como endpoints HTTP.

import {
  obtenerCoCompras,
  obtenerUsuariosInfluyentes,
  obtenerCaminoMinimo,
} from '../services/grafos.service.js';

export const getCoCompras = async (req, res) => {
  try {
    const resultado = await obtenerCoCompras();
    res.status(200).json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUsuariosInfluyentes = async (req, res) => {
  try {
    const resultado = await obtenerUsuariosInfluyentes();
    res.status(200).json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCaminoMinimo = async (req, res) => {
  try {
    const { origen, destino, criterio } = req.query;

    if (!origen || !destino) {
      return res.status(400).json({ error: 'Los parámetros origen y destino son obligatorios' });
    }

    const resultado = await obtenerCaminoMinimo(
      origen,
      destino,
      criterio || 'distancia_km'
    );

    if (!resultado) {
      return res.status(404).json({ error: 'No se encontró un camino entre esas ubicaciones' });
    }

    res.status(200).json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};