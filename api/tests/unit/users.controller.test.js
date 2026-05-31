import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock del userService inyectado en UserController
const mockUserService = {
  getMe: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const { UserController } = await import('../../src/controllers/users.controller.js');

const controller = new UserController(mockUserService);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('UserController - getMe', () => {

  beforeEach(() => jest.clearAllMocks());

  test('200 - usuario encontrado', async () => {
    mockUserService.getMe.mockResolvedValue({ id: 1, nombre: 'Juan', correo: 'j@j.com', rol: 'cliente' });
    const req = { auth: { sub: 'uuid-123' } };
    const res = mockRes();
    await controller.getMe(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('404 - usuario no encontrado', async () => {
    mockUserService.getMe.mockResolvedValue(null);
    const req = { auth: { sub: 'uuid-inexistente' } };
    const res = mockRes();
    await controller.getMe(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
  
  test('404 - update retorna null (usuario no encontrado via retorno)', async () => {
  mockUserService.update.mockResolvedValue(null);
  const req = { params: { id: '99' }, body: { nombre: 'x', correo: 'x@x.com' } };
  const res = mockRes();
  await controller.update(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  });


  test('500 - error del servicio', async () => {
    mockUserService.getMe.mockRejectedValue(new Error('Error de BD'));
    const req = { auth: { sub: 'uuid-123' } };
    const res = mockRes();
    await controller.getMe(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});

describe('UserController - update', () => {

  beforeEach(() => jest.clearAllMocks());

  test('200 - actualización exitosa', async () => {
    mockUserService.update.mockResolvedValue({ id: 1, nombre: 'Nuevo', correo: 'nuevo@test.com' });
    const req = { params: { id: '1' }, body: { nombre: 'Nuevo', correo: 'nuevo@test.com' } };
    const res = mockRes();
    await controller.update(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('400 - faltan nombre y correo', async () => {
    const req = { params: { id: '1' }, body: {} };
    const res = mockRes();
    await controller.update(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 - usuario no existe via error', async () => {
    mockUserService.update.mockRejectedValue(new Error('Usuario no encontrado'));
    const req = { params: { id: '9999' }, body: { nombre: 'x', correo: 'x@x.com' } };
    const res = mockRes();
    await controller.update(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('500 - error inesperado', async () => {
    mockUserService.update.mockRejectedValue(new Error('Error de BD'));
    const req = { params: { id: '1' }, body: { nombre: 'x', correo: 'x@x.com' } };
    const res = mockRes();
    await controller.update(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});

describe('UserController - remove', () => {

  beforeEach(() => jest.clearAllMocks());

  test('200 - eliminación exitosa', async () => {
    mockUserService.delete.mockResolvedValue(true);
    const req = { params: { id: '1' } };
    const res = mockRes();
    await controller.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('404 - usuario no existe', async () => {
    mockUserService.delete.mockRejectedValue(new Error('Usuario no encontrado'));
    const req = { params: { id: '9999' } };
    const res = mockRes();
    await controller.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('500 - error inesperado', async () => {
    mockUserService.delete.mockRejectedValue(new Error('Error de BD'));
    const req = { params: { id: '1' } };
    const res = mockRes();
    await controller.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});