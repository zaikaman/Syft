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

    // Save to Supabase
    const { data: savedBacktest, error: saveError } = await supabase
      .from('backtest_results')
      .insert({
        vault_id: backtestRequest.vaultConfig.owner, // Use owner as temp ID
        vault_config: backtestRequest.vaultConfig,
        timeframe: {
          start: backtestRequest.startTime,
          end: backtestRequest.endTime,
        },
        initial_capital: backtestRequest.initialCapital,
        results: {
          metrics: result.metrics,
          timeline: result.timeline,
          portfolioValueHistory: result.portfolioValueHistory,
          allocationHistory: result.allocationHistory,
        },
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
      timeframe: backtest.timeframe,
      initialCapital: backtest.initial_capital,
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
    const { limit = 10, offset = 0 } = req.query;

    const { data: backtests, error } = await supabase
      .from('backtest_results')
      .select('*')
      .eq('vault_id', vaultId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

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
