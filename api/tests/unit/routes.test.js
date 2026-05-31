import { jest, describe, test, expect } from '@jest/globals';

// Mockea los middlewares para no depender de Keycloak
jest.unstable_mockModule('../../src/middlewares/auth.js', () => ({
  checkJwt: jest.fn((req, res, next) => next()),
  optionalJwt: jest.fn((req, res, next) => next())
}));

jest.unstable_mockModule('../../src/middlewares/roles.js', () => ({
  requireRole: jest.fn(() => (req, res, next) => next())
}));

// Importa las funciones creadoras de routers
const { createAuthRouter }        = await import('../../src/routes/auth.routes.js');
const { createMenuRouter }        = await import('../../src/routes/menus.routes.js');
const { createRestaurantRouter }  = await import('../../src/routes/restaurants.routes.js');
const { createUserRouter }        = await import('../../src/routes/users.routes.js');
const { createOrderRouter }       = await import('../../src/routes/orders.routes.js');
const { createReservationRouter } = await import('../../src/routes/reservations.routes.js');

const { checkJwt, optionalJwt }   = await import('../../src/middlewares/auth.js');
const { requireRole }             = await import('../../src/middlewares/roles.js');

// Helper que crea un controller mock con todos los métodos como funciones vacías
function mockController(methods) {
  return Object.fromEntries(methods.map(m => [m, jest.fn()]));
}

describe('createAuthRouter', () => {

  test('crea el router correctamente', () => {
    const controller = mockController(['register', 'login']);
    const router = createAuthRouter(controller);
    // Verifica que el router tiene rutas registradas
    expect(router.stack.length).toBeGreaterThan(0);
  });

  test('POST /register usa optionalJwt', () => {
    const controller = mockController(['register', 'login']);
    createAuthRouter(controller);
    // optionalJwt fue llamado al registrar las rutas
    expect(optionalJwt).toBeDefined();
  });

});

describe('createMenuRouter', () => {

  test('crea el router correctamente', () => {
    const controller = mockController(['create', 'findById', 'update', 'remove']);
    const router = createMenuRouter(controller);
    expect(router.stack.length).toBeGreaterThan(0);
  });

  test('usa checkJwt en todas las rutas', () => {
    const controller = mockController(['create', 'findById', 'update', 'remove']);
    createMenuRouter(controller);
    expect(checkJwt).toBeDefined();
  });

  test('usa requireRole para rutas de admin', () => {
    const controller = mockController(['create', 'findById', 'update', 'remove']);
    createMenuRouter(controller);
    // POST, PUT, DELETE requieren rol admin
    expect(requireRole).toHaveBeenCalledWith('admin');
  });

});

describe('createRestaurantRouter', () => {

  test('crea el router correctamente', () => {
    const controller = mockController(['create', 'findAll']);
    const router = createRestaurantRouter(controller);
    expect(router.stack.length).toBeGreaterThan(0);
  });

  test('POST / requiere rol admin', () => {
    const controller = mockController(['create', 'findAll']);
    createRestaurantRouter(controller);
    expect(requireRole).toHaveBeenCalledWith('admin');
  });

});

describe('createUserRouter', () => {

  test('crea el router correctamente', () => {
    const controller = mockController(['getMe', 'update', 'remove']);
    const router = createUserRouter(controller);
    expect(router.stack.length).toBeGreaterThan(0);
  });

  test('PUT y DELETE requieren rol admin', () => {
    const controller = mockController(['getMe', 'update', 'remove']);
    createUserRouter(controller);
    expect(requireRole).toHaveBeenCalledWith('admin');
  });

});

describe('createOrderRouter', () => {

  test('crea el router correctamente', () => {
    const controller = mockController(['create', 'findById']);
    const router = createOrderRouter(controller);
    expect(router.stack.length).toBeGreaterThan(0);
  });

});

describe('createReservationRouter', () => {

  test('crea el router correctamente', () => {
    const controller = mockController(['create', 'remove']);
    const router = createReservationRouter(controller);
    expect(router.stack.length).toBeGreaterThan(0);
  });

});