import { Router } from 'express';
import { checkJwt }        from '../middlewares/auth.js';
import { requireRole }     from '../middlewares/roles.js';
import { cacheMiddleware } from '../middlewares/cache.middleware.js';
import { TTL }             from '../config/cache.js';

export function createMenuRouter(controller) {
  const router = Router();

  /**
   * @swagger
   * /menus:
   *   post:
   *     summary: Crear un nuevo menú para un restaurante
   *     tags: [Menus]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [nombre, id_restaurante]
   *             properties:
   *               nombre:         { type: string,  example: Menú del día }
   *               id_restaurante: { type: integer, example: 1 }
   *     responses:
   *       201: { description: Menú creado correctamente }
   *       400: { description: Campos obligatorios faltantes }
   *       403: { description: Sin permiso }
   */
  router.post('/', checkJwt, requireRole('admin'), controller.create);

  /**
   * @swagger
   * /menus/{id}:
   *   get:
   *     summary: Obtener detalles de un menú específico
   *     tags: [Menus]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200: { description: Detalles del menú }
   *       404: { description: Menú no encontrado }
   */
  router.get(
    '/:id',
    checkJwt,
    cacheMiddleware((req) => `menus:item:${req.params.id}`, TTL.MENUS),
    controller.findById
  );

  /**
   * @swagger
   * /menus/{id}:
   *   put:
   *     summary: Actualizar un menú existente
   *     tags: [Menus]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [nombre]
   *             properties:
   *               nombre: { type: string, example: Menú actualizado }
   *     responses:
   *       200: { description: Menú actualizado correctamente }
   *       404: { description: Menú no encontrado }
   */
  router.put('/:id', checkJwt, requireRole('admin'), controller.update);

  /**
   * @swagger
   * /menus/{id}:
   *   delete:
   *     summary: Eliminar un menú
   *     tags: [Menus]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200: { description: Menú eliminado correctamente }
   *       404: { description: Menú no encontrado }
   */
  router.delete('/:id', checkJwt, requireRole('admin'), controller.remove);

  return router;
}