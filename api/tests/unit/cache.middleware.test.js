import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockGetCache = jest.fn();
const mockSetCache = jest.fn();

jest.unstable_mockModule('../../src/config/cache.js', () => ({
  getCache: mockGetCache,
  setCache: mockSetCache,
  deletePattern: jest.fn(),
  TTL: { RESTAURANTS: 86400, MENUS: 86400, SEARCH: 60 }
}));

const { cacheMiddleware } = await import('../../src/middlewares/cache.middleware.js');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('cacheMiddleware', () => {

  beforeEach(() => jest.clearAllMocks());

  test('no cachea peticiones que no son GET', async () => {
    const middleware = cacheMiddleware('test:key', 60);
    const req = { method: 'POST' };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockGetCache).not.toHaveBeenCalled();
  });

  test('HIT - retorna datos desde caché sin llamar a next', async () => {
    mockGetCache.mockResolvedValue({ id: 1, nombre: 'La Trattoria' });

    const middleware = cacheMiddleware('restaurants:all', 300);
    const req = { method: 'GET' };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(mockGetCache).toHaveBeenCalledWith('restaurants:all');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ id: 1, nombre: 'La Trattoria' });
    expect(next).not.toHaveBeenCalled();
  });

  test('MISS - llama a next y guarda en caché al responder', async () => {
    mockGetCache.mockResolvedValue(null);
    mockSetCache.mockResolvedValue();

    const middleware = cacheMiddleware('restaurants:all', 300);
    const req = { method: 'GET' };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();

    // Simula que el controlador llama a res.json
    res.statusCode = 200;
    res.json({ id: 1, nombre: 'La Trattoria' });

    // Espera que setCache sea llamado en paralelo
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockSetCache).toHaveBeenCalledWith(
      'restaurants:all',
      { id: 1, nombre: 'La Trattoria' },
      300
    );
  });

  test('MISS - no guarda en caché si la respuesta es un error', async () => {
    mockGetCache.mockResolvedValue(null);

    const middleware = cacheMiddleware('restaurants:all', 300);
    const req = { method: 'GET' };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    // Simula respuesta de error 500
    res.statusCode = 500;
    res.json({ error: 'Error interno' });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockSetCache).not.toHaveBeenCalled();
  });

  test('clave dinámica - acepta función como keyOrFn', async () => {
    mockGetCache.mockResolvedValue(null);

    const keyFn = (req) => `menus:item:${req.params.id}`;
    const middleware = cacheMiddleware(keyFn, 180);
    const req = { method: 'GET', params: { id: '42' } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(mockGetCache).toHaveBeenCalledWith('menus:item:42');
    expect(next).toHaveBeenCalled();
  });

});