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
let menuId;

beforeAll(async () => {
  app = await createApp();
  const res = await query(
    `INSERT INTO restaurant.restaurante (nombre, direccion, telefono)
     VALUES ('Rest Menus Test', 'Dir Test', '0000') RETURNING id`
  );
  restauranteId = res.rows[0].id;
});

afterAll(async () => {
  await query(`DELETE FROM restaurant.menu WHERE id_restaurante = $1`, [restauranteId]);
  await query(`DELETE FROM restaurant.restaurante WHERE id = $1`, [restauranteId]);
});

describe('Menus Integration', () => {

  test('POST /api/menus - 201 crea menú', async () => {
    const res = await request(app)
      .post('/api/menus')
      .set('Authorization', 'Bearer fake-token')
      .send({ nombre: 'Menú Integración', id_restaurante: restauranteId });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    menuId = res.body.id;
  });

  test('POST /api/menus - 400 faltan campos', async () => {
    const res = await request(app)
      .post('/api/menus')
      .set('Authorization', 'Bearer fake-token')
      .send({ nombre: 'Sin restaurante' });
    expect(res.status).toBe(400);
  });

  test('GET /api/menus/:id - 200 menú encontrado', async () => {
    const res = await request(app)
      .get(`/api/menus/${menuId}`)
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nombre', 'Menú Integración');
  });

  test('GET /api/menus/:id - 404 menú no existe', async () => {
    const res = await request(app)
      .get('/api/menus/99999')
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(404);
  });

  test('PUT /api/menus/:id - 200 actualiza menú', async () => {
    const res = await request(app)
      .put(`/api/menus/${menuId}`)
      .set('Authorization', 'Bearer fake-token')
      .send({ nombre: 'Menú Actualizado' });
    expect(res.status).toBe(200);
  });

  test('DELETE /api/menus/:id - 200 elimina menú', async () => {
    const res = await request(app)
      .delete(`/api/menus/${menuId}`)
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(200);
  });

});