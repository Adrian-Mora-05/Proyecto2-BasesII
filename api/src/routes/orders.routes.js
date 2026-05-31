import { Router } from 'express';
import { checkJwt } from '../middlewares/auth.js';

/**
 * createOrderRouter — Crea y retorna el router de pedidos.
 *
 * @param {import('../controllers/orders.controller.js').OrderController} controller
 * @returns {Router}
 */
export function createOrderRouter(controller) {
  const router = Router();

  /**
   * @swagger
   * /orders:
   *   post:
   *     summary: Realizar un pedido
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [id_restaurante, id_tipo_pedido, platos]
   *             properties:
   *               id_restaurante: { type: integer, example: 1 }
   *               descripcion:    { type: string,  example: Sin picante }
   *               id_tipo_pedido: { type: integer, example: 1 }
   *               platos:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     id_plato:  { type: integer, example: 3 }
   *                     cantidad:  { type: integer, example: 2 }
   *     responses:
   *       201: { description: Pedido creado correctamente }
   *       400: { description: Datos incompletos o restaurante inexistente }
   *       401: { description: No autenticado }
   */
  router.post('/', checkJwt, controller.create);

  /**
   * @swagger
   * /orders/{id}:
   *   get:
   *     summary: Obtener detalles de un pedido
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200: { description: Detalles del pedido }
   *       404: { description: Pedido no encontrado }
   */
  router.get('/:id', checkJwt, controller.findById);

  return router;
}