// T099 & T100: Backtest API endpoints
// Purpose: REST API for initiating and retrieving backtest results

import { Router, Request, Response } from 'express';
import { runBacktest } from '../services/backtestEngine';
import type { BacktestRequest, BacktestResult } from '../services/backtestEngine';
import { supabase } from '../lib/supabase';

const router = Router();

/**
 * POST /api/backtests
 * Initiate a new backtest simulation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const backtestRequest: BacktestRequest = req.body;

    // Validation
    if (!backtestRequest.vaultConfig) {
      return res.status(400).json({ error: 'Vault configuration required' });
    }

    if (!backtestRequest.startTime || !backtestRequest.endTime) {
      return res.status(400).json({ error: 'Start and end time required' });
    }

    if (!backtestRequest.initialCapital || backtestRequest.initialCapital <= 0) {
      return res.status(400).json({ error: 'Valid initial capital required' });
    }

    // Validate time range
    const start = new Date(backtestRequest.startTime).getTime();
    const end = new Date(backtestRequest.endTime).getTime();
    
    if (start >= end) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    const now = Date.now();
    if (end > now) {
      return res.status(400).json({ error: 'End time cannot be in the future' });
    }

    // Run backtest
    const result: BacktestResult = await runBacktest(backtestRequest);

    // Try to find vault UUID if vault_id or contract_address is provided
    let vaultUUID: string | null = null;
    const vaultIdentifier = backtestRequest.vaultConfig.owner; // Could be vault_id or contract_address
    
    if (vaultIdentifier) {
      // Try to find vault by vault_id or contract_address
      const { data: vault } = await supabase
        .from('vaults')
        .select('id')
        .or(`vault_id.eq.${vaultIdentifier},contract_address.eq.${vaultIdentifier}`)
        .single();
      
      vaultUUID = vault?.id || null;
    }

    // Save to Supabase
    const { data: savedBacktest, error: saveError } = await supabase
      .from('backtest_results')
      .insert({
        vault_id: vaultUUID, // Use UUID from vaults table (or null for ad-hoc backtests)
        vault_config: backtestRequest.vaultConfig,
        timeframe_start: backtestRequest.startTime,
        timeframe_end: backtestRequest.endTime,
        status: 'completed' as const,
        total_return: result.metrics.totalReturn,
        annualized_return: result.metrics.annualizedReturn,
        volatility: result.metrics.volatility,
        sharpe_ratio: result.metrics.sharpeRatio,
        max_drawdown: result.metrics.maxDrawdown,
        win_rate: result.metrics.winRate,
        benchmark_return: result.metrics.buyAndHoldReturn,
        results: {
          initialCapital: backtestRequest.initialCapital,
          metrics: result.metrics,
          timeline: result.timeline,
          portfolioValueHistory: result.portfolioValueHistory,
          allocationHistory: result.allocationHistory,
        },
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving backtest:', saveError);
      // Continue even if save fails - return the result
    }

    return res.status(200).json({
      backtestId: savedBacktest?.backtest_id || null,
      result,
    });
    } catch (error: any) {
    console.error('Backtest error:', error);
    return res.status(500).json({
      error: 'Failed to run backtest',
      message: error.message,
    });
  }
});

/**
 * GET /api/backtests/:backtestId
 * Retrieve backtest results by ID
 */
router.get('/:backtestId', async (req: Request, res: Response) => {
  try {
    const { backtestId } = req.params;

    // Fetch from Supabase
    const { data: backtest, error } = await supabase
      .from('backtest_results')
      .select('*')
      .eq('backtest_id', backtestId)
      .single();

    if (error || !backtest) {
      return res.status(404).json({ error: 'Backtest not found' });
    }

    return res.status(200).json({
      backtestId: backtest.backtest_id,
      vaultId: backtest.vault_id,
      vaultConfig: backtest.vault_config,
      timeframe: {
        start: backtest.timeframe_start,
        end: backtest.timeframe_end,
      },
      initialCapital: backtest.results?.initialCapital || 0,
      results: backtest.results,
      createdAt: backtest.created_at,
    });
  } catch (error: any) {
    console.error('Error fetching backtest:', error);
    return res.status(500).json({
      error: 'Failed to fetch backtest',
      message: error.message,
    });
  }
});

/**
 * GET /api/backtests/vault/:vaultId
 * Get all backtests for a specific vault
 */
router.get('/vault/:vaultId', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    // Sanitize pagination params to avoid passing NaN into Supabase.range
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const start = Math.max(0, offset);
    const end = start + Math.max(1, limit) - 1;

    const { data: backtests, error } = await supabase
      .from('backtest_results')
      .select('*')
      .eq('vault_id', vaultId)
      .order('created_at', { ascending: false })
      .range(start, end);

    if (error) {
      throw error;
    }

    return res.status(200).json({
      vaultId,
      backtests: backtests || [],
      count: backtests?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching vault backtests:', error);
    return res.status(500).json({
      error: 'Failed to fetch vault backtests',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/backtests/:backtestId
 * Delete a backtest result
 */
router.delete('/:backtestId', async (req: Request, res: Response) => {
  try {
    const { backtestId } = req.params;

    const { error } = await supabase
      .from('backtest_results')
      .delete()
      .eq('backtest_id', backtestId);

    if (error) {
      throw error;
    }

  return res.status(200).json({ message: 'Backtest deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting backtest:', error);
    return res.status(500).json({
      error: 'Failed to delete backtest',
      message: error.message,
    });
  }
});

export default router;
