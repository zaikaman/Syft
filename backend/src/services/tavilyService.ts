/**
 * Tavily Web Search Service
 * Provides real-time web search for market news, trends, and crypto insights
 * Documentation: https://docs.tavily.com/
 */

import { tavily } from '@tavily/core';

interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

interface TavilySearchResponse {
  query: string;
  results: SearchResult[];
  followUpQuestions?: string[];
  answer?: string;
  images?: Array<{ url: string; description?: string }>;
}

export interface MarketNewsResult {
  asset: string;
  news: SearchResult[];
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  keyInsights: string[];
  timestamp: string;
}

export class TavilyService {
  private client: ReturnType<typeof tavily>;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY || '';

    if (!this.apiKey) {
      console.warn('Tavily API key not configured. Web search will be unavailable.');
    }

    this.client = tavily({ apiKey: this.apiKey });
  }

  /**
   * Search the web for recent information
   */
  async search(
    query: string,
    options?: {
      searchDepth?: 'basic' | 'advanced';
      maxResults?: number;
      includeDomains?: string[];
      excludeDomains?: string[];
      includeAnswer?: boolean;
      includeImages?: boolean;
    }
  ): Promise<TavilySearchResponse> {
    if (!this.apiKey) {
      throw new Error('Tavily API key not configured');
    }

    try {
      const response = await this.client.search(query, {
        searchDepth: options?.searchDepth || 'basic',
        maxResults: options?.maxResults || 5,
        includeDomains: options?.includeDomains,
        excludeDomains: options?.excludeDomains,
        includeAnswer: options?.includeAnswer !== false,
        includeImages: options?.includeImages || false,
      });

      return {
        query,
        results: response.results || [],
        followUpQuestions: (response as any).followUpQuestions || [],
        answer: response.answer,
        images: response.images || [],
      };
    } catch (error) {
      console.error('Tavily search error:', error);
      // Return empty results on error to prevent cascading failures
      return {
        query,
        results: [],
        followUpQuestions: [],
        answer: undefined,
        images: [],
      };
    }
  }

  /**
   * Get market news and analysis for a crypto asset
   */
  async getAssetNews(
    assetCode: string,
    options?: {
      daysBack?: number;
      maxResults?: number;
    }
  ): Promise<MarketNewsResult> {
    const daysBack = options?.daysBack || 7;
    const maxResults = options?.maxResults || 5;

    // Build search query for crypto asset news
    const query = `${assetCode} cryptocurrency news analysis trends last ${daysBack} days`;

    try {
      const searchResult = await this.search(query, {
        searchDepth: 'basic',
        maxResults,
        includeAnswer: true,
        includeDomains: [
          'coindesk.com',
          'cointelegraph.com',
          'decrypt.co',
          'theblock.co',
          'cryptoslate.com',
          'stellar.org',
        ],
      });

      // Extract key insights from search results
      const keyInsights = this.extractKeyInsights(searchResult.results);

      // Determine sentiment from results
      const sentiment = this.analyzeSentiment(searchResult.results, searchResult.answer);

      return {
        asset: assetCode,
        news: searchResult.results,
        summary: searchResult.answer || 'No summary available',
        sentiment,
        keyInsights,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to get news for ${assetCode}:`, error);
      return {
        asset: assetCode,
        news: [],
        summary: 'Unable to fetch market news',
        sentiment: 'neutral',
        keyInsights: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Search for DeFi and Stellar ecosystem trends
   */
  async getDeFiTrends(): Promise<TavilySearchResponse> {
    const query = 'Stellar DeFi Soroban smart contracts latest trends developments';

    return this.search(query, {
      searchDepth: 'basic',
      maxResults: 5,
      includeAnswer: true,
      includeDomains: [
        'stellar.org',
        'soroban.stellar.org',
        'coindesk.com',
        'cointelegraph.com',
        'decrypt.co',
      ],
    });
  }

  /**
   * Search for yield optimization strategies
   */
  async getYieldStrategies(assets: string[]): Promise<TavilySearchResponse> {
    const assetList = assets.join(' ');
    const query = `${assetList} DeFi yield farming optimization strategies 2025`;

    return this.search(query, {
      searchDepth: 'advanced',
      maxResults: 5,
      includeAnswer: true,
    });
  }

  /**
   * Extract key insights from search results
   */
  private extractKeyInsights(results: SearchResult[]): string[] {
    const insights: string[] = [];

    results.forEach(result => {
      // Extract first sentence or up to 200 chars from content
      const content = result.content.trim();
      const firstSentence = content.split(/[.!?]/)[0];
      if (firstSentence && firstSentence.length > 20) {
        insights.push(firstSentence.trim());
      }
    });

    return insights.slice(0, 5); // Return top 5 insights
  }

  /**
   * Analyze sentiment from search results
   */
  private analyzeSentiment(
    results: SearchResult[],
    answer?: string
  ): 'bullish' | 'bearish' | 'neutral' {
    const positiveKeywords = [
      'growth', 'surge', 'bullish', 'rally', 'gains', 'rise', 'increase',
      'adoption', 'partnership', 'upgrade', 'breakthrough', 'success',
      'positive', 'strong', 'optimistic', 'upward', 'momentum'
    ];

    const negativeKeywords = [
      'drop', 'fall', 'bearish', 'decline', 'crash', 'loss', 'decrease',
      'concern', 'risk', 'warning', 'negative', 'weak', 'pessimistic',
      'downward', 'struggle', 'challenge', 'issue'
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    // Analyze results and answer
    const textToAnalyze = [
      ...(results.map(r => `${r.title} ${r.content}`)),
      answer || '',
    ].join(' ').toLowerCase();

    positiveKeywords.forEach(keyword => {
      const matches = textToAnalyze.match(new RegExp(keyword, 'g'));
      if (matches) positiveCount += matches.length;
    });

    negativeKeywords.forEach(keyword => {
      const matches = textToAnalyze.match(new RegExp(keyword, 'g'));
      if (matches) negativeCount += matches.length;
    });

    // Calculate sentiment
    const total = positiveCount + negativeCount;
    if (total === 0) return 'neutral';

    const positiveRatio = positiveCount / total;

    if (positiveRatio >= 0.6) return 'bullish';
    if (positiveRatio <= 0.4) return 'bearish';
    return 'neutral';
  }

  /**
   * Check if Tavily is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Export singleton instance
export const tavilyService = new TavilyService();
