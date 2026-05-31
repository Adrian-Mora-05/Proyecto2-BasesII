import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { ObjectId } from 'mongodb';

// Mock de la colección de MongoDB
const mockCollection = {
  find: jest.fn(),
  findOne: jest.fn(),
  insertOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  deleteOne: jest.fn(),
  updateOne: jest.fn()
};

// find() devuelve un cursor con toArray()
mockCollection.find.mockReturnValue({
  toArray: jest.fn().mockResolvedValue([])
});

// Mock de la db que devuelve la colección mockeada
const mockDb = {
  collection: jest.fn().mockReturnValue(mockCollection)
};

// Mockea mongo.js para inyectar la db mockeada
jest.unstable_mockModule('../../src/config/mongo.js', () => ({
  getMongo: jest.fn().mockReturnValue(mockDb),
  connectMongo: jest.fn()
}));

// Importa los DAOs DESPUÉS del mock
const { RestaurantDAOMongo }  = await import('../../src/dao/mongodb/entities/RestaurantDAOMongo.js');
const { MenuDAOMongo }        = await import('../../src/dao/mongodb/entities/MenuDAOMongo.js');
const { UserDAOMongo }        = await import('../../src/dao/mongodb/entities/UserDAOMongo.js');
const { ReservationDAOMongo } = await import('../../src/dao/mongodb/entities/ReservationDAOMongo.js');
const { OrderDAOMongo }       = await import('../../src/dao/mongodb/entities/OrderDAOMongo.js');

// Helper para crear un ObjectId de prueba
const testId = new ObjectId();

// ============================================================
// RestaurantDAOMongo
// ============================================================
describe('RestaurantDAOMongo', () => {

  let dao;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
    dao = new RestaurantDAOMongo(mockDb);
  });

  test('create - inserta un restaurante correctamente', async () => {
    const insertedId = new ObjectId();
    mockCollection.insertOne.mockResolvedValue({ insertedId });

    const result = await dao.create({
      nombre: 'La Trattoria',
      direccion: 'Cartago',
      telefono: '2550-1234'
    });

    expect(mockCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'La Trattoria' })
    );
    // El resultado tiene id como string (normalizado por _normalize)
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('nombre', 'La Trattoria');
  });

  test('findAll - retorna todos los restaurantes normalizados', async () => {
    const id1 = new ObjectId();
    const id2 = new ObjectId();
    mockCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([
        { _id: id1, nombre: 'La Trattoria' },
        { _id: id2, nombre: 'El Fogón' }
      ])
    });

    const result = await dao.findAll();

    expect(result).toHaveLength(2);
    // Verifica que _id fue normalizado a id como string
    expect(result[0]).toHaveProperty('id', id1.toString());
    expect(result[0]).toHaveProperty('nombre', 'La Trattoria');
  });

  test('findById - retorna el restaurante correcto', async () => {
    const id = new ObjectId();
    mockCollection.findOne.mockResolvedValue({ _id: id, nombre: 'La Trattoria' });

    const result = await dao.findById(id.toString());

    expect(result).toHaveProperty('nombre', 'La Trattoria');
    expect(result.id).toBe(id.toString());
  });

  test('findById - retorna null si no existe', async () => {
    mockCollection.findOne.mockResolvedValue(null);

    const result = await dao.findById(new ObjectId().toString());

    expect(result).toBeNull();
  });

  test('delete - elimina el restaurante', async () => {
    mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

    const result = await dao.delete(new ObjectId().toString());

    expect(result).toBe(true);
  });

  test('delete - retorna false si no existe', async () => {
    mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 });

    const result = await dao.delete(new ObjectId().toString());

    expect(result).toBe(false);
  });

});

// ============================================================
// MenuDAOMongo
// ============================================================
describe('MenuDAOMongo', () => {

  let dao;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
    dao = new MenuDAOMongo(mockDb);
  });

  test('create - inserta un menú con ultima_actualizacion', async () => {
    const insertedId = new ObjectId();
    mockCollection.insertOne.mockResolvedValue({ insertedId });

    const result = await dao.create({ nombre: 'Menú Principal', id_restaurante: '1' });

    expect(mockCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Menú Principal',
        ultima_actualizacion: expect.any(Date)
      })
    );
    expect(result).toHaveProperty('nombre', 'Menú Principal');
  });

  test('update - actualiza el nombre y ultima_actualizacion', async () => {
    const id = new ObjectId();
    mockCollection.findOneAndUpdate.mockResolvedValue({
      _id: id,
      nombre: 'Nuevo nombre',
      ultima_actualizacion: new Date()
    });

    const result = await dao.update(id.toString(), { nombre: 'Nuevo nombre' });

    expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.any(ObjectId) },
      { $set: expect.objectContaining({ nombre: 'Nuevo nombre', ultima_actualizacion: expect.any(Date) }) },
      { returnDocument: 'after' }
    );
  });

  test('findByRestaurant - filtra por id_restaurante', async () => {
    mockCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([
        { _id: new ObjectId(), nombre: 'Menú 1', id_restaurante: '1' }
      ])
    });

    const result = await dao.findByRestaurant('1');

    expect(mockCollection.find).toHaveBeenCalledWith({ id_restaurante: '1' });
    expect(result).toHaveLength(1);
  });

});

