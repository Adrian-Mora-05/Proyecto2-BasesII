import 'dotenv/config';

const KEYCLOAK_URL        = process.env.KEYCLOAK_URL          || 'http://keycloak:8080';
const REALM               = process.env.REALM                 || 'restaurant';
const KEYCLOAK_ADMIN      = process.env.KEYCLOAK_ADMIN;
const KEYCLOAK_ADMIN_PASS = process.env.KEYCLOAK_ADMIN_PASSWORD;
const LOGIN_CLIENT_ID     = process.env.KEYCLOAK_CLIENT_ID;
const LOGIN_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET;
const ADMIN_CLIENT_ID     = process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'admin-cli';

/**
 * AuthService — Lógica de autenticación con Keycloak.
 *
 * Recibe userDAO por inyección para persistir el usuario local
 * sin acoplarse al motor de BD. La lógica de Keycloak (HTTP) queda
 * aquí y no en el DAO, porque no es acceso a datos sino integración
 * con un servicio externo.
 *
 * Cambios respecto al código anterior:
 *  - Era un módulo de funciones sueltas; ahora es una clase inyectable
 *  - `query` directo de Postgres reemplazado por userDAO inyectado
 *  - getAdminToken movido como método privado de la clase
 */
export class AuthService {
  /**
   * @param {import('../dao/interfaces/BaseDAO.js').BaseDAO} userDAO
   */
  constructor(userDAO) {
    this.userDAO = userDAO;
  }

  // ── Keycloak helpers ──────────────────────────────────────────

  /**
   * Obtiene un token de administrador del realm master.
   * Reintenta hasta `retries` veces con delay entre intentos
   * para tolerar el arranque lento de Keycloak en Docker.
   */
  async #getAdminToken(retries = 10, delay = 3000) {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(
          `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'password',
              client_id:  ADMIN_CLIENT_ID,
              username:   KEYCLOAK_ADMIN,
              password:   KEYCLOAK_ADMIN_PASS,
            }),
          }
        );

        if (!res.ok) {
          const err = await res.json();
          console.error('KEYCLOAK ADMIN ERROR:', JSON.stringify(err));
          throw new Error(`Keycloak responded ${res.status}`);
        }

        const data = await res.json();
        return data.access_token;

      } catch (err) {
        console.log(`Keycloak not ready (${i + 1}/${retries})... retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error('Could not connect to Keycloak after multiple retries');
  }

  // ── Métodos públicos ──────────────────────────────────────────

  /**
   * Registra un usuario en Keycloak y lo persiste en la BD local.
   *
   * Flujo:
   *  1. Crear usuario en Keycloak
   *  2. Obtener su ID de Keycloak
   *  3. Obtener y asignar el rol en Keycloak
   *  4. Persistir el usuario local con el DAO
   *
   * @param {{ username, email, firstName, lastName, password, role }} userData
   * @returns {Promise<true>}
   */
  async register(userData) {
    const adminToken = await this.#getAdminToken();
    const rol = ['cliente', 'admin'].includes(userData.role) ? userData.role : 'cliente';

    // 1. Crear en Keycloak
    const createRes = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          username:      userData.username,
          email:         userData.email,
          firstName:     userData.firstName,
          lastName:      userData.lastName,
          enabled:       true,
          emailVerified: true,
          credentials:   [{ type: 'password', value: userData.password, temporary: false }],
        }),
      }
    );

    if (!createRes.ok) {
      const error = await createRes.json();
      throw new Error(error.errorMessage || 'Error al registrar usuario en Keycloak');
    }

    // 2. Obtener ID de Keycloak
    const getUserRes = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${userData.username}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const users = await getUserRes.json();
    const keycloakId = users[0]?.id;
    if (!keycloakId) throw new Error('No se pudo obtener el ID del usuario creado');

    // 3. Obtener y asignar rol en Keycloak
    const rolRes = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${rol}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    if (!rolRes.ok) throw new Error(`Rol '${rol}' no encontrado en Keycloak`);
    const rolData = await rolRes.json();

    await fetch(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakId}/role-mappings/realm`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${adminToken}`,
        },
        body: JSON.stringify([{ id: rolData.id, name: rolData.name }]),
      }
    );

    // 4. Persistir usuario local mediante el DAO inyectado
    //    El DAO resuelve el id_rol internamente según el motor de BD
    await this.userDAO.createFromKeycloak({
      keycloakId,
      nombre: `${userData.firstName} ${userData.lastName}`,
      correo: userData.email,
      rol,
    });

    return true;
  }

  /**
   * Autentica un usuario contra Keycloak y retorna el token JWT.
   *
   * @param {string} username
   * @param {string} password
   * @returns {Promise<Object>} — Respuesta completa de Keycloak (access_token, etc.)
   */
  async login(username, password) {
    const res = await fetch(
      `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'password',
          client_id:     LOGIN_CLIENT_ID,
          client_secret: LOGIN_CLIENT_SECRET,
          username,
          password,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('KEYCLOAK LOGIN ERROR:', text);
      throw new Error('Credenciales inválidas');
    }

    return res.json();
  }
}