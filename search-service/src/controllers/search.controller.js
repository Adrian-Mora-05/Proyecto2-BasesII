export class SearchController {
  /** @param {import('../services/search.service.js').SearchService} searchService */
  constructor(searchService) {
    this.service = searchService;
  }

  /**
   * GET /search/products?q=texto
   */
  searchProducts = async (req, res) => {
    try {
      const { q } = req.query;

      if (!q?.trim()) {
        return res.status(400).json({ error: 'El parámetro q es obligatorio' });
      }

      const results = await this.service.searchProducts(q);
      res.status(200).json({ query: q, total: results.length, results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * GET /search/products/category/:categoria
   */
  searchByCategory = async (req, res) => {
    try {
      const { categoria } = req.params;
      const results = await this.service.searchByCategory(categoria);
      res.status(200).json({ categoria, total: results.length, results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * POST /search/reindex
   * Reindexación manual de todos los productos desde la BD.
   */
  reindex = async (req, res) => {
    try {
      const result  = await this.service.reindex();
      res.status(200).json({ message: 'Reindexación completada', ...result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}