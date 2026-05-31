/**
 * MenuController — Maneja POST, GET /:id, PUT /:id, DELETE /:id de /menus.
 *
 */
export class MenuController {
  /** @param {import('../services/menus.service.js').MenuService} menuService */
  constructor(menuService) {
    this.service = menuService;
  }

  create = async (req, res) => {
    try {
      const { nombre, id_restaurante } = req.body;

      if (!nombre || !id_restaurante) {
        return res.status(400).json({ error: 'nombre e id_restaurante son obligatorios' });
      }

      const result = await this.service.create({ nombre, id_restaurante });
      res.status(201).json({ message: 'Menú creado correctamente', id: result.id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  findById = async (req, res) => {
    try {
      const { id } = req.params;
      const menu = await this.service.findById(id);

      if (!menu) {
        return res.status(404).json({ error: 'Menú no encontrado' });
      }

      res.status(200).json(menu);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  update = async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre } = req.body;

      if (!nombre) {
        return res.status(400).json({ error: 'nombre es obligatorio' });
      }

      const updated = await this.service.update(id, { nombre });
      res.status(200).json({ message: 'Menú actualizado correctamente', data: updated });
    } catch (error) {
      const status = error.message === 'Menú no encontrado' ? 404 : 500;
      res.status(status).json({ error: error.message });
    }
  };

  remove = async (req, res) => {
    try {
      const { id } = req.params;
      await this.service.delete(id);
      res.status(200).json({ message: 'Menú eliminado correctamente' });
    } catch (error) {
      const status = error.message === 'Menú no encontrado' ? 404 : 500;
      res.status(status).json({ error: error.message });
    }
  };
}