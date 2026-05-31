import { Router } from 'express';

/**
 * createSearchRouter — Rutas del microservicio de búsqueda.
 *
 * Endpoints requeridos por el enunciado:
 *  GET  /search/products?q=texto
 *  GET  /search/products/category/:categoria
 *  POST /search/reindex
 *
 * No requiere autenticación JWT propia — el API Gateway (Nginx)
 * solo expone /search/** desde la red interna de Docker.
 */
export function createSearchRouter(controller) {
  const router = Router();

  // IMPORTANTE: /category/:categoria debe ir ANTES que ?q=
  // para que Express no lo confunda con un query param
  router.get('/products/category/:categoria', controller.searchByCategory);
  router.get('/products',                     controller.searchProducts);
  router.post('/reindex',                     controller.reindex);

  return router;
}