import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';

jest.unstable_mockModule('../../src/middlewares/auth.js', () => ({
  checkJwt: (req, res, next) => { req.auth = { sub: 'reservations-test-uuid', roles: ['cliente'] }; next(); },
  optionalJwt: (req, res, next) => { req.auth = null; next(); }
}));

const { createApp } = await import('../../src/app.js');
const { default: request } = await import('supertest');
const { query } = await import('../../src/config/postgresdb.js');

let app;
let restauranteId, mesaId, reservaId;

beforeAll(async () => {
  app = await createApp();

  const restRes = await query(
    `INSERT INTO restaurant.restaurante (nombre, direccion, telefono)
     VALUES ('Rest Reservas Test', 'Dir', '0000') RETURNING id`
  );
  restauranteId = restRes.rows[0].id;

  const mesaRes = await query(
    `INSERT INTO restaurant.mesa (num_mesa, capacidad, id_restaurante)
     VALUES (99, 4, $1) RETURNING id`, [restauranteId]
  );
  mesaId = mesaRes.rows[0].id;

  await query(
    `INSERT INTO restaurant.usuario (id_external_auth, nombre, correo, id_rol_usuario)
     VALUES ('reservations-test-uuid', 'Reservations User', 'reservations@test.com',
       (SELECT id FROM restaurant.rol_usuario WHERE nombre = 'cliente'))
     ON CONFLICT (correo) DO UPDATE
       SET id_external_auth = 'reservations-test-uuid', nombre = 'Reservations User'`
  );
});

afterAll(async () => {
  await query(`DELETE FROM restaurant.reservacion WHERE id_restaurante = $1`, [restauranteId]);
  await query(`DELETE FROM restaurant.mesa WHERE id_restaurante = $1`, [restauranteId]);
  await query(`DELETE FROM restaurant.restaurante WHERE id = $1`, [restauranteId]);
  await query(`DELETE FROM restaurant.usuario WHERE id_external_auth = 'reservations-test-uuid'`);
});

describe('Reservations Integration', () => {

  test('POST /api/reservations - 201 reserva creada', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', 'Bearer fake-token')
      .send({ id_restaurante: restauranteId, id_mesa: mesaId, fecha_hora: '2027-04-01T19:00:00', duracion: 90, cant_personas: 4 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    reservaId = res.body.id;
  });

  test('POST /api/reservations - 400 faltan datos', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', 'Bearer fake-token')
      .send({ id_restaurante: restauranteId });
    expect(res.status).toBe(400);
  });

  test('DELETE /api/reservations/:id - 200 cancela reserva', async () => {
    const res = await request(app)
      .delete(`/api/reservations/${reservaId}`)
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(200);
  });

  test('DELETE /api/reservations/:id - 404 reserva no existe', async () => {
    const res = await request(app)
      .delete('/api/reservations/99999')
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(404);
  });

});