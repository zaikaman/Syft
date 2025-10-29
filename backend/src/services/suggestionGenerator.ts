/**
 * Suggestion Generator Service (T114)
 * Combines historical data, sentiment, and Prophet forecasts to generate AI-powered suggestions
 */

import { openai } from '../lib/openaiClient';
import { strategyAnalyzer, StrategyAnalysis } from './strategyAnalyzer';
import { sentimentAnalysisService, SentimentAnalysis } from './sentimentAnalysisService';
import { tavilyService, MarketNewsResult } from './tavilyService';
import { VaultConfig } from '../../../shared/types/vault';

export interface Suggestion {
  id: string;
  vaultId: string;
  type: 'rebalance' | 'add_asset' | 'remove_asset' | 'adjust_rule' | 'risk_adjustment';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  rationale: string;
  expectedImpact: {
    returnIncrease?: number; // percentage
    riskReduction?: number; // percentage
    efficiencyGain?: number; // percentage
  };
  implementation: {
    steps: string[];
    difficulty: 'easy' | 'moderate' | 'advanced';
    estimatedTime: string;
  };
  dataSupport: {
    sentiment?: Record<string, SentimentAnalysis>;
    forecast?: any;
    analysis?: StrategyAnalysis;
    marketNews?: Record<string, MarketNewsResult>;
    defiTrends?: any;
  };
  configChanges?: Partial<VaultConfig>;
  createdAt: string;
  expiresAt?: string;
}

export interface SuggestionRequest {
  vaultId: string;
  config: VaultConfig;
  performanceData?: any;
  userPreferences?: {
    riskTolerance?: 'low' | 'medium' | 'high';
    timeHorizon?: 'short' | 'medium' | 'long';
    focusAreas?: Array<'performance' | 'risk' | 'diversification' | 'efficiency'>;
  };
}

export class SuggestionGenerator {
  private readonly SUGGESTION_PROMPT = `You are an expert DeFi yield vault strategist. Based on the following data, generate 3-5 specific, actionable suggestions to improve this vault's performance.

Strategy Analysis:
{analysis}

Social Sentiment Data:
{sentiment}

Market News & Trends:
{marketNews}

DeFi Ecosystem Trends:
{defiTrends}

Market Forecasts:
{forecasts}

User Preferences:
{preferences}

Generate suggestions that are:
1. Specific and actionable
2. Data-driven with clear rationale
3. Prioritized by potential impact
4. Realistic to implement

Return a JSON object with a "suggestions" array:
{
  "suggestions": [{
    "type": "rebalance" | "add_asset" | "remove_asset" | "adjust_rule" | "risk_adjustment",
    "priority": "low" | "medium" | "high",
    "title": "<concise title>",
    "description": "<detailed description>",
    "rationale": "<why this helps, referencing data>",
    "expectedImpact": {
      "returnIncrease": <number or null>,
      "riskReduction": <number or null>,
      "efficiencyGain": <number or null>
    },
    "steps": ["<step 1>", "<step 2>", ...],
    "difficulty": "easy" | "moderate" | "advanced"
  }]
}

Respond only with valid JSON object.`;

