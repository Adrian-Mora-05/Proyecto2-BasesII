import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockOrderService = {
  create: jest.fn(),
  findById: jest.fn()
};

const { OrderController } = await import('../../src/controllers/orders.controller.js');

const controller = new OrderController(mockOrderService);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('OrderController - create', () => {

  beforeEach(() => jest.clearAllMocks());

  test('201 - pedido creado', async () => {
    mockOrderService.create.mockResolvedValue({ id: 1 });
    const req = {
      auth: { sub: 'uuid-123' },
      body: { id_restaurante: 1, descripcion: 'Para llevar', id_tipo_pedido: 1, platos: [{ id_plato: 1, cantidad: 2 }] }
    };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Pedido creado correctamente', id: 1 });
  });

  test('400 - datos incompletos', async () => {
    const req = { auth: { sub: 'uuid-123' }, body: { id_restaurante: 1 } };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400 - platos vacíos', async () => {
    const req = { auth: { sub: 'uuid-123' }, body: { id_restaurante: 1, id_tipo_pedido: 1, platos: [] } };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400 - restaurante no existe', async () => {
    mockOrderService.create.mockRejectedValue(new Error('Restaurante 99999 no existe'));
    const req = {
      auth: { sub: 'uuid-123' },
      body: { id_restaurante: 99999, id_tipo_pedido: 1, platos: [{ id_plato: 1, cantidad: 1 }] }
    };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('500 - error inesperado', async () => {
    mockOrderService.create.mockRejectedValue(new Error('Error de BD'));
    const req = {
      auth: { sub: 'uuid-123' },
      body: { id_restaurante: 1, id_tipo_pedido: 1, platos: [{ id_plato: 1, cantidad: 1 }] }
    };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});

describe('OrderController - findById', () => {

  beforeEach(() => jest.clearAllMocks());

  test('200 - pedido encontrado', async () => {
    mockOrderService.findById.mockResolvedValue({ id: 1, descripcion: 'Para llevar' });
    const req = { params: { id: '1' } };
    const res = mockRes();
    await controller.findById(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('404 - pedido no encontrado', async () => {
    mockOrderService.findById.mockRejectedValue(new Error('Pedido no encontrado'));
    const req = { params: { id: '9999' } };
    const res = mockRes();
    await controller.findById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('500 - error del servicio', async () => {
    mockOrderService.findById.mockRejectedValue(new Error('Error de BD'));
    const req = { params: { id: '1' } };
    const res = mockRes();
    await controller.findById(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});