/**
 * UserController — Maneja GET /users/me, PUT /users/:id, DELETE /users/:id.
 *
 * Cambios respecto al código anterior:
 *  - Era módulo de funciones sueltas; ahora clase inyectable
 *  - Recibe userService por constructor
 *  - update pasa objeto { nombre, correo } al servicio (no posicional)
 *  - Los mensajes de respuesta viven aquí, no en el DAO ni el servicio
 */
export class UserController {
  /** @param {import('../services/users.service.js').UserService} userService */
  constructor(userService) {
    this.service = userService;
  }

  getMe = async (req, res) => {
    try {
      const keycloakId = req.auth.sub;
      const user = await this.service.getMe(keycloakId);

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      res.status(200).json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  update = async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, correo } = req.body;

      if (!nombre && !correo) {
        return res.status(400).json({ error: 'Se requiere al menos nombre o correo' });
      }

      const updated = await this.service.update(id, { nombre, correo });

      if (!updated) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      res.status(200).json({ message: 'Usuario actualizado correctamente', data: updated });
    } catch (error) {
      const status = error.message === 'Usuario no encontrado' ? 404 : 500;
      res.status(status).json({ error: error.message });
    }
  };

  remove = async (req, res) => {
    try {
      const { id } = req.params;
      await this.service.delete(id);
      res.status(200).json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
      const status = error.message === 'Usuario no encontrado' ? 404 : 500;
      res.status(status).json({ error: error.message });
    }
  };
}