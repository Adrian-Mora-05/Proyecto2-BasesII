import express        from 'express';
import 'dotenv/config';

import { connectElastic }   from './config/elastic.js';
import { ensureIndex }      from './config/indexes.js';
import { SearchService }    from './services/search.service.js';
import { SearchController } from './controllers/search.controller.js';
import { createSearchRouter } from './routes/search.routes.js';
import { createProductRepository } from './data/repository.factory.js';


export async function createApp() {
  const app = express();
  app.use(express.json());

  // ── Conectar a ElasticSearch y asegurar que el índice existe ─────
  await connectElastic();
  await ensureIndex();

  // ── Composición de dependencias ──────────────────────────────────
  const productRepository = createProductRepository();
  const searchService    = new SearchService(productRepository);
  const searchController = new SearchController(searchService);

  // ── Rutas ────────────────────────────────────────────────────────
  // Nginx enruta /search/** aquí, el microservicio maneja /products y /reindex
  app.use('/search', createSearchRouter(searchController));

  // Health check para Docker y Nginx
  app.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));

  return app;
}