  /**
   * Generate AI-powered suggestions for a vault
   */
  async generateSuggestions(request: SuggestionRequest): Promise<Suggestion[]> {
    const { vaultId, config, performanceData, userPreferences } = request;

    console.log(`[SuggestionGenerator] Starting generation for vault: ${vaultId}`);

    // Gather all relevant data in parallel
    const [analysis, sentimentData, marketNews, defiTrends, forecasts] = await Promise.allSettled([
      this.analyzeStrategy(vaultId, config, performanceData),
      this.gatherSentimentData(config),
      this.gatherMarketNews(config),
      this.gatherDeFiTrends(),
      this.gatherForecasts(config),
    ]);

    console.log('[SuggestionGenerator] Data gathering results:', {
      analysis: analysis.status,
      sentimentData: sentimentData.status,
      marketNews: marketNews.status,
      defiTrends: defiTrends.status,
      forecasts: forecasts.status,
    });

    const strategyAnalysis = analysis.status === 'fulfilled' ? analysis.value : null;
    const sentiment = sentimentData.status === 'fulfilled' ? sentimentData.value : null;
    const marketNewsData = marketNews.status === 'fulfilled' ? marketNews.value : null;
    const defiTrendsData = defiTrends.status === 'fulfilled' ? defiTrends.value : null;
    const forecastData = forecasts.status === 'fulfilled' ? forecasts.value : null;

    // Log failures
    if (analysis.status === 'rejected') console.error('[SuggestionGenerator] Analysis failed:', analysis.reason);
    if (sentimentData.status === 'rejected') console.error('[SuggestionGenerator] Sentiment data failed:', sentimentData.reason);
    if (marketNews.status === 'rejected') console.error('[SuggestionGenerator] Market news failed:', marketNews.reason);
    if (defiTrends.status === 'rejected') console.error('[SuggestionGenerator] DeFi trends failed:', defiTrends.reason);
    if (forecasts.status === 'rejected') console.error('[SuggestionGenerator] Forecasts failed:', forecasts.reason);

    console.log('[SuggestionGenerator] Calling AI suggestion generation...');

    // Generate suggestions using AI
    const aiSuggestions = await this.generateAISuggestions(
      strategyAnalysis,
      sentiment,
      marketNewsData,
      defiTrendsData,
      forecastData,
      userPreferences
    );

    console.log(`[SuggestionGenerator] AI generated ${aiSuggestions.length} suggestions`);

    // Enhance suggestions with additional data
    const enrichedSuggestions = aiSuggestions.map((suggestion, index) => ({
      ...suggestion,
      id: `${vaultId}-suggestion-${Date.now()}-${index}`,
      vaultId,
      dataSupport: {
        sentiment: sentiment || undefined,
        forecast: forecastData || undefined,
        analysis: strategyAnalysis || undefined,
        marketNews: marketNewsData || undefined,
        defiTrends: defiTrendsData || undefined,
      },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    }));

    console.log(`[SuggestionGenerator] Successfully enriched ${enrichedSuggestions.length} suggestions`);

    if (enrichedSuggestions.length === 0) {
      console.warn('[SuggestionGenerator] WARNING: No suggestions generated. Check AI response and fallback logic.');
    }

    return enrichedSuggestions;
  }

  /**
   * Analyze vault strategy
   */
  private async analyzeStrategy(
    vaultId: string,
    config: VaultConfig,
    performanceData?: any
  ): Promise<StrategyAnalysis> {
    return strategyAnalyzer.analyzeStrategy(vaultId, config, performanceData);
  }

  /**
   * Gather sentiment data for vault assets
   */
  private async gatherSentimentData(config: VaultConfig): Promise<Record<string, SentimentAnalysis>> {
    if (!sentimentAnalysisService.isAvailable()) {
      console.warn('Sentiment analysis not available');
      return {};
    }

    const sentimentMap: Record<string, SentimentAnalysis> = {};

    // Get sentiment for each asset
    for (const asset of config.assets) {
      // Skip if asset code is missing or empty
      if (!asset?.assetCode || asset.assetCode.trim().length === 0) {
        continue;
      }

      try {
        const sentiment = await sentimentAnalysisService.analyzeAssetSentiment(
          asset.assetCode,
          24 // Last 24 hours
        );
        sentimentMap[asset.assetCode] = sentiment;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to get sentiment for ${asset.assetCode}:`, errorMessage);
        // Continue with other assets even if one fails
      }
    }

    return sentimentMap;
  }

  /**
   * Gather market news from web search
   */
  private async gatherMarketNews(config: VaultConfig): Promise<Record<string, MarketNewsResult>> {
    if (!tavilyService.isConfigured()) {
      console.warn('Tavily API not configured, skipping market news');
      return {};
    }

    const newsMap: Record<string, MarketNewsResult> = {};

    // Get news for each asset
    for (const asset of config.assets) {
      // Skip if asset code is missing or empty
      if (!asset?.assetCode || asset.assetCode.trim().length === 0) {
        continue;
      }

      try {
        const news = await tavilyService.getAssetNews(asset.assetCode, {
          daysBack: 7,
          maxResults: 3,
        });
        newsMap[asset.assetCode] = news;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to get market news for ${asset.assetCode}:`, errorMessage);
        // Continue with other assets even if one fails
      }
    }

