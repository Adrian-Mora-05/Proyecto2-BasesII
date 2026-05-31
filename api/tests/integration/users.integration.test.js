import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';

jest.unstable_mockModule('../../src/middlewares/auth.js', () => ({
  checkJwt: (req, res, next) => { req.auth = { sub: 'users-test-uuid', roles: ['admin'] }; next(); },
  optionalJwt: (req, res, next) => { req.auth = null; next(); }
}));

const { createApp } = await import('../../src/app.js');
const { default: request } = await import('supertest');
const { query } = await import('../../src/config/postgresdb.js');

let app;

beforeAll(async () => {
  app = await createApp();
  await query(
    `INSERT INTO restaurant.usuario (id_external_auth, nombre, correo, id_rol_usuario)
     VALUES ('users-test-uuid', 'Integ User', 'users@test.com',
       (SELECT id FROM restaurant.rol_usuario WHERE nombre = 'admin'))
     ON CONFLICT (correo) DO UPDATE
       SET id_external_auth = 'users-test-uuid', nombre = 'Integ User'`
  );
});

afterAll(async () => {
  await query(`DELETE FROM restaurant.usuario WHERE id_external_auth = 'users-test-uuid'`);
});

describe('Users Integration', () => {

  test('GET /api/users/me - 200 usuario autenticado', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nombre', 'Integ User');
  });

  test('PUT /api/users/:id - 200 actualización exitosa', async () => {
    const userRes = await query(
      `SELECT id FROM restaurant.usuario WHERE id_external_auth = 'users-test-uuid'`
    );
    const id = userRes.rows[0].id;

    const res = await request(app)
      .put(`/api/users/${id}`)
      .set('Authorization', 'Bearer fake-token')
      .send({ nombre: 'Integ Actualizado', correo: 'actualizado@test.com' });
    expect(res.status).toBe(200);
  });

  test('PUT /api/users/:id - 404 usuario no existe', async () => {
    const res = await request(app)
      .put('/api/users/99999')
      .set('Authorization', 'Bearer fake-token')
      .send({ nombre: 'x', correo: 'x@x.com' });
    expect(res.status).toBe(404);
  });

  test('PUT /api/users/:id - 400 faltan campos', async () => {
    const res = await request(app)
      .put('/api/users/1')
      .set('Authorization', 'Bearer fake-token')
      .send({});
    expect(res.status).toBe(400);
  });

});