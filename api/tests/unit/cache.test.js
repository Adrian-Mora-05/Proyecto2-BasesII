import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock de redis para no conectarse a Redis real
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn()
};

// Reemplaza el módulo redis con el mock
jest.unstable_mockModule('../../src/config/redis.js', () => ({
  default: mockRedis
}));

// Importa cache DESPUÉS del mock
const { getCache, setCache, deleteCache, deletePattern, TTL } = await import('../../src/config/cache.js');

describe('cache - TTL', () => {

  test('TTL tiene los valores correctos', () => {
    
    expect(TTL.RESTAURANTS).toBe(86400); // 24 horas
    expect(TTL.MENUS).toBe(86400);        // 1 hora
    expect(TTL.SEARCH).toBe(60);         // 1 minuto
  });

});

describe('cache - getCache', () => {

  beforeEach(() => jest.clearAllMocks());

  test('retorna el valor parseado cuando existe en Redis', async () => {
    // Simula que Redis tiene el dato guardado como JSON
    mockRedis.get.mockResolvedValue(JSON.stringify({ id: 1, nombre: 'La Trattoria' }));

    const result = await getCache('restaurants:all');

    expect(result).toEqual({ id: 1, nombre: 'La Trattoria' });
    expect(mockRedis.get).toHaveBeenCalledWith('restaurants:all');
  });

  test('retorna null cuando la clave no existe en Redis', async () => {
    // Simula que Redis no tiene el dato
    mockRedis.get.mockResolvedValue(null);

    const result = await getCache('restaurants:all');

    expect(result).toBeNull();
  });

  test('retorna null cuando Redis lanza un error', async () => {
    // Simula que Redis falla
    mockRedis.get.mockRejectedValue(new Error('Connection refused'));

    const result = await getCache('restaurants:all');

    // La API debe seguir funcionando aunque Redis falle
    expect(result).toBeNull();
  });

});

describe('cache - setCache', () => {

  beforeEach(() => jest.clearAllMocks());

  test('guarda el valor en Redis con TTL correcto', async () => {
    mockRedis.set.mockResolvedValue('OK');

    await setCache('restaurants:all', [{ id: 1 }], 300);

    // Verifica que se llamó con EX y el TTL correcto
    expect(mockRedis.set).toHaveBeenCalledWith(
      'restaurants:all',
      JSON.stringify([{ id: 1 }]),
      'EX',
      300
    );
  });

  test('no lanza error cuando Redis falla al guardar', async () => {
    mockRedis.set.mockRejectedValue(new Error('Connection refused'));

    // No debe lanzar error, solo loguea
    await expect(setCache('restaurants:all', [], 300)).resolves.toBeUndefined();
  });

});

describe('cache - deleteCache', () => {

  beforeEach(() => jest.clearAllMocks());

  test('elimina una clave específica de Redis', async () => {
    mockRedis.del.mockResolvedValue(1);

    await deleteCache('restaurants:all');

    expect(mockRedis.del).toHaveBeenCalledWith('restaurants:all');
  });

  test('no lanza error cuando Redis falla al eliminar', async () => {
    mockRedis.del.mockRejectedValue(new Error('Connection refused'));

    await expect(deleteCache('restaurants:all')).resolves.toBeUndefined();
  });

});

describe('cache - deletePattern', () => {

  beforeEach(() => jest.clearAllMocks());

  test('elimina todas las claves que coinciden con el patrón', async () => {
    // Simula que Redis encontró 2 claves con ese patrón
    mockRedis.keys.mockResolvedValue(['restaurants:all', 'restaurants:1']);
    mockRedis.del.mockResolvedValue(2);

    await deletePattern('restaurants:*');

    expect(mockRedis.keys).toHaveBeenCalledWith('restaurants:*');
    // Verifica que del fue llamado con ambas claves
    expect(mockRedis.del).toHaveBeenCalledWith('restaurants:all', 'restaurants:1');
  });

  test('no llama del si no hay claves que coincidan', async () => {
    // No hay claves con ese patrón
    mockRedis.keys.mockResolvedValue([]);

    await deletePattern('restaurants:*');

    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  test('no lanza error cuando Redis falla', async () => {
    mockRedis.keys.mockRejectedValue(new Error('Connection refused'));

    await expect(deletePattern('restaurants:*')).resolves.toBeUndefined();
  });

});