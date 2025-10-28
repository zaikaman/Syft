import { Router, Request, Response } from 'express';
import { getXLMPrice, getAssetPrices, clearPriceCache, getPriceCacheStatus } from '../services/priceService.js';

const router = Router();

/**
 * GET /api/price/xlm
 * Get current XLM price in USD
 */
router.get('/xlm', async (_req: Request, res: Response) => {
  try {
    const price = await getXLMPrice();

    return res.json({
      success: true,
      asset: 'XLM',
      price,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in GET /api/price/xlm:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/price/assets
 * Get prices for multiple assets
 * Query params: assets=XLM,USDC,BTC (comma-separated)
 */
router.get('/assets', async (req: Request, res: Response) => {
  try {
    const assetsParam = req.query.assets as string;
    
    if (!assetsParam) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: assets',
      });
    }

    const assets = assetsParam.split(',').map(a => a.trim());
    const prices = await getAssetPrices(assets);

    return res.json({
      success: true,
      prices,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in GET /api/price/assets:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/price/cache-status
 * Get price cache status (for debugging)
 */
router.get('/cache-status', async (_req: Request, res: Response) => {
  try {
    const status = getPriceCacheStatus();

    return res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in GET /api/price/cache-status:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/price/clear-cache
 * Clear price cache (admin only in production)
 */
router.post('/clear-cache', async (_req: Request, res: Response) => {
  try {
    clearPriceCache();

    return res.json({
      success: true,
      message: 'Price cache cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in POST /api/price/clear-cache:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
