import { BaseDAO } from '../interfaces/BaseDAO.js';
import { ObjectId } from 'mongodb';

/**
 * MongoBaseDAO — Implementación base para MongoDB.
 *
 * Encapsula toda la interacción con MongoDB de forma genérica.
 * Recibe la instancia `db` por inyección de dependencias desde DAOFactory.
 *
 * Los DAOs de entidad extienden esta clase e indican su colección.
 * Si necesitan lógica específica (aggregations, índices, etc.),
 * sobreescriben el método correspondiente o añaden métodos propios.
 */
export class MongoBaseDAO extends BaseDAO {
  /**
   * @param {import('mongodb').Db} db — Instancia de DB inyectada.
   * @param {string} collectionName — Nombre de la colección.
   */
  constructor(db, collectionName) {
    super();
    if (!db)             throw new Error('MongoBaseDAO requiere una instancia db');
    if (!collectionName) throw new Error('MongoBaseDAO requiere un collectionName');
    this.collection = db.collection(collectionName);
  }

  /**
   * Convierte un string a ObjectId. Lanza si el formato es inválido.
   * @param {string|ObjectId} id
   * @returns {ObjectId}
   */
  _toObjectId(id) {
    if (id instanceof ObjectId) return id;
    if (!ObjectId.isValid(id)) throw new Error(`ObjectId inválido: ${id}`);
    return new ObjectId(id);
  }

  /**
   * Normaliza un documento Mongo: renombra _id → id como string.
   * Se define como arrow function para preservar el contexto `this`
   * cuando se usa en map() sin necesidad de .bind().
   *
   * @param {Object|null} doc
   * @returns {Object|null}
   */
  _normalize = (doc) => {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id.toString(), ...rest };
  };

  // ── Implementaciones del contrato BaseDAO ──────────────────────

  async findAll() {
    const docs = await this.collection.find({}).toArray();
    return docs.map(this._normalize);
  }

  async findById(id) {
    const doc = await this.collection.findOne({ _id: this._toObjectId(id) });
    return this._normalize(doc);
  }

  async create(data) {
    const result = await this.collection.insertOne(data);
    return this._normalize({ _id: result.insertedId, ...data });
  }

  async update(id, data) {
    const result = await this.collection.findOneAndUpdate(
      { _id: this._toObjectId(id) },
      { $set: data },
      { returnDocument: 'after' }
    );
    return this._normalize(result);
  }

  async delete(id) {
    const result = await this.collection.deleteOne({ _id: this._toObjectId(id) });
    return result.deletedCount > 0;
  }

  async findBy(criteria) {
    const docs = await this.collection.find(criteria).toArray();
    return docs.map(this._normalize);
  }
}