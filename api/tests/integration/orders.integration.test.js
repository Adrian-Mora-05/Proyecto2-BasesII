import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';

jest.unstable_mockModule('../../src/middlewares/auth.js', () => ({
  checkJwt: (req, res, next) => { req.auth = { sub: 'orders-test-uuid', roles: ['cliente'] }; next(); },
  optionalJwt: (req, res, next) => { req.auth = null; next(); }
}));

const { createApp } = await import('../../src/app.js');
const { default: request } = await import('supertest');
const { query } = await import('../../src/config/postgresdb.js');

let app;
let restauranteId, menuId, platoId, orderId;

beforeAll(async () => {
  app = await createApp();

  const restRes = await query(
    `INSERT INTO restaurant.restaurante (nombre, direccion, telefono)
     VALUES ('Rest Orders Test', 'Dir', '0000') RETURNING id`
  );
  restauranteId = restRes.rows[0].id;

  const menuRes = await query(
    `INSERT INTO restaurant.menu (nombre, id_restaurante)
     VALUES ('Menu Test', $1) RETURNING id`, [restauranteId]
  );
  menuId = menuRes.rows[0].id;

  const platoRes = await query(
    `INSERT INTO restaurant.plato (nombre, precio, id_menu)
     VALUES ('Plato Test', 9500, $1) RETURNING id`, [menuId]
  );
  platoId = platoRes.rows[0].id;

  await query(
    `INSERT INTO restaurant.usuario (id_external_auth, nombre, correo, id_rol_usuario)
     VALUES ('orders-test-uuid', 'Orders User', 'orders@test.com',
       (SELECT id FROM restaurant.rol_usuario WHERE nombre = 'cliente'))
     ON CONFLICT (correo) DO UPDATE
       SET id_external_auth = 'orders-test-uuid', nombre = 'Orders User'`
  );
});

afterAll(async () => {
  if (orderId) {
    await query(`DELETE FROM restaurant.plato_x_pedido WHERE id_pedido = $1`, [orderId]);
    await query(`DELETE FROM restaurant.pedido WHERE id = $1`, [orderId]);
  }
  await query(
    `DELETE FROM restaurant.plato WHERE id_menu IN
     (SELECT id FROM restaurant.menu WHERE id_restaurante = $1)`, [restauranteId]
  );
  await query(`DELETE FROM restaurant.menu WHERE id_restaurante = $1`, [restauranteId]);
  await query(`DELETE FROM restaurant.restaurante WHERE id = $1`, [restauranteId]);
  await query(`DELETE FROM restaurant.usuario WHERE id_external_auth = 'orders-test-uuid'`);
});

describe('Orders Integration', () => {

  test('POST /api/orders - 201 pedido creado', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer fake-token')
      .send({ id_restaurante: restauranteId, descripcion: 'Para llevar', id_tipo_pedido: 1, platos: [{ id_plato: platoId, cantidad: 2 }] });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    orderId = res.body.id;
  });

  test('POST /api/orders - 400 datos incompletos', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer fake-token')
      .send({ id_restaurante: restauranteId });
    expect(res.status).toBe(400);
  });

  test('POST /api/orders - 400 restaurante no existe', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer fake-token')
      .send({ id_restaurante: 99999, id_tipo_pedido: 1, platos: [{ id_plato: platoId, cantidad: 1 }] });
    expect(res.status).toBe(400);
  });

  test('GET /api/orders/:id - 200 pedido encontrado', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  test('GET /api/orders/:id - 404 pedido no existe', async () => {
    const res = await request(app)
      .get('/api/orders/99999')
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(404);
  });

});