/**
 * Suggestions API Routes (T115)
 * Endpoints for AI-powered vault strategy suggestions
 */

import { Router, Request, Response } from 'express';
import { suggestionGenerator, SuggestionRequest } from '../services/suggestionGenerator';
import { suggestionCacheService } from '../services/suggestionCacheService';
import { supabase } from '../lib/supabase';

const router = Router();

/**
 * POST /api/vaults/:vaultId/suggestions
 * Generate AI suggestions for a vault
 */
router.post('/:vaultId/suggestions', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { userPreferences, forceRefresh } = req.body;

    // Check cache first (unless force refresh requested)
    if (!forceRefresh) {
      const cached = suggestionCacheService.get(vaultId);
      if (cached) {
        return res.json({
          success: true,
          cached: true,
          suggestions: cached,
        });
      }
    }

    // Fetch vault configuration from database
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (vaultError || !vault) {
      return res.status(404).json({
        success: false,
        error: 'Vault not found',
      });
    }

    // Fetch performance data (optional)
    const { data: performance } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vaultId)
      .order('timestamp', { ascending: false })
      .limit(100);

    // Generate suggestions
    const request: SuggestionRequest = {
      vaultId,
      config: vault.config,
      performanceData: performance || [],
      userPreferences,
    };

    const suggestions = await suggestionGenerator.generateSuggestions(request);

    // Cache the results
    suggestionCacheService.set(vaultId, suggestions);

    // Store suggestions in database
    const suggestionRecords = suggestions.map(s => ({
      vault_id: vaultId,
      suggestion_data: s,
      created_at: new Date().toISOString(),
      expires_at: s.expiresAt,
    }));

    await supabase.from('ai_suggestions').insert(suggestionRecords);

    res.json({
      success: true,
      cached: false,
      suggestions,
    });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate suggestions',
    });
  }
});

/**
 * GET /api/vaults/:vaultId/suggestions
 * Get cached/stored suggestions for a vault
 */
router.get('/:vaultId/suggestions', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;

    // Try cache first
    const cached = suggestionCacheService.get(vaultId);
    if (cached) {
      return res.json({
        success: true,
        cached: true,
        suggestions: cached,
      });
    }

    // Fetch from database
    const { data: suggestions, error } = await supabase
      .from('ai_suggestions')
      .select('*')
      .eq('vault_id', vaultId)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    const suggestionData = suggestions?.map(s => s.suggestion_data) || [];

    res.json({
      success: true,
      cached: false,
      suggestions: suggestionData,
    });
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch suggestions',
    });
  }
});

/**
 * DELETE /api/vaults/:vaultId/suggestions
 * Clear cached suggestions for a vault
 */
router.delete('/:vaultId/suggestions', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;

    // Clear cache
    suggestionCacheService.invalidate(vaultId);

    res.json({
      success: true,
      message: 'Suggestions cache cleared',
    });
  } catch (error) {
    console.error('Error clearing suggestions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear suggestions',
    });
  }
});

/**
 * GET /api/suggestions/cache/stats
 * Get cache statistics (admin endpoint)
 */
router.get('/cache/stats', async (_req: Request, res: Response) => {
  try {
    const stats = suggestionCacheService.getStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch cache stats',
    });
  }
});

export default router;
