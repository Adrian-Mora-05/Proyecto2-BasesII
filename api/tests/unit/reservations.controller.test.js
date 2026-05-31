import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockReservationService = {
  create: jest.fn(),
  cancel: jest.fn()
};

const { ReservationController } = await import('../../src/controllers/reservations.controller.js');

const controller = new ReservationController(mockReservationService);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ReservationController - create', () => {

  beforeEach(() => jest.clearAllMocks());

  test('201 - reserva creada', async () => {
    mockReservationService.create.mockResolvedValue({ id: 1 });
    const req = {
      auth: { sub: 'uuid-123' },
      body: { id_restaurante: 1, id_mesa: 1, fecha_hora: '2026-04-01T19:00:00', duracion: 90, cant_personas: 4 }
    };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Reserva creada correctamente', id: 1 });
  });

  test('400 - faltan datos', async () => {
    const req = { auth: { sub: 'uuid-123' }, body: { id_restaurante: 1 } };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('409 - conflicto de horario', async () => {
    mockReservationService.create.mockRejectedValue(new Error('La mesa ya está reservada en ese horario'));
    const req = {
      auth: { sub: 'uuid-123' },
      body: { id_restaurante: 1, id_mesa: 1, fecha_hora: '2026-04-01T19:00:00', duracion: 90, cant_personas: 4 }
    };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('500 - error del servicio', async () => {
    mockReservationService.create.mockRejectedValue(new Error('Error de BD'));
    const req = {
      auth: { sub: 'uuid-123' },
      body: { id_restaurante: 1, id_mesa: 1, fecha_hora: '2026-04-01T19:00:00', duracion: 90, cant_personas: 4 }
    };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});

describe('ReservationController - remove', () => {

  beforeEach(() => jest.clearAllMocks());

  test('200 - reserva cancelada', async () => {
    mockReservationService.cancel.mockResolvedValue(true);
    const req = { params: { id: '1' } };
    const res = mockRes();
    await controller.remove(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Reserva cancelada correctamente' });
  });

  test('404 - reserva no encontrada', async () => {
    mockReservationService.cancel.mockRejectedValue(new Error('Reserva no encontrada'));
    const req = { params: { id: '9999' } };
    const res = mockRes();
    await controller.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('500 - error del servicio', async () => {
    mockReservationService.cancel.mockRejectedValue(new Error('Error de BD'));
    const req = { params: { id: '1' } };
    const res = mockRes();
    await controller.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

});