// ============================================================
// UserDAOMongo
// ============================================================
describe('UserDAOMongo', () => {

  let dao;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
    dao = new UserDAOMongo(mockDb);
  });

  test('createFromKeycloak - crea usuario con los campos correctos', async () => {
    const insertedId = new ObjectId();
    mockCollection.insertOne.mockResolvedValue({ insertedId });

    const result = await dao.createFromKeycloak({
      keycloakId: 'uuid-123',
      nombre: 'Juan Pérez',
      correo: 'juan@test.com',
      rol: 'cliente'
    });

    expect(mockCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        id_external_auth: 'uuid-123',
        nombre: 'Juan Pérez',
        correo: 'juan@test.com',
        rol: 'cliente'
      })
    );
  });

  test('findByExternalId - busca por keycloakId', async () => {
    const id = new ObjectId();
    mockCollection.findOne.mockResolvedValue({
      _id: id,
      id_external_auth: 'uuid-123',
      nombre: 'Juan',
      correo: 'j@j.com',
      rol: 'cliente'
    });

    const result = await dao.findByExternalId('uuid-123');

    expect(mockCollection.findOne).toHaveBeenCalledWith({ id_external_auth: 'uuid-123' });
    expect(result).toHaveProperty('nombre', 'Juan');
  });

  test('findByExternalId - retorna null si no existe', async () => {
    mockCollection.findOne.mockResolvedValue(null);

    const result = await dao.findByExternalId('uuid-inexistente');

    expect(result).toBeNull();
  });

  test('update - actualiza nombre y correo', async () => {
    const id = new ObjectId();
    mockCollection.findOneAndUpdate.mockResolvedValue({
      _id: id,
      nombre: 'Nuevo',
      correo: 'nuevo@test.com'
    });

    await dao.update(id.toString(), { nombre: 'Nuevo', correo: 'nuevo@test.com' });

    expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.any(ObjectId) },
      { $set: { nombre: 'Nuevo', correo: 'nuevo@test.com' } },
      { returnDocument: 'after' }
    );
  });

  test('update - lanza error si no hay campos', async () => {
    await expect(dao.update(new ObjectId().toString(), {}))
      .rejects.toThrow('No hay campos para actualizar');
  });

});

// ============================================================
// ReservationDAOMongo
// ============================================================
describe('ReservationDAOMongo', () => {

  let dao;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
    dao = new ReservationDAOMongo(mockDb);
  });

  test('create - inserta una reservación correctamente', async () => {
    const insertedId = new ObjectId();
    mockCollection.insertOne.mockResolvedValue({ insertedId });

    const result = await dao.create({
      id_usuario: 'uuid-1',
      id_restaurante: 'rest-1',
      id_mesa: 'mesa-1',
      fecha: '2027-01-01',
      duracion: 90,
      personas: 4
    });

    expect(mockCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: 'pendiente',
        duracion: 90,
        personas: 4
      })
    );
  });

  test('cancel - actualiza estado a cancelada', async () => {
    const id = new ObjectId();
    mockCollection.findOneAndUpdate.mockResolvedValue({
      _id: id,
      estado: 'cancelada'
    });

    const result = await dao.cancel(id.toString());

    expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.any(ObjectId) },
      { $set: expect.objectContaining({ estado: 'cancelada' }) },
      { returnDocument: 'after' }
    );
    expect(result).toBe(true);
  });

  test('cancel - retorna false si no existe', async () => {
    mockCollection.findOneAndUpdate.mockResolvedValue(null);

    const result = await dao.cancel(new ObjectId().toString());

    expect(result).toBe(false);
  });

});

// ============================================================
// OrderDAOMongo
// ============================================================
describe('OrderDAOMongo', () => {

  let dao;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
    dao = new OrderDAOMongo(mockDb);
  });

  test('create - inserta un pedido correctamente', async () => {
    const insertedId = new ObjectId();
    mockCollection.insertOne.mockResolvedValue({ insertedId });

    const result = await dao.create({
      id_usuario: 'uuid-1',
      id_restaurante: 'rest-1',
      descripcion: 'Para llevar',
      tipo_pedido: 'para llevar',
      precio_total: 5000,
      platos: [{ id_plato: '1', cantidad: 2 }]
    });

    expect(mockCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: 'pendiente',
        tipo_pedido: 'para llevar',
        precio_total: 5000
      })
    );
  });

  test('findByUser - filtra por id_usuario', async () => {
    mockCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([
        { _id: new ObjectId(), id_usuario: 'uuid-1' }
      ])
    });

    const result = await dao.findByUser('uuid-1');

    expect(mockCollection.find).toHaveBeenCalledWith({ id_usuario: 'uuid-1' });
    expect(result).toHaveLength(1);
  });

  test('findByRestaurant - filtra por id_restaurante', async () => {
    mockCollection.find.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([
        { _id: new ObjectId(), id_restaurante: 'rest-1' }
      ])
    });

    const result = await dao.findByRestaurant('rest-1');

    expect(mockCollection.find).toHaveBeenCalledWith({ id_restaurante: 'rest-1' });
    expect(result).toHaveLength(1);
  });

});