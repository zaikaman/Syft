/**
 * Suggestion Generator Service (T114)
 * Combines historical data, sentiment, and Prophet forecasts to generate AI-powered suggestions
 */

import { openai } from '../lib/openaiClient';
import { strategyAnalyzer, StrategyAnalysis } from './strategyAnalyzer';
import { sentimentAnalysisService, SentimentAnalysis } from './sentimentAnalysisService';
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

Sentiment Data:
{sentiment}

Market Forecasts:
{forecasts}

User Preferences:
{preferences}

Generate suggestions that are:
1. Specific and actionable
2. Data-driven with clear rationale
3. Prioritized by potential impact
4. Realistic to implement

Return a JSON array of suggestions with this structure:
[{
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

Respond only with valid JSON array.`;

  /**
   * Generate AI-powered suggestions for a vault
   */
  async generateSuggestions(request: SuggestionRequest): Promise<Suggestion[]> {
    const { vaultId, config, performanceData, userPreferences } = request;

    // Gather all relevant data in parallel
    const [analysis, sentimentData, forecasts] = await Promise.allSettled([
      this.analyzeStrategy(vaultId, config, performanceData),
      this.gatherSentimentData(config),
      this.gatherForecasts(config),
    ]);

    const strategyAnalysis = analysis.status === 'fulfilled' ? analysis.value : null;
    const sentiment = sentimentData.status === 'fulfilled' ? sentimentData.value : null;
    const forecastData = forecasts.status === 'fulfilled' ? forecasts.value : null;

    // Generate suggestions using AI
    const aiSuggestions = await this.generateAISuggestions(
      strategyAnalysis,
      sentiment,
      forecastData,
      userPreferences
    );

    // Enhance suggestions with additional data
    const enrichedSuggestions = aiSuggestions.map((suggestion, index) => ({
      ...suggestion,
      id: `${vaultId}-suggestion-${Date.now()}-${index}`,
      vaultId,
      dataSupport: {
        sentiment: sentiment || undefined,
        forecast: forecastData || undefined,
        analysis: strategyAnalysis || undefined,
      },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    }));

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
      try {
        const sentiment = await sentimentAnalysisService.analyzeAssetSentiment(
          asset.assetCode,
          24 // Last 24 hours
        );
        sentimentMap[asset.assetCode] = sentiment;
      } catch (error) {
        console.error(`Failed to get sentiment for ${asset.assetCode}:`, error);
      }
    }

    return sentimentMap;
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
    forecasts: Record<string, any> | null,
    preferences?: SuggestionRequest['userPreferences']
  ): Promise<Omit<Suggestion, 'id' | 'vaultId' | 'dataSupport' | 'createdAt'>[]> {
    try {
      const prompt = this.SUGGESTION_PROMPT
        .replace('{analysis}', JSON.stringify(analysis, null, 2))
        .replace('{sentiment}', JSON.stringify(sentiment, null, 2))
        .replace('{forecasts}', JSON.stringify(forecasts, null, 2))
        .replace('{preferences}', JSON.stringify(preferences || {}, null, 2));

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
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content || '[]';
      const parsed = JSON.parse(content);
      
      // Handle both array and object with suggestions array
      const suggestionsArray = Array.isArray(parsed) ? parsed : (parsed.suggestions || []);

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
      console.error('Failed to generate AI suggestions:', error);
      
      // Fallback to rule-based suggestions
      return this.generateFallbackSuggestions(analysis);
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
      return suggestions;
    }

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
