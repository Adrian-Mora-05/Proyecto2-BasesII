/**
 * OrderService — Lógica de negocio para pedidos.
 *
 */
export class OrderService {
  /**
   * @param {import('../dao/interfaces/BaseDAO.js').BaseDAO} orderDAO
   * @param {import('../dao/interfaces/BaseDAO.js').BaseDAO} userDAO
   * @param {import('../dao/interfaces/BaseDAO.js').BaseDAO} restaurantDAO
   */
  constructor(orderDAO, userDAO, restaurantDAO) {
    this.orderDAO      = orderDAO;
    this.userDAO       = userDAO;
    this.restaurantDAO = restaurantDAO;
  }

  /**
   * Crea un pedido validando usuario y restaurante primero.
   *
   * Flujo:
   *  1. Resolver ID local del usuario desde su keycloakId
   *  2. Validar que el restaurante existe
   *  3. Persistir el pedido con los datos ya validados
   *
   * @param {{
   *   keycloakId: string,
   *   id_restaurante: string|number,
   *   descripcion: string,
   *   tipo_pedido: string,
   *   platos: Array<{ id_plato: string|number, cantidad: number }>
   * }} data
   * @returns {Promise<{ id: string|number }>}
   */
  async create({ keycloakId, id_restaurante, descripcion, tipo_pedido, platos }) {
    // 1. Resolver usuario local
    const usuario = await this.userDAO.findByExternalId(keycloakId);
    if (!usuario) throw new Error('Usuario no encontrado en base de datos');

    // 2. Validar restaurante
    const restaurante = await this.restaurantDAO.findById(id_restaurante);
    if (!restaurante) throw new Error(`Restaurante ${id_restaurante} no existe`);

    // 3. Crear el pedido
    return this.orderDAO.create({
      id_usuario:     usuario.id,
      id_restaurante,
      descripcion,
      tipo_pedido,
      platos,
    });
  }

  /**
   * @param {string|number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const order = await this.orderDAO.findById(id);
    if (!order) throw new Error('Pedido no encontrado');
    return order;
  }
}