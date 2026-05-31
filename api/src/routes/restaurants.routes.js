import { Router } from 'express';
import { checkJwt }        from '../middlewares/auth.js';
import { requireRole }     from '../middlewares/roles.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { TTL }             from '../config/cache.js';

export function createRestaurantRouter(controller) {
  const router = Router();

  /**
   * @swagger
   * /restaurants:
   *   post:
   *     summary: Registrar un restaurante (solo administradores)
   *     tags: [Restaurants]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [nombre]
   *             properties:
   *               nombre:    { type: string, example: La Trattoria }
   *               direccion: { type: string, example: Av. Central 123 }
   *               telefono:  { type: string, example: +506 2222-3333 }
   *     responses:
   *       201: { description: Restaurante registrado }
   *       400: { description: Nombre obligatorio }
   *       403: { description: Sin permiso }
   */
  router.post('/', checkJwt, requireRole('admin'), controller.create);

  /**
   * @swagger
   * /restaurants:
   *   get:
   *     summary: Listar restaurantes disponibles
   *     tags: [Restaurants]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200: { description: Lista de restaurantes }
   */
  router.get(
    '/',
    checkJwt,
    cacheMiddleware('restaurants:all', TTL.RESTAURANTS),
    controller.findAll
  );

  return router;
}