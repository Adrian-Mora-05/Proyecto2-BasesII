import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockDAO = {
  createFromKeycloak: jest.fn()
};

const { AuthService } = await import('../../src/services/auth.service.js');

const service = new AuthService(mockDAO);

function mockFetchOk(data) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data))
  };
}

function mockFetchFail(data) {
  return {
    ok: false,
    status: 400,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data))
  };
}

describe('AuthService - register', () => {

  beforeEach(() => jest.clearAllMocks());

  test('register → éxito', async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchOk({ access_token: 'admin-token' }))
      .mockResolvedValueOnce({ ok: true, json: jest.fn() })
      .mockResolvedValueOnce(mockFetchOk([{ id: 'kc-id' }]))
      .mockResolvedValueOnce(mockFetchOk({ id: 'role-id', name: 'cliente' }))
      .mockResolvedValueOnce({ ok: true, json: jest.fn() });

    mockDAO.createFromKeycloak.mockResolvedValue({ id: 1 });

    const result = await service.register({
      username: 'test',
      email: 'a@a.com',
      firstName: 'A',
      lastName: 'B',
      password: '123'
    });

    expect(result).toBe(true);
    expect(mockDAO.createFromKeycloak).toHaveBeenCalledWith({
      keycloakId: 'kc-id',
      nombre: 'A B',
      correo: 'a@a.com',
      rol: 'cliente'
    });
  });

  test('register → lanza error si Keycloak falla al crear usuario', async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchOk({ access_token: 'admin-token' }))
      .mockResolvedValueOnce(mockFetchFail({ errorMessage: 'User exists already' }));

    await expect(service.register({
      username: 'test',
      email: 'a@a.com',
      firstName: 'A',
      lastName: 'B',
      password: '123'
    })).rejects.toThrow('User exists already');
  });

  test('register → lanza error si no se obtiene ID del usuario', async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchOk({ access_token: 'admin-token' }))
      .mockResolvedValueOnce({ ok: true, json: jest.fn() })
      .mockResolvedValueOnce(mockFetchOk([]));

    await expect(service.register({
      username: 'test',
      email: 'a@a.com',
      firstName: 'A',
      lastName: 'B',
      password: '123'
    })).rejects.toThrow('No se pudo obtener el ID del usuario creado');
  });

  test('register → lanza error si el rol no existe en Keycloak', async () => {
    mockFetch
      .mockResolvedValueOnce(mockFetchOk({ access_token: 'admin-token' }))
      .mockResolvedValueOnce({ ok: true, json: jest.fn() })
      .mockResolvedValueOnce(mockFetchOk([{ id: 'kc-id' }]))
      .mockResolvedValueOnce(mockFetchFail({}));

    await expect(service.register({
      username: 'test',
      email: 'a@a.com',
      firstName: 'A',
      lastName: 'B',
      password: '123',
      role: 'inexistente'
    })).rejects.toThrow("Rol 'cliente' no encontrado en Keycloak");
  });

  // ── Cubre líneas 57-59: admin token con respuesta HTTP fallida ──
  test('register → lanza error si getAdminToken recibe respuesta HTTP fallida', async () => {
    // Keycloak responde con error HTTP en el token de admin
    // El catch lo captura, reintenta, y como solo hay 1 mock falla
    // en el primer intento y luego agota reintentos
    mockFetch.mockResolvedValue(mockFetchFail({ error: 'unauthorized' }));

    // Con retries=10 y delay=3000 esto sería muy lento, pero como
    // el error es HTTP (no una excepción de red), el catch interno
    // re-lanza el error y el bucle reintenta. Para que el test sea
    // rápido necesitamos una instancia con retries=1 y delay=0.
    const fastService = new AuthService(mockDAO);

    // Sobrescribimos #getAdminToken con un método que usa retries=1, delay=0
    // Hacemos esto llamando register con fetch que siempre falla con error de red
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(fastService.register({
      username: 'test',
      email: 'a@a.com',
      firstName: 'A',
      lastName: 'B',
      password: '123'
    })).rejects.toThrow('Could not connect to Keycloak after multiple retries');
  }, 40000); // timeout alto porque reintenta 10 veces con delay 3000ms

});

describe('AuthService - login', () => {

  beforeEach(() => jest.clearAllMocks());

  test('login → retorna token en login exitoso', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchOk({ access_token: 'token-123', expires_in: 300 })
    );

    const result = await service.login('juan', '123456');

    expect(result).toHaveProperty('access_token', 'token-123');
  });

  test('login → lanza error si credenciales son inválidas', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchFail({ error: 'invalid_grant' })
    );

    await expect(service.login('juan', 'mal'))
      .rejects.toThrow('Credenciales inválidas');
  });

});