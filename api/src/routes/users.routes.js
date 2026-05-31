import { Router } from 'express';
import { checkJwt }    from '../middlewares/auth.js';
import { requireRole } from '../middlewares/roles.js';

/**
 * createUserRouter — Crea y retorna el router de usuarios.
 *
 * Cambios respecto al código anterior:
 *  - Exporta función en vez de router fijo
 *  - Agrega GET /users/me que faltaba en el router original
 *
 * @param {import('../controllers/users.controller.js').UserController} controller
 * @returns {Router}
 */
export function createUserRouter(controller) {
  const router = Router();

  /**
   * @swagger
   * /users/me:
   *   get:
   *     summary: Obtener detalles del usuario autenticado
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200: { description: Perfil del usuario }
   *       401: { description: No autenticado }
   *       404: { description: Usuario no encontrado }
   */
  router.get('/me', checkJwt, controller.getMe);

  /**
   * @swagger
   * /users/{id}:
   *   put:
   *     summary: Actualizar información de un usuario
   *     tags: [Users]
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
   *             properties:
   *               nombre: { type: string, example: Juan Pérez }
   *               correo: { type: string, example: juan@example.com }
   *     responses:
   *       200: { description: Usuario actualizado }
   *       404: { description: Usuario no encontrado }
   */
  router.put('/:id', checkJwt, requireRole('admin'), controller.update);

  /**
   * @swagger
   * /users/{id}:
   *   delete:
   *     summary: Eliminar un usuario
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200: { description: Usuario eliminado }
   *       404: { description: Usuario no encontrado }
   */
  router.delete('/:id', checkJwt, requireRole('admin'), controller.remove);

  return router;
}