import { jest, describe, test, expect, beforeAll } from '@jest/globals';

const mockRegistrarUsuario = jest.fn().mockResolvedValue(true);
const mockLoginUser = jest.fn().mockResolvedValue({ access_token: 'fake-token', expires_in: 300 });

jest.unstable_mockModule('../../src/middlewares/auth.js', () => ({
  checkJwt: (req, res, next) => { req.auth = { sub: 'test-uuid', roles: ['admin'] }; next(); },
  optionalJwt: (req, res, next) => { req.auth = null; next(); }
}));

jest.unstable_mockModule('../../src/services/auth.service.js', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    register: mockRegistrarUsuario,
    login: mockLoginUser
  }))
}));

const { createApp } = await import('../../src/app.js');
const { default: request } = await import('supertest');

let app;

beforeAll(async () => {
  app = await createApp();
});

describe('Auth Integration', () => {

  test('POST /api/auth/register - 201 registro exitoso', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'integtest', email: 'integ@test.com', firstName: 'Integ', lastName: 'Test', password: 'pass123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'Usuario registrado correctamente');
  });

  test('POST /api/auth/register - 400 faltan campos', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'solo' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login - 200 login exitoso', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin2', password: 'admin456' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
  });

  test('POST /api/auth/login - 400 faltan credenciales', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin2' });
    expect(res.status).toBe(400);
  });

});