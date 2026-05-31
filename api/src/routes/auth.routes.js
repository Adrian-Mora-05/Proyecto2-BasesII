import { Router } from 'express';
import { optionalJwt } from '../middlewares/auth.js';

/**
 * createAuthRouter — Crea y retorna el router de autenticación
 * con el controlador inyectado.
 *
 * Cambios respecto al código anterior:
 *  - Exporta función en vez de router fijo (permite inyección del controlador)
 *  - Los handlers son métodos del controlador, no funciones importadas directamente
 *
 * @param {import('../controllers/auth.controller.js').AuthController} controller
 * @returns {Router}
 */
export function createAuthRouter(controller) {
  const router = Router();

  /**
   * @swagger
   * /auth/register:
   *   post:
   *     summary: Registro de un nuevo usuario
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [username, email, password]
   *             properties:
   *               username:  { type: string, example: juanperez }
   *               email:     { type: string, example: juan@example.com }
   *               firstName: { type: string, example: Juan }
   *               lastName:  { type: string, example: Pérez }
   *               password:  { type: string, example: Secret123 }
   *               role:      { type: string, enum: [cliente, admin], example: cliente }
   *     responses:
   *       201: { description: Usuario registrado correctamente }
   *       400: { description: Campos obligatorios faltantes }
   *       403: { description: Sin permiso para crear admins }
   *       500: { description: Error interno }
   */
  router.post('/register', optionalJwt, controller.register);

  /**
   * @swagger
   * /auth/login:
   *   post:
   *     summary: Inicio de sesión y obtención de JWT
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [username, password]
   *             properties:
   *               username: { type: string, example: juanperez }
   *               password: { type: string, example: Secret123 }
   *     responses:
   *       200: { description: Token JWT retornado }
   *       400: { description: Campos obligatorios faltantes }
   *       401: { description: Credenciales inválidas }
   */
  router.post('/login', controller.login);

  return router;
}