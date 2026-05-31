import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const { UserService } = await import('../../src/services/users.service.js');

describe('UsersService', () => {

  let mockDAO;
  let service;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDAO = {
      findByExternalId: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };

    service = new UserService(mockDAO);
  });

  // ── getMe ─────────────────────────────────────────────────

  test('getMe → retorna usuario por keycloakId', async () => {
    mockDAO.findByExternalId.mockResolvedValue({ id: 1, nombre: 'Juan' });

    const result = await service.getMe('uuid-123');

    expect(mockDAO.findByExternalId).toHaveBeenCalledWith('uuid-123');
    expect(result).toEqual({ id: 1, nombre: 'Juan' });
  });

  test('getMe → retorna null si usuario no existe', async () => {
    mockDAO.findByExternalId.mockResolvedValue(null);

    const result = await service.getMe('uuid-inexistente');

    expect(result).toBeNull();
  });

  // ── update ────────────────────────────────────────────────

  test('update → éxito', async () => {
    // findById confirma que el usuario existe
    mockDAO.findById.mockResolvedValue({ id: 1, nombre: 'Juan' });
    mockDAO.update.mockResolvedValue({ id: 1, nombre: 'Nuevo', correo: 'nuevo@test.com' });

    const result = await service.update('1', {
      nombre: 'Nuevo',
      correo: 'nuevo@test.com'
    });

    expect(mockDAO.findById).toHaveBeenCalledWith('1');
    expect(mockDAO.update).toHaveBeenCalledWith('1', {
      nombre: 'Nuevo',
      correo: 'nuevo@test.com'
    });
    expect(result).toHaveProperty('nombre', 'Nuevo');
  });

  test('update → lanza error si usuario no existe', async () => {
    mockDAO.findById.mockResolvedValue(null);

    await expect(service.update('99', { nombre: 'x' }))
      .rejects.toThrow('Usuario no encontrado');
  });

  // ── delete ────────────────────────────────────────────────

  test('delete → éxito', async () => {
    mockDAO.findById.mockResolvedValue({ id: 1 });
    mockDAO.delete.mockResolvedValue(true);

    const result = await service.delete('1');

    expect(mockDAO.findById).toHaveBeenCalledWith('1');
    expect(mockDAO.delete).toHaveBeenCalledWith('1');
    expect(result).toBe(true);
  });

  test('delete → lanza error si usuario no existe', async () => {
    mockDAO.findById.mockResolvedValue(null);

    await expect(service.delete('99'))
      .rejects.toThrow('Usuario no encontrado');
  });

});