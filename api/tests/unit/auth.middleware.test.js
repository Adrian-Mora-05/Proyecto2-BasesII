import { jest, describe, test, expect } from '@jest/globals';

// Mockea express-jwt para no conectarse a Keycloak real
jest.unstable_mockModule('express-jwt', () => ({
  expressjwt: jest.fn(() => (req, res, next) => next())
}));

// Mockea jwks-rsa para no hacer llamadas HTTP reales
jest.unstable_mockModule('jwks-rsa', () => ({
  default: {
    expressJwtSecret: jest.fn(() => 'mock-secret')
  }
}));

const { checkJwt, optionalJwt } = await import('../../src/middlewares/auth.js');

describe('auth middleware', () => {

  test('checkJwt es una función middleware', () => {
    // Verifica que checkJwt es una función que Express puede usar como middleware
    expect(typeof checkJwt).toBe('function');
  });

  test('optionalJwt es una función middleware', () => {
    // Verifica que optionalJwt es una función que Express puede usar como middleware
    expect(typeof optionalJwt).toBe('function');
  });

  test('checkJwt llama next() cuando el token es válido', () => {
    const req = { headers: { authorization: 'Bearer fake-token' } };
    const res = {};
    const next = jest.fn();

    checkJwt(req, res, next);

    // El mock siempre llama next() simulando token válido
    expect(next).toHaveBeenCalled();
  });

  test('optionalJwt llama next() aunque no haya token', () => {
    //optionalJwt no debe bloquear peticiones sin token
    const req = { headers: {} };
    const res = {};
    const next = jest.fn();

    optionalJwt(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('checkJwt y optionalJwt son middlewares distintos', () => {
    // Verifica que son instancias diferentes aunque usen la misma configuración base
    expect(checkJwt).not.toBe(optionalJwt);
  });

});