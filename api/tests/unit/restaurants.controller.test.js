import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock del restaurantService inyectado en RestaurantController
const mockRestaurantService = {
  create: jest.fn(),
  findAll: jest.fn()
};

const { RestaurantController } = await import('../../src/controllers/restaurants.controller.js');

const controller = new RestaurantController(mockRestaurantService);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('RestaurantController - create', () => {

  beforeEach(() => jest.clearAllMocks());

  test('201 - restaurante creado correctamente', async () => {
    mockRestaurantService.create.mockResolvedValue({ id: 1 });
    const req = { body: { nombre: 'La Trattoria', direccion: 'Calle 5', telefono: '2222-3333' } };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Restaurante registrado correctamente', id: 1 });
  });

  test('400 - falta nombre', async () => {
    const req = { body: { direccion: 'Calle 5' } };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('500 - error del servicio', async () => {
    mockRestaurantService.create.mockRejectedValue(new Error('Error de BD'));
    const req = { body: { nombre: 'Test' } };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});

describe('RestaurantController - findAll', () => {

  beforeEach(() => jest.clearAllMocks());

  test('200 - lista restaurantes correctamente', async () => {
    mockRestaurantService.findAll.mockResolvedValue([{ id: 1, nombre: 'La Trattoria' }]);
    const req = {};
    const res = mockRes();
    await controller.findAll(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('200 - lista vacía', async () => {
    mockRestaurantService.findAll.mockResolvedValue([]);
    const req = {};
    const res = mockRes();
    await controller.findAll(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('500 - error del servicio', async () => {
    mockRestaurantService.findAll.mockRejectedValue(new Error('Error de BD'));
    const req = {};
    const res = mockRes();
    await controller.findAll(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});