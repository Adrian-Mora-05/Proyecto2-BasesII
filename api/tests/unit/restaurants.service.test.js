import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockDeletePattern = jest.fn();

jest.unstable_mockModule('../../src/config/cache.js', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  deletePattern: mockDeletePattern,
  deleteCache: jest.fn(),
  TTL: { RESTAURANTS: 86400, MENUS: 86400, SEARCH: 60 }
}));

const mockRestaurantDAO = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const { RestaurantService } = await import('../../src/services/restaurants.service.js');

const restaurantService = new RestaurantService(mockRestaurantDAO);

describe('RestaurantService', () => {

  beforeEach(() => jest.clearAllMocks());

  test('create - registra restaurante y limpia caché', async () => {
    mockRestaurantDAO.create.mockResolvedValue({ id: 1, nombre: 'La Trattoria' });
    mockDeletePattern.mockResolvedValue();

    const result = await restaurantService.create({
      nombre: 'La Trattoria',
      direccion: 'Cartago',
      telefono: '2550-1234'
    });

    expect(mockRestaurantDAO.create).toHaveBeenCalledWith({
      nombre: 'La Trattoria',
      direccion: 'Cartago',
      telefono: '2550-1234'
    });
    expect(mockDeletePattern).toHaveBeenCalledWith('restaurants:*');
    expect(result).toHaveProperty('id', 1);
  });

  test('create - lanza error si falta el nombre', async () => {
    await expect(restaurantService.create({ direccion: 'Cartago' }))
      .rejects.toThrow('El nombre del restaurante es obligatorio');

    expect(mockRestaurantDAO.create).not.toHaveBeenCalled();
  });

  test('findAll - llama al DAO directamente', async () => {
    mockRestaurantDAO.findAll.mockResolvedValue([
      { id: 1, nombre: 'La Trattoria' },
      { id: 2, nombre: 'El Fogón' }
    ]);

    const result = await restaurantService.findAll();

    expect(mockRestaurantDAO.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  test('findAll - retorna lista vacía si no hay restaurantes', async () => {
    mockRestaurantDAO.findAll.mockResolvedValue([]);

    const result = await restaurantService.findAll();

    expect(result).toEqual([]);
  });

});