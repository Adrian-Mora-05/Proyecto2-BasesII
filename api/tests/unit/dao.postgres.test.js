import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock del pool de PostgreSQL
// El pool tiene connect() que devuelve un client con query() y release()
const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient)
};

// Mockea postgresdb para inyectar el pool mockeado
jest.unstable_mockModule('../../src/config/postgresdb.js', () => ({
  pool: mockPool,
  query: jest.fn()
}));

// Importa los DAOs DESPUÉS del mock
const { RestaurantDAOPostgres }  = await import('../../src/dao/postgres/entities/RestaurantDAOPostgres.js');
const { MenuDAOPostgres }        = await import('../../src/dao/postgres/entities/MenuDAOPostgres.js');
const { UserDAOPostgres }        = await import('../../src/dao/postgres/entities/UserDAOPostgres.js');
const { ReservationDAOPostgres } = await import('../../src/dao/postgres/entities/ReservationDAOPostgres.js');
const { OrderDAOPostgres }       = await import('../../src/dao/postgres/entities/OrderDAOPostgres.js');

// ============================================================
// RestaurantDAOPostgres
// ============================================================
describe('RestaurantDAOPostgres', () => {

  let dao;

  beforeEach(() => {
    jest.clearAllMocks();
    // Inyecta el pool mockeado por constructor
    dao = new RestaurantDAOPostgres(mockPool);
  });

  test('create - llama al stored procedure correcto', async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

    const result = await dao.create({ nombre: 'La Trattoria', direccion: 'Cartago', telefono: '2550-1234' });

    // Verifica que llamó a la función SQL correcta
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT restaurant.registrar_restaurante($1, $2, $3) AS id',
      ['La Trattoria', 'Cartago', '2550-1234']
    );
    expect(result).toEqual({ id: 1 });
  });

  test('findAll - llama a listar_restaurantes', async () => {
    mockClient.query.mockResolvedValue({
      rows: [
        { id: 1, nombre: 'La Trattoria' },
        { id: 2, nombre: 'El Fogón' }
      ]
    });

    const result = await dao.findAll();

    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM restaurant.listar_restaurantes()',[]
    );
    expect(result).toHaveLength(2);
  });

  test('findById - retorna el restaurante correcto', async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1, nombre: 'La Trattoria' }] });

    const result = await dao.findById(1);

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      [1]
    );
    expect(result).toHaveProperty('id', 1);
  });

  test('findById - retorna null si no existe', async () => {
    mockClient.query.mockResolvedValue({ rows: [] });

    const result = await dao.findById(99999);

    expect(result).toBeNull();
  });

  test('libera el cliente después de cada query', async () => {
    mockClient.query.mockResolvedValue({ rows: [] });

    await dao.findAll();

    // Verifica que release() fue llamado para devolver el cliente al pool
    expect(mockClient.release).toHaveBeenCalled();
  });

});

// ============================================================
// MenuDAOPostgres
// ============================================================
describe('MenuDAOPostgres', () => {

  let dao;

  beforeEach(() => {
    jest.clearAllMocks();
    dao = new MenuDAOPostgres(mockPool);
  });

  test('create - llama a crear_menu con los parámetros correctos', async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

    const result = await dao.create({ nombre: 'Menú Principal', id_restaurante: 1 });

    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT restaurant.crear_menu($1, $2) AS id',
      ['Menú Principal', 1]
    );
    expect(result).toEqual({ id: 1 });
  });

  test('findById - llama a get_detalles_menu', async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1, nombre: 'Menú Principal' }] });

    const result = await dao.findById(1);

    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM restaurant.get_detalles_menu($1)',
      [1]
    );
    expect(result).toHaveProperty('nombre', 'Menú Principal');
  });

  test('findById - retorna null si no existe', async () => {
    mockClient.query.mockResolvedValue({ rows: [] });

    const result = await dao.findById(99999);

    expect(result).toBeNull();
  });

  test('update - llama a actualizar_menu', async () => {
    // Primera query: actualizar_menu
    mockClient.query.mockResolvedValueOnce({ rows: [] });
    // Segunda query: findById para retornar el menú actualizado
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1, nombre: 'Nuevo nombre' }] });

    await dao.update(1, { nombre: 'Nuevo nombre' });

    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT restaurant.actualizar_menu($1, $2) AS updated',
      [1, 'Nuevo nombre']
    );
  });

  test('delete - llama a borrar_menu', async () => {
    mockClient.query.mockResolvedValue({ rows: [] });

    const result = await dao.delete(1);

    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT restaurant.borrar_menu($1)',
      [1]
    );
    expect(result).toBe(true);
  });

  test('findByRestaurant - filtra por id_restaurante', async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1, nombre: 'Menú' }] });

    const result = await dao.findByRestaurant(1);

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('id_restaurante = $1'),
      [1]
    );
    expect(result).toHaveLength(1);
  });

});

