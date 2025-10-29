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

    // First get the vault UUID from vault_id
    const { data: vaultData, error: vaultUuidError } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (vaultUuidError || !vaultData) {
      return res.status(404).json({
        success: false,
        error: 'Vault UUID not found',
      });
    }

    // Fetch performance data (optional)
    const { data: performance } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vaultData.id)
      .order('timestamp', { ascending: false })
      .limit(100);

    // DEBUG: Log the vault config structure
    console.log(`[Suggestions API] Raw vault config:`, JSON.stringify(vault.config, null, 2));
    console.log(`[Suggestions API] Config keys:`, Object.keys(vault.config || {}));
    console.log(`[Suggestions API] Current state exists:`, !!vault.config?.current_state);
    if (vault.config?.current_state) {
      console.log(`[Suggestions API] Current state keys:`, Object.keys(vault.config.current_state));
      console.log(`[Suggestions API] Asset balances:`, vault.config.current_state.assetBalances);
    }

    // Helper to convert contract address to asset code
    const getAssetCodeFromAddress = (address: string, _network: string): string => {
      const nativeXLMAddresses: { [key: string]: string } = {
        'testnet': 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        'futurenet': 'CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT',
        'mainnet': 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
        'public': 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
      };
      
      // Check if it's Native XLM
      if (Object.values(nativeXLMAddresses).includes(address)) {
        return 'XLM';
      }
      
      // For other assets, return the address (would need a full registry for mainnet)
      // In production, you'd query the asset issuer and code
      return address;
    };

    // Enrich config with real allocation data from blockchain state
    const enrichedConfig = { ...vault.config };
    
    // If we have current_state with assetBalances, calculate real allocations
    if (enrichedConfig.current_state?.assetBalances && Array.isArray(enrichedConfig.current_state.assetBalances)) {
      const assetBalances = enrichedConfig.current_state.assetBalances;
      const totalValue = parseFloat(enrichedConfig.current_state.totalValue || '0');
      
      if (totalValue > 0 && assetBalances.length > 0) {
        const network = vault.network || 'testnet';
        
        // Build assets array with real allocations
        enrichedConfig.assets = assetBalances.map((balance: any) => {
          const assetValue = parseFloat(balance.value || '0');
          const percentage = (assetValue / totalValue) * 100;
          const assetCode = getAssetCodeFromAddress(balance.asset, network);
          
          return {
            assetCode,
            assetId: balance.asset, // Keep contract address as ID
            percentage: percentage,
          };
        });
        
        console.log(`[Suggestions API] Using real allocations from blockchain:`, 
          enrichedConfig.assets.map((a: any) => `${a.assetCode}: ${a.percentage.toFixed(2)}%`).join(', ')
        );
      }
    }
    
    // If still no proper allocations, use the original assets array
    if (!enrichedConfig.assets || enrichedConfig.assets.length === 0 || typeof enrichedConfig.assets[0] === 'string') {
      console.warn(`[Suggestions API] No real allocation data found, using config assets as-is`);
    }

    // Generate suggestions
    const request: SuggestionRequest = {
      vaultId,
      config: enrichedConfig,
      performanceData: performance || [],
      userPreferences,
    };

    console.log(`[Suggestions API] Generating suggestions for vault ${vaultId}`);
    const suggestions = await suggestionGenerator.generateSuggestions(request);
    console.log(`[Suggestions API] Generated ${suggestions.length} suggestions`);

    // Warn if no suggestions were generated
    if (suggestions.length === 0) {
      console.warn(`[Suggestions API] No suggestions generated for vault ${vaultId}. Check logs for AI errors.`);
    }

    // Cache the results
    suggestionCacheService.set(vaultId, suggestions);

    // Store suggestions in database (only if we have suggestions)
    if (suggestions.length > 0) {
      const suggestionRecords = suggestions.map(s => ({
        suggestion_id: s.id,
        vault_id: vaultData.id, // Use UUID instead of text vault_id
        suggestion_type: s.type,
        title: s.title,
        description: s.description,
        reasoning: s.rationale,
        confidence_score: s.expectedImpact?.returnIncrease ? Math.min(s.expectedImpact.returnIncrease / 100, 1) : null,
        projected_apy_improvement: s.expectedImpact?.returnIncrease || null,
        projected_risk_change: s.expectedImpact?.riskReduction ? -s.expectedImpact.riskReduction : null,
        suggestion_data: s,
        sentiment_data: s.dataSupport?.sentiment || null,
        market_data: s.dataSupport?.forecast || null,
        created_at: new Date().toISOString(),
      }));

      await supabase.from('ai_suggestions').insert(suggestionRecords);
    }

    return res.json({
      success: true,
      cached: false,
      suggestions,
      meta: {
        count: suggestions.length,
        generatedAt: new Date().toISOString(),
        message: suggestions.length === 0 
          ? 'No suggestions generated. This could be due to AI errors or insufficient data. Check server logs for details.'
          : undefined,
      },
    });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return res.status(500).json({
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

    // Get the vault UUID from vault_id
    const { data: vaultData, error: vaultError } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (vaultError || !vaultData) {
      return res.status(404).json({
        success: false,
        error: 'Vault not found',
      });
    }

    // Fetch from database
    const { data: suggestions, error } = await supabase
      .from('ai_suggestions')
      .select('*')
      .eq('vault_id', vaultData.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    const suggestionData = suggestions?.map(s => s.suggestion_data) || [];

    return res.json({
      success: true,
      cached: false,
      suggestions: suggestionData,
    });
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return res.status(500).json({
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

/**
 * GET /api/suggestions/sentiment/:assetCode
 * Get sentiment analysis for a specific asset
 */
router.get('/sentiment/:assetCode', async (req: Request, res: Response) => {
  try {
    const { assetCode } = req.params;
    const hoursBack = parseInt(req.query.hoursBack as string) || 24;

    // Import sentiment services
    const { sentimentAnalysisService } = await import('../services/sentimentAnalysisService.js');
    
    // Get sentiment data
    const sentiment = await sentimentAnalysisService.analyzeAssetSentiment(assetCode, hoursBack);

    res.json({
      success: true,
      data: sentiment,
    });
  } catch (error) {
    console.error('Error fetching sentiment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sentiment data',
    });
  }
});

export default router;
