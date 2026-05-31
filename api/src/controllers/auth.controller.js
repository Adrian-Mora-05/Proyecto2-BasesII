/**
 * AuthController — Maneja POST /auth/register y POST /auth/login.
 *
 * Cambios respecto al código anterior:
 *  - Era módulo de funciones sueltas; ahora es clase inyectable
 *  - Recibe authService por constructor (DIP)
 *  - Llama service.register() y service.login() en vez de funciones importadas
 *  - La sanitización del rol (cliente/admin) se movió al servicio
 */
export class AuthController {
  /** @param {import('../services/auth.service.js').AuthService} authService */
  constructor(authService) {
    this.service = authService;
  }

  register = async (req, res) => {
    try {
      const { username, email, firstName, lastName, password, role } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: 'username, email y password son obligatorios' });
      }

      // Solo un admin puede crear otro admin
      if (role === 'admin') {
        const tokenRoles = req.auth?.realm_access?.roles || [];
        if (!tokenRoles.includes('admin')) {
          return res.status(403).json({ error: 'Solo admins pueden crear otros admins' });
        }
      }

      await this.service.register({ username, email, firstName, lastName, password, role });
      res.status(201).json({ message: 'Usuario registrado correctamente' });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  login = async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'username y password son obligatorios' });
      }

      const tokenData = await this.service.login(username, password);
      res.status(200).json(tokenData);

    } catch (error) {
      const status = error.message === 'Credenciales inválidas' ? 401 : 500;
      res.status(status).json({ error: error.message });
    }
  };
}