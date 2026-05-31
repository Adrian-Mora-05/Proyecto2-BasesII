import elastic from '../config/elastic.js';

export const PRODUCTS_INDEX = 'products';

/**
 * Mappings del índice de productos.
 *
 * - nombre:         text con analizador estándar (búsqueda full-text)
 * - categoria:      keyword (filtrado exacto) + text (búsqueda)
 * - descripcion:    text (búsqueda full-text)
 * - id_restaurante: keyword (filtrado)
 * - precio:         float
 */
const PRODUCTS_MAPPING = {
  mappings: {
    properties: {
      nombre:         { type: 'text',    analyzer: 'standard' },
      categoria:      { type: 'keyword', fields: { text: { type: 'text' } } },
      descripcion:    { type: 'text',    analyzer: 'standard' },
      id_restaurante: { type: 'keyword' },
      precio:         { type: 'float'   },
    },
  },
  settings: {
    number_of_shards:   1,
    number_of_replicas: 0, // Sin réplicas en dev — cambiar a 1 en producción
  },
};

/**
 * Crea el índice si no existe.
 * Si ya existe, no hace nada (idempotente).
 */
export async function ensureIndex() {
  const exists = await elastic.indices.exists({ index: PRODUCTS_INDEX });

  if (exists) {
    console.log(`[ElasticSearch] Índice "${PRODUCTS_INDEX}" ya existe`);
    return;
  }

  await elastic.indices.create({
    index: PRODUCTS_INDEX,
    mappings:  PRODUCTS_MAPPING.mappings,
    settings:  PRODUCTS_MAPPING.settings,
  });

  console.log(`[ElasticSearch] Índice "${PRODUCTS_INDEX}" creado`);
}