// ============================================================
// UserDAOPostgres
// ============================================================
describe('UserDAOPostgres', () => {

  let dao;

  beforeEach(() => {
    jest.clearAllMocks();
    dao = new UserDAOPostgres(mockPool);
  });

  test('findByExternalId - busca por keycloakId', async () => {
    mockClient.query.mockResolvedValue({
      rows: [{ id: 1, nombre: 'Juan', correo: 'j@j.com', rol: 'cliente' }]
    });

    const result = await dao.findByExternalId('uuid-123');

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('id_external_auth = $1'),
      ['uuid-123']
    );
    expect(result).toHaveProperty('nombre', 'Juan');
  });

  test('findByExternalId - retorna null si no existe', async () => {
    mockClient.query.mockResolvedValue({ rows: [] });

    const result = await dao.findByExternalId('uuid-inexistente');

    expect(result).toBeNull();
  });

  test('createFromKeycloak - resuelve el rol y crea el usuario', async () => {
    // Primera query: buscar id del rol
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    // Segunda query: insert usuario
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const result = await dao.createFromKeycloak({
      keycloakId: 'uuid-123',
      nombre: 'Juan Pérez',
      correo: 'juan@test.com',
      rol: 'cliente'
    });

    expect(result).toHaveProperty('id', 1);
  });

  test('createFromKeycloak - lanza error si rol no existe', async () => {
    // Rol no encontrado en la BD
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await expect(dao.createFromKeycloak({
      keycloakId: 'uuid-123',
      nombre: 'Juan',
      correo: 'juan@test.com',
      rol: 'inexistente'
    })).rejects.toThrow("Rol 'inexistente' no encontrado en base de datos");
  });

  test('update - actualiza nombre y correo', async () => {
    mockClient.query.mockResolvedValue({
      rows: [{ id: 1, nombre: 'Nuevo', correo: 'nuevo@test.com' }]
    });

    const result = await dao.update(1, { nombre: 'Nuevo', correo: 'nuevo@test.com' });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE restaurant.usuario'),
      expect.arrayContaining(['Nuevo', 'nuevo@test.com', 1])
    );
    expect(result).toHaveProperty('nombre', 'Nuevo');
  });

  test('update - lanza error si no hay campos para actualizar', async () => {
    await expect(dao.update(1, {}))
      .rejects.toThrow('No hay campos para actualizar');
  });

  test('delete - elimina el usuario', async () => {
    mockClient.query.mockResolvedValue({ rowCount: 1 });

    const result = await dao.delete(1);

    expect(result).toBe(true);
  });

  test('delete - retorna false si no existe', async () => {
    mockClient.query.mockResolvedValue({ rowCount: 0 });

    const result = await dao.delete(99999);

    expect(result).toBe(false);
  });

});

// ============================================================
// ReservationDAOPostgres
// ============================================================
describe('ReservationDAOPostgres', () => {

  let dao;

  beforeEach(() => {
    jest.clearAllMocks();
    dao = new ReservationDAOPostgres(mockPool);
  });

  test('create - llama a reservar con los parámetros correctos', async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 42 }] });

    const result = await dao.create({
      id_usuario: 1,
      id_restaurante: 1,
      id_mesa: 1,
      fecha: '2027-01-01',
      duracion: 90,
      personas: 4
    });

    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT restaurant.reservar($1, $2, $3, $4, $5, $6) AS id',
      [1, 1, 1, '2027-01-01', 90, 4]
    );
    expect(result).toHaveProperty('id', 42);
  });

  test('create - lanza error si no retorna id', async () => {
    mockClient.query.mockResolvedValue({ rows: [{}] });

    await expect(dao.create({
      id_usuario: 1,
      id_restaurante: 1,
      id_mesa: 1,
      fecha: '2027-01-01',
      duracion: 90,
      personas: 4
    })).rejects.toThrow('No se pudo crear la reserva');
  });

  test('cancel - llama a cancelar_reserva', async () => {
    mockClient.query.mockResolvedValue({ rows: [] });

    const result = await dao.cancel(1);

    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT restaurant.cancelar_reserva($1)',
      [1]
    );
    expect(result).toBe(true);
  });

  test('findById - retorna la reservación correcta', async () => {
    mockClient.query.mockResolvedValue({
      rows: [{ id: 1, estado: 'reservada' }]
    });

    const result = await dao.findById(1);

    expect(result).toHaveProperty('estado', 'reservada');
  });

});

// ============================================================
// OrderDAOPostgres
// ============================================================
describe('OrderDAOPostgres', () => {

  let dao;

  beforeEach(() => {
    jest.clearAllMocks();
    dao = new OrderDAOPostgres(mockPool);
  });

  test('create - llama a realizar_pedido', async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 42 }] });

    const result = await dao.create({
      id_usuario: 1,
      id_restaurante: 1,
      descripcion: 'Para llevar',
      tipo_pedido: 'para llevar',
      platos: [{ id_plato: 1, cantidad: 2 }]
    });

    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT restaurant.realizar_pedido($1, $2, $3, $4, $5) AS id',
      expect.any(Array)
    );
    expect(result).toHaveProperty('id', 42);
  });

  test('create - lanza error si no retorna id', async () => {
    mockClient.query.mockResolvedValue({ rows: [{}] });

    await expect(dao.create({
      id_usuario: 1,
      id_restaurante: 1,
      descripcion: 'desc',
      tipo_pedido: 'para llevar',
      platos: []
    })).rejects.toThrow('No se pudo crear el pedido');
  });

  test('findById - retorna el pedido correcto', async () => {
    mockClient.query.mockResolvedValue({
      rows: [{ id: 1, descripcion: 'Para llevar' }]
    });

    const result = await dao.findById(1);

    expect(result).toHaveProperty('id', 1);
  });

  test('findById - retorna null si no existe', async () => {
    mockClient.query.mockResolvedValue({ rows: [] });

    const result = await dao.findById(99999);

    expect(result).toBeNull();
  });

});