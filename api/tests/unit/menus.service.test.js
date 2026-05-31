import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// El service ahora solo usa deletePattern, el caché de lecturas está en cacheMiddleware
const mockDeletePattern = jest.fn();

jest.unstable_mockModule('../../src/config/cache.js', () => ({
  deletePattern: mockDeletePattern,
  getCache: jest.fn(),
  setCache: jest.fn(),
  deleteCache: jest.fn(),
  TTL: { RESTAURANTS: 86400, MENUS: 3600, SEARCH: 60 }
}));

const mockMenuDAO = {
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByRestaurant: jest.fn(),
  findAll: jest.fn()
};

const { MenuService } = await import('../../src/services/menus.service.js');

const menuService = new MenuService(mockMenuDAO);

describe('MenuService', () => {

  beforeEach(() => jest.clearAllMocks());

  test('create - crea menú y limpia caché del restaurante', async () => {
    mockMenuDAO.create.mockResolvedValue({ id: 1, nombre: 'Menú Principal' });
    mockDeletePattern.mockResolvedValue();

    const result = await menuService.create({
      nombre: 'Menú Principal',
      id_restaurante: 1
    });

    expect(mockMenuDAO.create).toHaveBeenCalledWith({
      nombre: 'Menú Principal',
      id_restaurante: 1
    });
    // El service ahora usa este patrón
    expect(mockDeletePattern).toHaveBeenCalledWith('menus:restaurant:1');
    expect(result).toHaveProperty('id', 1);
  });

  test('create - lanza error si faltan campos', async () => {
    await expect(menuService.create({ nombre: 'Solo nombre' }))
      .rejects.toThrow('nombre e id_restaurante son obligatorios');

    expect(mockMenuDAO.create).not.toHaveBeenCalled();
  });

  test('create - lanza error si falta nombre', async () => {
    await expect(menuService.create({ id_restaurante: 1 }))
      .rejects.toThrow('nombre e id_restaurante son obligatorios');
  });

  test('findById - llama al DAO directamente', async () => {
    // El caché de lecturas está en cacheMiddleware, no en el service
    mockMenuDAO.findById.mockResolvedValue({ id: 1, nombre: 'Menú Principal' });

    const result = await menuService.findById(1);

    expect(mockMenuDAO.findById).toHaveBeenCalledWith(1);
    expect(result).toHaveProperty('nombre', 'Menú Principal');
  });

  test('findById - retorna null si no existe', async () => {
    mockMenuDAO.findById.mockResolvedValue(null);

    const result = await menuService.findById(99999);

    expect(result).toBeNull();
  });

  test('update - actualiza menú y limpia caché', async () => {
    mockMenuDAO.findById.mockResolvedValue({
      id: 1,
      nombre: 'Menú Viejo',
      id_restaurante: 1
    });
    mockMenuDAO.update.mockResolvedValue({ id: 1, nombre: 'Menú Nuevo' });
    mockDeletePattern.mockResolvedValue();

    await menuService.update(1, { nombre: 'Menú Nuevo' });

    expect(mockMenuDAO.update).toHaveBeenCalledWith(1, { nombre: 'Menú Nuevo' });
    // Limpia caché individual y del restaurante con el nuevo patrón
    expect(mockDeletePattern).toHaveBeenCalledWith('menus:item:1');
    expect(mockDeletePattern).toHaveBeenCalledWith('menus:restaurant:1');
  });

  test('update - lanza error si falta nombre', async () => {
    await expect(menuService.update(1, {}))
      .rejects.toThrow('nombre es obligatorio');

    expect(mockMenuDAO.update).not.toHaveBeenCalled();
  });

  test('update - lanza error si el menú no existe', async () => {
    mockMenuDAO.findById.mockResolvedValue(null);

    await expect(menuService.update(99999, { nombre: 'Nuevo' }))
      .rejects.toThrow('Menú no encontrado');
  });

  test('delete - elimina menú y limpia caché', async () => {
    mockMenuDAO.findById.mockResolvedValue({
      id: 1,
      nombre: 'Menú Principal',
      id_restaurante: 1
    });
    mockMenuDAO.delete.mockResolvedValue(true);
    mockDeletePattern.mockResolvedValue();

    const result = await menuService.delete(1);

    expect(mockMenuDAO.delete).toHaveBeenCalledWith(1);
    expect(mockDeletePattern).toHaveBeenCalledWith('menus:item:1');
    expect(mockDeletePattern).toHaveBeenCalledWith('menus:restaurant:1');
    expect(result).toBe(true);
  });

  test('delete - lanza error si el menú no existe', async () => {
    mockMenuDAO.findById.mockResolvedValue(null);

    await expect(menuService.delete(99999))
      .rejects.toThrow('Menú no encontrado');

    expect(mockMenuDAO.delete).not.toHaveBeenCalled();
  });

  test('findByRestaurant - llama al DAO directamente', async () => {
    mockMenuDAO.findByRestaurant.mockResolvedValue([
      { id: 1, nombre: 'Menú Principal' }
    ]);

    const result = await menuService.findByRestaurant(1);

    expect(mockMenuDAO.findByRestaurant).toHaveBeenCalledWith(1);
    expect(result).toHaveLength(1);
  });

  test('findByRestaurant - retorna arreglo vacío si no hay menús', async () => {
    mockMenuDAO.findByRestaurant.mockResolvedValue([]);

    const result = await menuService.findByRestaurant(99999);

    expect(result).toEqual([]);
  });

});