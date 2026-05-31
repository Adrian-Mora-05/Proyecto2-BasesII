import { jest, describe, test, expect } from '@jest/globals';
import { requireRole } from '../../src/middlewares/roles.js';

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireRole middleware', () => {

  test('401 - sin autenticación (req.auth es null)', () => {
    const middleware = requireRole('admin');
    const req = { auth: null };
    const res = mockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('403 - rol insuficiente usando req.auth.roles', () => {
    const middleware = requireRole('admin');
    const req = { auth: { roles: ['cliente'] } };
    const res = mockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('403 - rol insuficiente usando realm_access.roles', () => {
    const middleware = requireRole('admin');
    const req = { auth: { realm_access: { roles: ['cliente'] } } };
    const res = mockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('403 - auth existe pero sin roles ni realm_access', () => {
    const middleware = requireRole('admin');
    const req = { auth: {} }; // auth existe pero vacío
    const res = mockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('next() - rol correcto usando req.auth.roles', () => {
    const middleware = requireRole('admin');
    const req = { auth: { roles: ['admin'] } };
    const res = mockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('next() - rol correcto usando realm_access.roles', () => {
    const middleware = requireRole('admin');
    const req = { auth: { realm_access: { roles: ['admin'] } } };
    const res = mockRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});