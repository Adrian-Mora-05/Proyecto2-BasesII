import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock del authService inyectado en AuthController
const mockAuthService = {
  register: jest.fn(),
  login: jest.fn()
};

// Mockea el módulo completo para que el controller reciba el service mockeado
jest.unstable_mockModule('../../src/services/auth.service.js', () => ({
  AuthService: jest.fn().mockImplementation(() => mockAuthService)
}));

const { AuthController } = await import('../../src/controllers/auth.controller.js');

// Instancia el controller con el service mockeado directamente
const controller = new AuthController(mockAuthService);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('AuthController - register', () => {

  beforeEach(() => jest.clearAllMocks());

  test('201 - registro exitoso', async () => {
    mockAuthService.register.mockResolvedValue(true);
    const req = {
      body: { username: 'juan', email: 'j@j.com', password: '123', firstName: 'Juan', lastName: 'Pérez' },
      auth: null
    };
    const res = mockRes();
    await controller.register(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuario registrado correctamente' });
  });

  test('400 - faltan campos obligatorios', async () => {
    const req = { body: { username: 'juan' }, auth: null };
    const res = mockRes();
    await controller.register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('403 - cliente intenta crear admin', async () => {
    const req = {
      body: { username: 'hack', email: 'h@h.com', password: '123', role: 'admin' },
      auth: { realm_access: { roles: ['cliente'] } }
    };
    const res = mockRes();
    await controller.register(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('403 - sin auth intenta crear admin', async () => {
    const req = {
      body: { username: 'hack', email: 'h@h.com', password: '123', role: 'admin' },
      auth: null
    };
    const res = mockRes();
    await controller.register(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('403 - auth existe pero sin realm_access al crear admin', async () => {
  const req = {
    body: { username: 'hack', email: 'h@h.com', password: '123', role: 'admin' },
    auth: {} // auth existe pero sin realm_access
  };
  const res = mockRes();
  await controller.register(req, res);
  expect(res.status).toHaveBeenCalledWith(403);
  });

  test('500 - error del servicio', async () => {
    mockAuthService.register.mockRejectedValue(new Error('Error de Keycloak'));
    const req = {
      body: { username: 'juan', email: 'j@j.com', password: '123' },
      auth: null
    };
    const res = mockRes();
    await controller.register(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});

describe('AuthController - login', () => {

  beforeEach(() => jest.clearAllMocks());

  test('200 - login exitoso', async () => {
    mockAuthService.login.mockResolvedValue({ access_token: 'fake-token' });
    const req = { body: { username: 'juan', password: '123' } };
    const res = mockRes();
    await controller.login(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ access_token: 'fake-token' });
  });

  test('400 - faltan credenciales', async () => {
    const req = { body: { username: 'juan' } };
    const res = mockRes();
    await controller.login(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('401 - credenciales inválidas', async () => {
    mockAuthService.login.mockRejectedValue(new Error('Credenciales inválidas'));
    const req = { body: { username: 'juan', password: 'mal' } };
    const res = mockRes();
    await controller.login(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('500 - error inesperado', async () => {
    mockAuthService.login.mockRejectedValue(new Error('Error de conexión'));
    const req = { body: { username: 'juan', password: '123' } };
    const res = mockRes();
    await controller.login(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});