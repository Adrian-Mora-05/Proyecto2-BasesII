// data/mongo/product.mongo.js

import { MongoClient } from 'mongodb';

export class MongoProductRepository {
  async findAll() {
    const client = new MongoClient(process.env.MONGO_URL || 'mongodb://mongos-service:27017');

    try {
      await client.connect();
      const db = client.db(process.env.MONGO_DB || 'restaurantdb');
      const products = await db.collection('platos').find({}).toArray();

      return products.map(p => ({
        id: p._id.toString(),
        nombre: p.nombre,
        categoria: p.categoria ?? 'Sin categoría',
        descripcion: p.descripcion ?? 'Producto sin descripción',
        id_restaurante: p.id_restaurante,
        precio: p.precio,
        id_menu: p.id_menu ?? null,
      }));
    } finally {
      await client.close();
    }
  }
}