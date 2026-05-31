import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Los mocks DEBEN ir antes de cualquier import del código fuente
jest.unstable_mockModule('../../src/config/cache.js', () => ({
  deletePattern: jest.fn(),
  getCache: jest.fn(),
  setCache: jest.fn(),
  deleteCache: jest.fn(),
  TTL: { RESTAURANTS: 86400, MENUS: 86400, SEARCH: 60 }
}));

const { ReservationService } = await import('../../src/services/reservations.service.js');

describe('ReservationService', () => {

  let mockReservationDAO;
  let mockUserDAO;
  let service;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReservationDAO = {
      create: jest.fn(),
      findById: jest.fn(),
      cancel: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };

    mockUserDAO = {
      findByExternalId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };

    service = new ReservationService(mockReservationDAO, mockUserDAO);
  });

  // ── create ────────────────────────────────────────────────

  test('create - crea reserva correctamente', async () => {
    mockUserDAO.findByExternalId.mockResolvedValue({ id: 1 });
    mockReservationDAO.create.mockResolvedValue({ id: 42 });

    const result = await service.create({
      keycloakId: 'uuid-123',
      id_restaurante: 1,
      id_mesa: 1,
      fecha: '2027-01-01',
      duracion: 90,
      personas: 4
    });

    expect(mockUserDAO.findByExternalId).toHaveBeenCalledWith('uuid-123');
    expect(mockReservationDAO.create).toHaveBeenCalledWith({
      id_usuario: 1,
      id_restaurante: 1,
      id_mesa: 1,
      fecha: '2027-01-01',
      duracion: 90,
      personas: 4
    });
    expect(result).toHaveProperty('id', 42);
  });

  test('create - lanza error si usuario no existe', async () => {
    mockUserDAO.findByExternalId.mockResolvedValue(null);

    await expect(service.create({
      keycloakId: 'uuid-xxx',
      id_restaurante: 1,
      id_mesa: 1,
      fecha: '2027-01-01',
      duracion: 90,
      personas: 4
    })).rejects.toThrow('Usuario no encontrado en base de datos');
  });

  // ── cancel ────────────────────────────────────────────────

  test('cancel - cancela correctamente', async () => {
    mockReservationDAO.findById.mockResolvedValue({ id: 1, estado: 'reservada' });
    mockReservationDAO.cancel.mockResolvedValue(true);

    const result = await service.cancel(1);

    expect(mockReservationDAO.findById).toHaveBeenCalledWith(1);
    expect(mockReservationDAO.cancel).toHaveBeenCalledWith(1);
    expect(result).toBe(true);
  });

  test('cancel - lanza error si reserva no existe', async () => {
    mockReservationDAO.findById.mockResolvedValue(null);

    await expect(service.cancel(99999))
      .rejects.toThrow('Reserva no encontrada');

    expect(mockReservationDAO.cancel).not.toHaveBeenCalled();
  });

});