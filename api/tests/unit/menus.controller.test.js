import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock del menuService inyectado en MenuController
const mockMenuService = {
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const { MenuController } = await import('../../src/controllers/menus.controller.js');

// Instancia el controller con el service mockeado
const controller = new MenuController(mockMenuService);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('MenuController - create', () => {

  beforeEach(() => jest.clearAllMocks());

  test('201 - menú creado correctamente', async () => {
    mockMenuService.create.mockResolvedValue({ id: 1 });
    const req = { body: { nombre: 'Menú del día', id_restaurante: 1 } };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Menú creado correctamente', id: 1 });
  });

  test('400 - faltan campos', async () => {
    const req = { body: { nombre: 'Sin restaurante' } };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('500 - error del servicio', async () => {
    mockMenuService.create.mockRejectedValue(new Error('Error de BD'));
    const req = { body: { nombre: 'Test', id_restaurante: 1 } };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});

describe('MenuController - findById', () => {

  beforeEach(() => jest.clearAllMocks());

  test('200 - menú encontrado', async () => {
    mockMenuService.findById.mockResolvedValue({ id: 1, nombre: 'Menú del día' });
    const req = { params: { id: '1' } };
    const res = mockRes();
    await controller.findById(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('404 - menú no encontrado', async () => {
    mockMenuService.findById.mockResolvedValue(null);
    const req = { params: { id: '9999' } };
    const res = mockRes();
    await controller.findById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('500 - error del servicio', async () => {
    mockMenuService.findById.mockRejectedValue(new Error('Error de BD'));
    const req = { params: { id: '1' } };
    const res = mockRes();
    await controller.findById(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});

describe('MenuController - update', () => {

  beforeEach(() => jest.clearAllMocks());

  test('200 - menú actualizado', async () => {
    mockMenuService.update.mockResolvedValue({ id: 1, nombre: 'Nuevo nombre' });
    const req = { params: { id: '1' }, body: { nombre: 'Nuevo nombre' } };
    const res = mockRes();
    await controller.update(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('400 - falta nombre', async () => {
    const req = { params: { id: '1' }, body: {} };
    const res = mockRes();
    await controller.update(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 - menú no encontrado', async () => {
    mockMenuService.update.mockRejectedValue(new Error('Menú no encontrado'));
    const req = { params: { id: '9999' }, body: { nombre: 'Test' } };
    const res = mockRes();
    await controller.update(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('500 - error del servicio', async () => {
    mockMenuService.update.mockRejectedValue(new Error('Error de BD'));
    const req = { params: { id: '1' }, body: { nombre: 'Test' } };
    const res = mockRes();
    await controller.update(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});

describe('MenuController - remove', () => {

  beforeEach(() => jest.clearAllMocks());

  test('200 - menú eliminado', async () => {
    mockMenuService.delete.mockResolvedValue(true);
    const req = { params: { id: '1' } };
    const res = mockRes();
    await controller.remove(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Menú eliminado correctamente' });
  });

  test('404 - menú no encontrado', async () => {
    mockMenuService.delete.mockRejectedValue(new Error('Menú no encontrado'));
    const req = { params: { id: '9999' } };
    const res = mockRes();
    await controller.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('500 - error del servicio', async () => {
    mockMenuService.delete.mockRejectedValue(new Error('Error de BD'));
    const req = { params: { id: '1' } };
    const res = mockRes();
    await controller.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});