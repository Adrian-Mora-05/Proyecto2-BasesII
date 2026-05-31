import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';

jest.unstable_mockModule('../../src/middlewares/auth.js', () => ({
  checkJwt: (req, res, next) => { req.auth = { sub: 'integ-test-uuid', roles: ['admin'] }; next(); },
  optionalJwt: (req, res, next) => { req.auth = null; next(); }
}));

const { createApp } = await import('../../src/app.js');
const { default: request } = await import('supertest');
const { query } = await import('../../src/config/postgresdb.js');

let app;
let restauranteId;

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  if (restauranteId) {
    await query(`DELETE FROM restaurant.restaurante WHERE id = $1`, [restauranteId]);
  }
});

describe('Restaurants Integration', () => {

  test('POST /api/restaurants - 201 crea restaurante', async () => {
    const res = await request(app)
      .post('/api/restaurants')
      .set('Authorization', 'Bearer fake-token')
      .send({ nombre: 'Integ Restaurant', direccion: 'Calle Test', telefono: '1111-2222' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    restauranteId = res.body.id;
  });

  test('POST /api/restaurants - 400 falta nombre', async () => {
    const res = await request(app)
      .post('/api/restaurants')
      .set('Authorization', 'Bearer fake-token')
      .send({ direccion: 'Sin nombre' });
    expect(res.status).toBe(400);
  });

  test('GET /api/restaurants - 200 lista restaurantes', async () => {
    const res = await request(app)
      .get('/api/restaurants')
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

});