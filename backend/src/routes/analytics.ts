import { Router, Request, Response } from 'express';
import { 
  getVaultAnalytics, 
  getPortfolioAnalytics, 
  getHistoricalPerformance 
} from '../services/analyticsService.js';

const router = Router();

/**
 * GET /api/analytics/vault/:vaultId
 * Get comprehensive analytics for a single vault
 */
router.get('/vault/:vaultId', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;

    const analytics = await getVaultAnalytics(vaultId);

    return res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/vault/:vaultId:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/analytics/vault/:vaultId/history
 * Get historical performance data for charts
 * Query params: days (default: 30)
 */
router.get('/vault/:vaultId/history', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const history = await getHistoricalPerformance(vaultId, days);

    return res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/vault/:vaultId/history:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/analytics/portfolio/:userAddress
 * Get portfolio-wide analytics for a user
 * Query params: network (default: testnet)
 */
router.get('/portfolio/:userAddress', async (req: Request, res: Response) => {
  try {
    const { userAddress } = req.params;
    const network = (req.query.network as string) || 'testnet';

    const analytics = await getPortfolioAnalytics(userAddress, network);

    return res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/portfolio/:userAddress:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/analytics/debug/vault/:vaultId/snapshots
 * Debug endpoint to view raw vault performance snapshots
 */
router.get('/debug/vault/:vaultId/snapshots', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const { supabase } = await import('../lib/supabase.js');
    
    // Get vault UUID
    const { data: vault } = await supabase
      .from('vaults')
      .select('id, vault_id')
      .eq('vault_id', vaultId)
      .single();

    if (!vault) {
      return res.status(404).json({ success: false, error: 'Vault not found' });
    }

    // Get snapshots
    const { data: snapshots } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault.id)
      .order('timestamp', { ascending: false })
      .limit(limit);

    return res.json({
      success: true,
      data: {
        vaultId,
        snapshots: snapshots || [],
        count: snapshots?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/debug/vault/:vaultId/snapshots:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
