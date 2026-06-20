// rutas-service/src/controllers/rutas.controller.js
//
// Controller del Punto 6 — Asignación de Rutas de Entrega.

import { asignarRutas } from '../services/rutas.service.js';

export const postAsignarRutas = async (req, res) => {
  try {
    const { repartidores } = req.body;

    if (!repartidores || !Array.isArray(repartidores) || repartidores.length === 0) {
      return res.status(400).json({
        error: 'Se requiere un array de repartidores con al menos un elemento',
      });
    }

    // Validar que cada repartidor tenga los campos necesarios
    for (const r of repartidores) {
      if (!r.id || !r.nombre || !r.ubicacion_base) {
        return res.status(400).json({
          error: 'Cada repartidor debe tener id, nombre y ubicacion_base',
        });
      }
    }

    const resultado = await asignarRutas(repartidores);
    res.status(200).json(resultado);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};