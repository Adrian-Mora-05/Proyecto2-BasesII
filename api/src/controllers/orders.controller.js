/**
 * OrderController — Maneja POST /orders y GET /orders/:id.
 *
 */
export class OrderController {
  /** @param {import('../services/orders.service.js').OrderService} orderService */
  constructor(orderService) {
    this.service = orderService;
  }

  create = async (req, res) => {
    try {
      const { id_restaurante, descripcion, id_tipo_pedido, platos } = req.body;

      if (!id_restaurante || !id_tipo_pedido || !platos?.length) {
        return res.status(400).json({ error: 'Datos incompletos' });
      }

      const keycloakId = req.auth?.sub;

      const result = await this.service.create({
        keycloakId,
        id_restaurante,
        descripcion,
        tipo_pedido: id_tipo_pedido,
        platos,
      });

      res.status(201).json({ message: 'Pedido creado correctamente', id: result.id });
    } catch (error) {
      if (error.message.includes('no existe') || error.message.includes('no encontrado')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  };

  findById = async (req, res) => {
    try {
      const { id } = req.params;
      const order = await this.service.findById(id);
      res.status(200).json(order);
    } catch (error) {
      const status = error.message === 'Pedido no encontrado' ? 404 : 500;
      res.status(status).json({ error: error.message });
    }
  };
}