    return newsMap;
  }

  /**
   * Gather DeFi ecosystem trends
   */
  private async gatherDeFiTrends(): Promise<any> {
    if (!tavilyService.isConfigured()) {
      console.warn('Tavily API not configured, skipping DeFi trends');
      return null;
    }

    try {
      const trends = await tavilyService.getDeFiTrends();
      return {
        summary: trends.answer || 'No trends available',
        articles: trends.results.slice(0, 3).map(r => ({
          title: r.title,
          url: r.url,
          content: r.content.slice(0, 300), // Truncate for token efficiency
        })),
      };
    } catch (error) {
      console.error('Failed to get DeFi trends:', error);
      return null;
    }
  }

  /**
   * Gather market forecasts for vault assets
   */
  private async gatherForecasts(config: VaultConfig): Promise<Record<string, any>> {
    const forecasts: Record<string, any> = {};

    for (const asset of config.assets) {
      try {
        // Note: This would require historical price data - simplified for MVP
        // In production, fetch historical prices and use prophetService.forecastPriceTrend
        forecasts[asset.assetCode] = {
          trend: 'neutral',
          confidence: 0.5,
          message: 'Forecast data not yet implemented',
        };
      } catch (error) {
        console.error(`Failed to get forecast for ${asset.assetCode}:`, error);
      }
    }

    return forecasts;
  }

  /**
   * Generate suggestions using OpenAI
   */
  private async generateAISuggestions(
    analysis: StrategyAnalysis | null,
    sentiment: Record<string, SentimentAnalysis> | null,
    marketNews: Record<string, MarketNewsResult> | null,
    defiTrends: any,
    forecasts: Record<string, any> | null,
    preferences?: SuggestionRequest['userPreferences']
  ): Promise<Omit<Suggestion, 'id' | 'vaultId' | 'dataSupport' | 'createdAt'>[]> {
    try {
      const prompt = this.SUGGESTION_PROMPT
        .replace('{analysis}', JSON.stringify(analysis, null, 2))
        .replace('{sentiment}', JSON.stringify(sentiment, null, 2))
        .replace('{marketNews}', JSON.stringify(marketNews, null, 2))
        .replace('{defiTrends}', JSON.stringify(defiTrends, null, 2))
        .replace('{forecasts}', JSON.stringify(forecasts, null, 2))
        .replace('{preferences}', JSON.stringify(preferences || {}, null, 2));

      console.log('[SuggestionGenerator] Calling OpenAI API with model:', process.env.OPENAI_MODEL || 'gpt-4-turbo-preview');

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert DeFi strategist specializing in yield vault optimization. Provide specific, actionable, data-driven suggestions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      console.log('[SuggestionGenerator] OpenAI API call successful');

      const content = response.choices[0].message.content || '[]';
      console.log('[SuggestionGenerator] OpenAI response content length:', content.length);
      
      const parsed = JSON.parse(content);
      console.log('[SuggestionGenerator] Parsed response type:', Array.isArray(parsed) ? 'array' : 'object');
      
      if (!Array.isArray(parsed)) {
        console.log('[SuggestionGenerator] Parsed response keys:', Object.keys(parsed));
      }
      
      // Handle multiple possible response structures
      let suggestionsArray: any[] = [];
      if (Array.isArray(parsed)) {
        suggestionsArray = parsed;
      } else if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        suggestionsArray = parsed.suggestions;
      } else if (parsed.data && Array.isArray(parsed.data)) {
        suggestionsArray = parsed.data;
      } else if (parsed.results && Array.isArray(parsed.results)) {
        suggestionsArray = parsed.results;
      } else {
        // Try to find any array in the response
        const possibleArrays = Object.entries(parsed).filter(([_, value]) => Array.isArray(value));
        if (possibleArrays.length > 0) {
          console.log('[SuggestionGenerator] Found array keys:', possibleArrays.map(([key]) => key));
          suggestionsArray = possibleArrays[0][1] as any[];
        }
      }
      
      console.log('[SuggestionGenerator] Extracted suggestions count:', suggestionsArray.length);

      if (suggestionsArray.length === 0) {
        console.warn('[SuggestionGenerator] OpenAI returned empty suggestions array');
        console.warn('[SuggestionGenerator] OpenAI response preview:', JSON.stringify(parsed, null, 2).substring(0, 500));
      }

      return suggestionsArray.map((s: any) => ({
        type: s.type || 'rebalance',
        priority: s.priority || 'medium',
        title: s.title || 'Untitled Suggestion',
        description: s.description || '',
        rationale: s.rationale || '',
        expectedImpact: s.expectedImpact || {},
        implementation: {
          steps: s.steps || [],
          difficulty: s.difficulty || 'moderate',
          estimatedTime: this.estimateImplementationTime(s.difficulty),
        },
        configChanges: s.configChanges,
      }));
    } catch (error) {
      console.error('[SuggestionGenerator] Failed to generate AI suggestions:', error);
      console.error('[SuggestionGenerator] Error details:', error instanceof Error ? error.message : String(error));
      
      // Fallback to rule-based suggestions
      console.log('[SuggestionGenerator] Falling back to rule-based suggestions');
      const fallbackSuggestions = this.generateFallbackSuggestions(analysis);
      console.log(`[SuggestionGenerator] Generated ${fallbackSuggestions.length} fallback suggestions`);
      return fallbackSuggestions;
    }
  }

  /**
   * Generate fallback suggestions based on analysis
   */
  private generateFallbackSuggestions(
    analysis: StrategyAnalysis | null
  ): Omit<Suggestion, 'id' | 'vaultId' | 'dataSupport' | 'createdAt'>[] {
    const suggestions: Omit<Suggestion, 'id' | 'vaultId' | 'dataSupport' | 'createdAt'>[] = [];

    if (!analysis) {
      console.warn('[SuggestionGenerator] No analysis data available for fallback suggestions');
      return suggestions;
    }

    console.log('[SuggestionGenerator] Generating fallback from analysis:', {
      issuesCount: analysis.issues.length,
      diversificationScore: analysis.diversificationScore,
    });

    // Convert high-severity issues to suggestions
    analysis.issues
      .filter(issue => issue.severity === 'high')
      .forEach(issue => {
        suggestions.push({
          type: this.issueToSuggestionType(issue.category),
          priority: 'high',
          title: issue.title,
          description: issue.description,
          rationale: issue.recommendation,
          expectedImpact: {
            riskReduction: issue.category === 'risk' ? 15 : undefined,
            efficiencyGain: issue.category === 'efficiency' ? 10 : undefined,
          },
          implementation: {
            steps: [issue.recommendation],
            difficulty: 'moderate',
            estimatedTime: '10-15 minutes',
          },
        });
      });

    // Add diversification suggestion if needed
    if (analysis.diversificationScore < 60) {
      suggestions.push({
        type: 'add_asset',
        priority: 'medium',
        title: 'Improve Portfolio Diversification',
        description: 'Your vault has limited diversification, which increases risk exposure.',
        rationale: 'Adding more assets will reduce concentration risk and improve risk-adjusted returns.',
        expectedImpact: {
          riskReduction: 20,
        },
        implementation: {
          steps: [
            'Research correlated assets with different risk profiles',
            'Add 1-2 new assets to your vault',
            'Rebalance allocations to maintain 100% total',
          ],
          difficulty: 'moderate',
          estimatedTime: '15-20 minutes',
        },
      });
    }

    return suggestions.slice(0, 5); // Return max 5 suggestions
  }

  /**
   * Convert issue category to suggestion type
   */
  private issueToSuggestionType(category: string): Suggestion['type'] {
    switch (category) {
      case 'risk':
        return 'risk_adjustment';
      case 'efficiency':
        return 'adjust_rule';
      case 'diversification':
        return 'add_asset';
      default:
        return 'rebalance';
    }
  }

  /**
   * Estimate implementation time based on difficulty
   */
  private estimateImplementationTime(difficulty: string): string {
    switch (difficulty) {
      case 'easy':
        return '5-10 minutes';
      case 'moderate':
        return '15-20 minutes';
      case 'advanced':
        return '30-45 minutes';
      default:
        return '15-20 minutes';
    }
  }
}

// Export singleton instance
export const suggestionGenerator = new SuggestionGenerator();
