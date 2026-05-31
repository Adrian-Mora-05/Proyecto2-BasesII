import { Client } from '@elastic/elasticsearch';

/**
 * Cliente de ElasticSearch.
 * ELASTIC_URL viene del entorno — en Docker es http://elasticsearch:9200
 */
const elastic = new Client({
  node: process.env.ELASTIC_URL || 'http://localhost:9200',
});

/**
 * Verifica la conexión con ElasticSearch.
 * Reintenta hasta que el cluster esté disponible (útil en Docker donde
 * ElasticSearch tarda varios segundos en arrancar).
 *
 * @param {number} retries
 * @param {number} delayMs
 */
export async function connectElastic(retries = 15, delayMs = 4000) {
  for (let i = 0; i < retries; i++) {
    try {
      const health = await elastic.cluster.health({});
      console.log(`[ElasticSearch] Conectado. Estado del cluster: ${health.status}`);
      return;
    } catch {
      console.log(`[ElasticSearch] No disponible (${i + 1}/${retries})... reintentando en ${delayMs}ms`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('No se pudo conectar a ElasticSearch después de varios intentos');
}

export default elastic;