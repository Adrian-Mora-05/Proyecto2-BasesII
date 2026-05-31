import elastic from '../config/elastic.js';
import { getCached, setCached, SEARCH_TTL } from '../config/redis.js';
import { PRODUCTS_INDEX } from '../config/indexes.js';


/**
 * SearchService — Lógica de búsqueda sobre ElasticSearch.
 */
export class SearchService {

  /**
   * Búsqueda full-text en nombre, descripción y categoría.
   * @param {string} q
   */
  constructor(productRepository) {
    this.productRepository = productRepository;
  }

  async searchProducts(q) {
    if (!q?.trim()) throw new Error('El parámetro q es obligatorio');

    const cacheKey = `search:q:${q.toLowerCase().trim()}`;
    const cached = await getCached(cacheKey);
    if (cached) {
      console.log(`[Search cache HIT] ${cacheKey}`);
      return cached;
    }

    // FIX: ES v8 — query va directo, sin 'body:'
    const response = await elastic.search({
      index: PRODUCTS_INDEX,
      query: {
        multi_match: {
          query:     q,
          fields:    ['nombre^3', 'categoria^2', 'descripcion'],
          fuzziness: 'AUTO',
        },
      },
      highlight: {
        fields: { nombre: {}, descripcion: {} },
      },
    });

    const results = response.hits.hits.map(hit => ({
      id:         hit._id,
      score:      hit._score,
      ...hit._source,
      highlights: hit.highlight || {},
    }));

    await setCached(cacheKey, results, SEARCH_TTL);
    return results;
  }

  /**
   * Filtrado exacto por categoría.
   * @param {string} categoria
   */
  async searchByCategory(categoria) {
    if (!categoria?.trim()) throw new Error('La categoría es obligatoria');

    const cacheKey = `search:cat:${categoria.toLowerCase().trim()}`;
    const cached = await getCached(cacheKey);
    if (cached) {
      console.log(`[Search cache HIT] ${cacheKey}`);
      return cached;
    }

    // FIX: ES v8 — query directo
    const response = await elastic.search({
      index: PRODUCTS_INDEX,
      query: {
        term: { categoria: categoria.toLowerCase() },
      },
    });

    const results = response.hits.hits.map(hit => ({
      id:    hit._id,
      score: hit._score,
      ...hit._source,
    }));

    await setCached(cacheKey, results, SEARCH_TTL);
    return results;
  }

  /**
   * Indexa un producto individual.
   * @param {Object} product
   */
  async indexProduct(product) {
    // FIX: ES v8 — document en vez de body
    await elastic.index({
      index:    PRODUCTS_INDEX,
      id:       String(product.id),
      document: {
        nombre:         product.nombre,
        categoria:      product.categoria?.toLowerCase() ?? 'Sin categoría',
        descripcion:    product.descripcion?.trim() || 'Producto sin descripción',
        id_restaurante: String(product.id_restaurante),
        precio:         product.precio ?? 0,
      },
    });
  }

  /**
   * Reindexación completa desde la BD.
   * @param {Function} fetchAllProducts
   */
  async reindex() {
    const products = await this.productRepository.findAll();

    if (!products.length) return { indexed: 0 };

    const operations = products.flatMap(p => [
      { index: { _index: PRODUCTS_INDEX, _id: String(p.id) } },
      {
        nombre:         p.nombre,
        categoria:      p.categoria?.toLowerCase() ?? 'Sin categoría',
        descripcion:    p.descripcion?.trim() || 'Producto sin descripción',
        id_restaurante: String(p.id_restaurante),
        precio:         p.precio ?? 0,
      },
    ]);

    const { errors, items } = await elastic.bulk({
      operations,
      refresh: true,
    });

    if (errors) {
      const failed = items.filter(i => i.index?.error);
      console.error(`[Reindex] ${failed.length} documentos fallaron`);
    }

    return { indexed: products.length };
  }
}