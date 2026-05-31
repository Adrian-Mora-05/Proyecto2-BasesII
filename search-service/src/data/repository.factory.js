// data/repository.factory.js

import { PostgresProductRepository } from './postgres/product.postgres.js';
import { MongoProductRepository } from './mongo/product.mongo.js';

export function createProductRepository() {
  const engine = process.env.DB_ENGINE;

  const map = {
    postgres: () => new PostgresProductRepository(),
    mongodb: () => new MongoProductRepository(),
  };

  const creator = map[engine];

  if (!creator) {
    throw new Error(`Unsupported DB engine: ${engine}`);
  }

  return creator();
}