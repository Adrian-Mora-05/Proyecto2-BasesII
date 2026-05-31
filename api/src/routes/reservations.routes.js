import { Router } from 'express';
import { checkJwt } from '../middlewares/auth.js';

/**
 * createReservationRouter — Crea y retorna el router de reservaciones.
 *
 * @param {import('../controllers/reservations.controller.js').ReservationController} controller
 * @returns {Router}
 */
export function createReservationRouter(controller) {
  const router = Router();

  /**
   * @swagger
   * /reservations:
   *   post:
   *     summary: Crear una nueva reserva
   *     tags: [Reservations]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [id_restaurante, id_mesa, fecha_hora, duracion, cant_personas]
   *             properties:
   *               id_restaurante: { type: integer, example: 1 }
   *               id_mesa:        { type: integer, example: 3 }
   *               fecha_hora:     { type: string,  example: "2025-06-15T19:00:00" }
   *               duracion:       { type: integer, example: 90 }
   *               cant_personas:  { type: integer, example: 4 }
   *     responses:
   *       201: { description: Reserva creada correctamente }
   *       400: { description: Datos incompletos }
   *       409: { description: Mesa ya reservada en ese horario }
   */
  router.post('/', checkJwt, controller.create);

  /**
   * @swagger
   * /reservations/{id}:
   *   delete:
   *     summary: Cancelar una reserva
   *     tags: [Reservations]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200: { description: Reserva cancelada correctamente }
   *       404: { description: Reserva no encontrada }
   */
  router.delete('/:id', checkJwt, controller.remove);

  return router;
}