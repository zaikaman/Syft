/**
 * Reddit Sentiment Fetching Service (T111)
 * Fetches posts and comments from crypto-related subreddits
 * Uses Reddit API: https://www.reddit.com/dev/api/
 */

import axios, { AxiosInstance } from 'axios';

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  created_utc: number;
  score: number;
  num_comments: number;
  upvote_ratio: number;
  subreddit: string;
  permalink: string;
  url: string;
}

interface RedditComment {
  id: string;
  body: string;
  author: string;
  created_utc: number;
  score: number;
  permalink: string;
}

interface RedditListing {
  kind: string;
  data: {
    children: Array<{
      kind: string;
      data: RedditPost | RedditComment;
    }>;
    after?: string;
    before?: string;
  };
}

interface RedditSentimentData {
  posts: RedditPost[];
  comments?: RedditComment[];
  metadata: {
    totalPosts: number;
    subreddits: string[];
    timeRange: {
      start: string;
      end: string;
    };
    searchQuery?: string;
  };
}

export class RedditService {
  private client: AxiosInstance;
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private tokenExpiry?: number;
  private userAgent = 'Syft:v1.0.0 (by /u/SyftDeFi)';

  // Popular crypto subreddits
  private readonly cryptoSubreddits = [
    'Stellar',
    'StellarLumens',
    'CryptoCurrency',
    'defi',
    'SorobanSmartContracts',
  ];

  constructor() {
    this.clientId = process.env.REDDIT_CLIENT_ID || '';
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('Reddit API credentials not configured. Reddit sentiment analysis will be unavailable.');
    }

    this.client = axios.create({
      headers: {
        'User-Agent': this.userAgent,
      },
      timeout: 8000, // Reduce timeout to 8 seconds
    });
  }

  /**
   * Authenticate with Reddit API and get access token
   */
  private async authenticate(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return; // Token still valid
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Reddit API credentials not configured');
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(
        'https://www.reddit.com/api/v1/access_token',
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      // Update client with new token
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
      this.client.defaults.baseURL = 'https://oauth.reddit.com';
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Reddit authentication error:', error.response?.data || error.message);
        throw new Error(`Failed to authenticate with Reddit: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Search posts in a specific subreddit
   */
  async searchSubreddit(
    subreddit: string,
    query: string,
    limit: number = 25,
    timeFilter: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' = 'week'
  ): Promise<RedditPost[]> {
    await this.authenticate();

    try {
      const response = await this.client.get<RedditListing>(
        `/r/${subreddit}/search`,
        {
          params: {
            q: query,
            restrict_sr: 'true',
            sort: 'relevance',
            t: timeFilter,
            limit: Math.min(limit, 100),
          },
        }
      );

      return response.data.data.children.map(child => child.data as RedditPost);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMsg = error.code === 'ECONNABORTED' ? 'timeout' : (error.response?.data || error.message);
        console.error(`Reddit search error for r/${subreddit}:`, errorMsg);
        // Return empty array instead of throwing to prevent cascading failures
        return [];
      }
      console.error('Unexpected Reddit search error:', error);
      return [];
    }
  }

  /**
   * Get hot posts from a subreddit
   */
  async getHotPosts(subreddit: string, limit: number = 25): Promise<RedditPost[]> {
    await this.authenticate();

    try {
      const response = await this.client.get<RedditListing>(
        `/r/${subreddit}/hot`,
        {
          params: {
            limit: Math.min(limit, 100),
          },
        }
      );

      return response.data.data.children.map(child => child.data as RedditPost);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMsg = error.code === 'ECONNABORTED' ? 'timeout' : (error.response?.data || error.message);
        console.error(`Reddit hot posts error for r/${subreddit}:`, errorMsg);
        // Return empty array instead of throwing to prevent cascading failures
        return [];
      }
      console.error('Unexpected Reddit hot posts error:', error);
      return [];
    }
  }

  /**
   * Get comments for a specific post
   */
  async getPostComments(subreddit: string, postId: string, limit: number = 50): Promise<RedditComment[]> {
    await this.authenticate();

    try {
      const response = await this.client.get<RedditListing[]>(
        `/r/${subreddit}/comments/${postId}`,
        {
          params: {
            limit: Math.min(limit, 100),
          },
        }
      );

      // Reddit returns an array with two listings: [post, comments]
      const commentsListing = response.data[1];
      if (!commentsListing) return [];

      return commentsListing.data.children
        .filter(child => child.kind === 't1') // t1 = comment
        .map(child => child.data as RedditComment);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Reddit comments error:', error.response?.data || error.message);
        return []; // Return empty array on error
      }
      return [];
    }
  }

  /**
   * Get sentiment data for a specific asset
   */
  async getAssetSentiment(
    assetSymbol: string,
    hoursBack: number = 24
  ): Promise<RedditSentimentData> {
    const timeFilter = hoursBack <= 24 ? 'day' : hoursBack <= 168 ? 'week' : 'month';
    const allPosts: RedditPost[] = [];

    // Search across multiple crypto subreddits
    for (const subreddit of this.cryptoSubreddits) {
      try {
        const posts = await this.searchSubreddit(subreddit, assetSymbol, 10, timeFilter);
        allPosts.push(...posts);
      } catch (error) {
        console.error(`Failed to fetch from r/${subreddit}:`, error);
        // Continue with other subreddits
      }
    }

    // Filter by time
    const cutoffTime = Math.floor((Date.now() - hoursBack * 60 * 60 * 1000) / 1000);
    const filteredPosts = allPosts.filter(post => post.created_utc >= cutoffTime);

    return {
      posts: filteredPosts,
      metadata: {
        totalPosts: filteredPosts.length,
        subreddits: this.cryptoSubreddits,
        timeRange: {
          start: new Date(cutoffTime * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        searchQuery: assetSymbol,
      },
    };
  }

  /**
   * Get trending DeFi discussions
   */
  async getTrendingDeFi(): Promise<RedditSentimentData> {
    const allPosts: RedditPost[] = [];

    for (const subreddit of ['defi', 'Stellar']) {
      try {
        const posts = await this.getHotPosts(subreddit, 25);
        allPosts.push(...posts);
      } catch (error) {
        console.error(`Failed to fetch from r/${subreddit}:`, error);
      }
    }

    return {
      posts: allPosts,
      metadata: {
        totalPosts: allPosts.length,
        subreddits: ['defi', 'Stellar'],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
      },
    };
  }

  /**
   * Calculate engagement score for a post
   */
  calculateEngagementScore(post: RedditPost): number {
    return post.score * 1 + post.num_comments * 2;
  }

  /**
   * Filter posts by minimum score
   */
  filterByScore(posts: RedditPost[], minScore: number = 10): RedditPost[] {
    return posts.filter(post => post.score >= minScore);
  }

  /**
   * Get top posts by engagement
   */
  getTopPosts(sentimentData: RedditSentimentData, limit: number = 10): RedditPost[] {
    return sentimentData.posts
      .sort((a, b) => this.calculateEngagementScore(b) - this.calculateEngagementScore(a))
      .slice(0, limit);
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

// Export singleton instance
export const redditService = new RedditService();
