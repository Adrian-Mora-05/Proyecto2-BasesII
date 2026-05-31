/**
 * ReservationController — Maneja POST /reservations y DELETE /reservations/:id.
 *
 */
export class ReservationController {
  /** @param {import('../services/reservations.service.js').ReservationService} reservationService */
  constructor(reservationService) {
    this.service = reservationService;
  }

  create = async (req, res) => {
    try {
      const { id_restaurante, id_mesa, fecha_hora, duracion, cant_personas } = req.body;

      if (!id_restaurante || !id_mesa || !fecha_hora || !duracion || !cant_personas) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
      }

      const keycloakId = req.auth?.sub;

      const result = await this.service.create({
        keycloakId,
        id_restaurante,
        id_mesa,
        fecha:    fecha_hora,
        duracion,
        personas: cant_personas,
      });

      res.status(201).json({ message: 'Reserva creada correctamente', id: result.id });
    } catch (error) {
      if (error.message.includes('ya está reservada')) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  };

  remove = async (req, res) => {
    try {
      const { id } = req.params;
      await this.service.cancel(id);
      res.status(200).json({ message: 'Reserva cancelada correctamente' });
    } catch (error) {
      const status = error.message === 'Reserva no encontrada' ? 404 : 500;
      res.status(status).json({ error: error.message });
    }
  };
}