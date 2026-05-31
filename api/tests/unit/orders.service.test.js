import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockOrderDAO = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const mockUserDAO = {
  findByExternalId: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const mockRestaurantDAO = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const { OrderService } = await import('../../src/services/orders.service.js');

const orderService = new OrderService(mockOrderDAO, mockUserDAO, mockRestaurantDAO);

describe('OrderService', () => {

  beforeEach(() => jest.clearAllMocks());

  test('create - crea pedido correctamente', async () => {
    mockUserDAO.findByExternalId.mockResolvedValue({ id: 1 });
    mockRestaurantDAO.findById.mockResolvedValue({ id: 1 });
    mockOrderDAO.create.mockResolvedValue({ id: 42 });

    const result = await orderService.create({
      keycloakId: 'uuid-123',
      id_restaurante: 1,
      descripcion: 'Para llevar',
      tipo_pedido: 'para llevar',
      platos: [{ id_plato: 1, cantidad: 2 }]
    });

    expect(result).toHaveProperty('id', 42);
  });

  test('create - lanza error si usuario no existe', async () => {
    mockUserDAO.findByExternalId.mockResolvedValue(null);

    await expect(orderService.create({
      keycloakId: 'uuid-xxx',
      id_restaurante: 1,
      descripcion: 'desc',
      tipo_pedido: 'para llevar',
      platos: []
    })).rejects.toThrow('Usuario no encontrado en base de datos');
  });

  test('create - lanza error si restaurante no existe', async () => {
    mockUserDAO.findByExternalId.mockResolvedValue({ id: 1 });
    mockRestaurantDAO.findById.mockResolvedValue(null);

    await expect(orderService.create({
      keycloakId: 'uuid-123',
      id_restaurante: 99999,
      descripcion: 'desc',
      tipo_pedido: 'para llevar',
      platos: []
    })).rejects.toThrow('no existe');
  });

  test('findById - retorna pedido encontrado', async () => {
    mockOrderDAO.findById.mockResolvedValue({ id: 1, descripcion: 'Para llevar' });

    const result = await orderService.findById(1);
    expect(result).toHaveProperty('id', 1);
  });

  test('findById - lanza error si pedido no existe', async () => {
    mockOrderDAO.findById.mockResolvedValue(null);

    await expect(orderService.findById(99999))
      .rejects.toThrow('Pedido no encontrado');
  });

});