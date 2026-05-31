/**
 * RestaurantController — Maneja POST /restaurants y GET /restaurants.
 *
 * Cambios respecto al código anterior:
 *  - Era módulo de funciones sueltas; ahora clase inyectable
 *  - create pasa objeto al servicio en vez de parámetros posicionales
 */
export class RestaurantController {
  /** @param {import('../services/restaurants.service.js').RestaurantService} restaurantService */
  constructor(restaurantService) {
    this.service = restaurantService;
  }

  create = async (req, res) => {
    try {
      const { nombre, direccion, telefono } = req.body;

      if (!nombre) {
        return res.status(400).json({ error: 'El nombre del restaurante es obligatorio' });
      }

      const result = await this.service.create({ nombre, direccion, telefono });
      res.status(201).json({ message: 'Restaurante registrado correctamente', id: result.id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  findAll = async (req, res) => {
    try {
      const restaurantes = await this.service.findAll();
      res.status(200).json(restaurantes);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}