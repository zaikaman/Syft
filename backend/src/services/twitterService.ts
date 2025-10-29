/**
 * Twitter/X Sentiment Fetching Service (T110)
 * Uses TwitterXAPI (twexapi.io) for fetching tweets and social sentiment
 * Documentation: https://docs.twitterxapi.com/
 */

import axios, { AxiosInstance } from 'axios';

interface TweetData {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  entities?: {
    hashtags?: Array<{ tag: string }>;
    cashtags?: Array<{ tag: string }>;
  };
}

interface TwitterSearchResponse {
  data?: TweetData[];
  meta?: {
    newest_id: string;
    oldest_id: string;
    result_count: number;
    next_token?: string;
  };
}

interface SentimentData {
  tweets: TweetData[];
  metadata: {
    totalTweets: number;
    timeRange: {
      start: string;
      end: string;
    };
    searchQuery: string;
  };
}

export class TwitterService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL = 'https://api.twexapi.com/v2';

  constructor() {
    this.apiKey = process.env.TWEXAPI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('TwitterXAPI key not configured. Sentiment analysis will be unavailable.');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 8000, // Reduce timeout to 8 seconds
    });
  }

  /**
   * Search tweets for a specific asset or topic
   * @param query Search query (e.g., "XLM", "$USDC", "Stellar")
   * @param maxResults Maximum number of tweets to fetch (default: 100, max: 100)
   * @param startTime Start time for search (ISO 8601 format)
   * @param endTime End time for search (ISO 8601 format)
   */
  async searchTweets(
    query: string,
    maxResults: number = 100,
    startTime?: string,
    endTime?: string
  ): Promise<SentimentData> {
    if (!this.apiKey) {
      throw new Error('TwitterXAPI key not configured');
    }

    try {
      // Build query parameters
      const params: any = {
        query: query,
        max_results: Math.min(maxResults, 100),
        'tweet.fields': 'created_at,public_metrics,entities,author_id',
        expansions: 'author_id',
      };

      if (startTime) {
        params.start_time = startTime;
      }

      if (endTime) {
        params.end_time = endTime;
      }

      const response = await this.client.get<TwitterSearchResponse>('/tweets/search/recent', {
        params,
      });

      const tweets = response.data.data || [];
      const meta = response.data.meta;

      return {
        tweets,
        metadata: {
          totalTweets: meta?.result_count || 0,
          timeRange: {
            start: startTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            end: endTime || new Date().toISOString(),
          },
          searchQuery: query,
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMsg = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' 
          ? 'timeout' 
          : (error.response?.data || error.message);
        console.error('TwitterXAPI error:', errorMsg);
        // Return empty result instead of throwing to prevent cascading failures
        return {
          tweets: [],
          metadata: {
            totalTweets: 0,
            timeRange: {
              start: startTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              end: endTime || new Date().toISOString(),
            },
            searchQuery: query,
          },
        };
      }
      console.error('Unexpected Twitter error:', error);
      return {
        tweets: [],
        metadata: {
          totalTweets: 0,
          timeRange: {
            start: startTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            end: endTime || new Date().toISOString(),
          },
          searchQuery: query,
        },
      };
    }
  }

  /**
   * Get sentiment data for a specific cryptocurrency asset
   * @param assetSymbol Asset symbol (e.g., "XLM", "USDC")
   * @param hoursBack How many hours of data to fetch (default: 24)
   */
  async getAssetSentiment(assetSymbol: string, hoursBack: number = 24): Promise<SentimentData> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hoursBack * 60 * 60 * 1000);

    // Build search query with common crypto patterns
    const query = `($${assetSymbol} OR #${assetSymbol} OR "${assetSymbol}") -is:retweet lang:en`;

    return this.searchTweets(
      query,
      100,
      startTime.toISOString(),
      endTime.toISOString()
    );
  }

  /**
   * Get trending topics related to DeFi or Stellar ecosystem
   */
  async getTrendingDeFiTopics(): Promise<SentimentData> {
    const query = '(DeFi OR Stellar OR Soroban OR #StellarNetwork) -is:retweet lang:en';
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    return this.searchTweets(
      query,
      100,
      startTime.toISOString(),
      endTime.toISOString()
    );
  }

  /**
   * Calculate engagement score for a tweet
   * Higher score indicates more engagement
   */
  calculateEngagementScore(tweet: TweetData): number {
    const metrics = tweet.public_metrics;
    return (
      metrics.like_count * 1 +
      metrics.retweet_count * 2 +
      metrics.reply_count * 1.5 +
      metrics.quote_count * 2
    );
  }

  /**
   * Filter tweets by minimum engagement threshold
   */
  filterByEngagement(tweets: TweetData[], minScore: number = 10): TweetData[] {
    return tweets.filter(tweet => this.calculateEngagementScore(tweet) >= minScore);
  }

  /**
   * Get most engaged tweets from sentiment data
   */
  getTopTweets(sentimentData: SentimentData, limit: number = 10): TweetData[] {
    return sentimentData.tweets
      .sort((a, b) => this.calculateEngagementScore(b) - this.calculateEngagementScore(a))
      .slice(0, limit);
  }

  /**
   * Extract cashtags from tweets (e.g., $XLM, $USDC)
   */
  extractCashtags(tweets: TweetData[]): Map<string, number> {
    const cashtagCount = new Map<string, number>();

    tweets.forEach(tweet => {
      if (tweet.entities?.cashtags) {
        tweet.entities.cashtags.forEach(cashtag => {
          const tag = cashtag.tag.toUpperCase();
          cashtagCount.set(tag, (cashtagCount.get(tag) || 0) + 1);
        });
      }
    });

    return cashtagCount;
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Export singleton instance
export const twitterService = new TwitterService();
