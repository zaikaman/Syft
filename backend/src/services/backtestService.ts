// T101: Backtest result caching service
// Purpose: Cache backtest results in Supabase to avoid recomputation

import { supabase } from '../lib/supabase';
import type { BacktestRequest, BacktestResult } from './backtestEngine';
import crypto from 'crypto';

/**
 * Generate a cache key for a backtest configuration
 */
function generateCacheKey(request: BacktestRequest): string {
  // Create a hash of the backtest configuration
  const configString = JSON.stringify({
    vaultConfig: request.vaultConfig,
    startTime: request.startTime,
    endTime: request.endTime,
    initialCapital: request.initialCapital,
    resolution: request.resolution,
  });

  return crypto.createHash('sha256').update(configString).digest('hex');
}

/**
 * Check if a cached backtest result exists
 */
export async function getCachedBacktest(
  request: BacktestRequest
): Promise<BacktestResult | null> {
  try {
    const cacheKey = generateCacheKey(request);

    const { data, error } = await supabase
      .from('backtest_results')
      .select('*')
      .eq('cache_key', cacheKey)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if cache is still valid (e.g., less than 24 hours old)
    const createdAt = new Date(data.created_at).getTime();
    const now = Date.now();
    const cacheAge = now - createdAt;
    const maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours

    if (cacheAge > maxCacheAge) {
      // Cache expired
      return null;
    }

    // Reconstruct BacktestResult from cached data
    const result: BacktestResult = {
      request: {
        vaultConfig: data.vault_config,
        startTime: data.timeframe.start,
        endTime: data.timeframe.end,
        initialCapital: data.initial_capital,
        resolution: request.resolution,
      },
      metrics: data.results.metrics,
      timeline: data.results.timeline,
      portfolioValueHistory: data.results.portfolioValueHistory,
      allocationHistory: data.results.allocationHistory,
    };

    return result;
  } catch (error) {
    console.error('Error fetching cached backtest:', error);
    return null;
  }
}

/**
 * Save backtest result to cache
 */
export async function cacheBacktest(
  request: BacktestRequest,
  result: BacktestResult
): Promise<void> {
  try {
    const cacheKey = generateCacheKey(request);

    await supabase.from('backtest_results').upsert(
      {
        cache_key: cacheKey,
        vault_id: request.vaultConfig.owner,
        vault_config: request.vaultConfig,
        timeframe: {
          start: request.startTime,
          end: request.endTime,
        },
        initial_capital: request.initialCapital,
        results: {
          metrics: result.metrics,
          timeline: result.timeline,
          portfolioValueHistory: result.portfolioValueHistory,
          allocationHistory: result.allocationHistory,
        },
        created_at: new Date().toISOString(),
      },
      {
        onConflict: 'cache_key',
      }
    );
  } catch (error) {
    console.error('Error caching backtest:', error);
    // Don't throw - caching is optional
  }
}

/**
 * Clear old cached backtests (older than 7 days)
 */
export async function clearOldBacktestCache(): Promise<number> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('backtest_results')
      .delete()
      .lt('created_at', sevenDaysAgo)
      .select();

    if (error) {
      throw error;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('Error clearing old backtest cache:', error);
    return 0;
  }
}

export default {
  getCachedBacktest,
  cacheBacktest,
  clearOldBacktestCache,
};
