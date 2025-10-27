/**
 * Sentiment Analysis Service (T112)
 * Uses OpenAI to classify sentiment from social media posts
 * Combines data from Twitter and Reddit for comprehensive analysis
 */

import { openai } from '../lib/openaiClient';
import { twitterService } from './twitterService';
import { redditService } from './redditService';

export type SentimentScore = 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';

export interface SentimentAnalysis {
  asset: string;
  overallSentiment: SentimentScore;
  sentimentScore: number; // -1 to 1
  confidence: number; // 0 to 1
  totalPosts: number;
  sources: {
    twitter: {
      count: number;
      sentiment: SentimentScore;
    };
    reddit: {
      count: number;
      sentiment: SentimentScore;
    };
  };
  keyThemes: string[];
  summary: string;
  timestamp: string;
}

export interface SentimentTrend {
  asset: string;
  currentSentiment: SentimentScore;
  trend: 'improving' | 'declining' | 'stable';
  momentum: number; // Rate of change
  dataPoints: Array<{
    timestamp: string;
    sentiment: SentimentScore;
    score: number;
  }>;
}

export class SentimentAnalysisService {
  private readonly SENTIMENT_PROMPT = `Analyze the sentiment of the following social media posts about a cryptocurrency asset. 

Consider:
- Overall tone (positive, negative, neutral)
- Key themes and topics being discussed
- Price speculation and predictions
- Technical developments
- Community engagement

Provide a JSON response with:
{
  "sentiment": "very_negative" | "negative" | "neutral" | "positive" | "very_positive",
  "score": <number between -1 and 1>,
  "confidence": <number between 0 and 1>,
  "keyThemes": [<array of key themes discussed>],
  "summary": "<brief 2-3 sentence summary>"
}

Posts:
{posts}

Respond only with valid JSON.`;

  /**
   * Analyze sentiment for a specific asset
   */
  async analyzeAssetSentiment(
    asset: string,
    hoursBack: number = 24
  ): Promise<SentimentAnalysis> {
    // Fetch data from both sources in parallel
    const [twitterData, redditData] = await Promise.allSettled([
      twitterService.isConfigured() 
        ? twitterService.getAssetSentiment(asset, hoursBack)
        : Promise.resolve(null),
      redditService.isConfigured()
        ? redditService.getAssetSentiment(asset, hoursBack)
        : Promise.resolve(null),
    ]);

    const tweets = twitterData.status === 'fulfilled' && twitterData.value 
      ? twitterData.value.tweets 
      : [];
    const redditPosts = redditData.status === 'fulfilled' && redditData.value
      ? redditData.value.posts
      : [];

    if (tweets.length === 0 && redditPosts.length === 0) {
      throw new Error('No social media data available for sentiment analysis');
    }

    // Analyze Twitter sentiment
    const twitterSentiment = tweets.length > 0
      ? await this.analyzePosts(tweets.map(t => t.text))
      : { sentiment: 'neutral' as SentimentScore, score: 0, confidence: 0, keyThemes: [], summary: '' };

    // Analyze Reddit sentiment
    const redditSentiment = redditPosts.length > 0
      ? await this.analyzePosts(redditPosts.map(p => `${p.title}\n${p.selftext}`))
      : { sentiment: 'neutral' as SentimentScore, score: 0, confidence: 0, keyThemes: [], summary: '' };

    // Combine sentiments with weighted average
    const twitterWeight = tweets.length / (tweets.length + redditPosts.length);
    const redditWeight = redditPosts.length / (tweets.length + redditPosts.length);

    const combinedScore = 
      (twitterSentiment.score * twitterWeight) + 
      (redditSentiment.score * redditWeight);

    const combinedConfidence = 
      (twitterSentiment.confidence * twitterWeight) + 
      (redditSentiment.confidence * redditWeight);

    // Combine key themes
    const allThemes = [...twitterSentiment.keyThemes, ...redditSentiment.keyThemes];
    const uniqueThemes = Array.from(new Set(allThemes)).slice(0, 5);

    return {
      asset,
      overallSentiment: this.scoreToSentiment(combinedScore),
      sentimentScore: combinedScore,
      confidence: combinedConfidence,
      totalPosts: tweets.length + redditPosts.length,
      sources: {
        twitter: {
          count: tweets.length,
          sentiment: twitterSentiment.sentiment,
        },
        reddit: {
          count: redditPosts.length,
          sentiment: redditSentiment.sentiment,
        },
      },
      keyThemes: uniqueThemes,
      summary: this.combineSummaries(twitterSentiment.summary, redditSentiment.summary),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Analyze sentiment from array of text posts
   */
  private async analyzePosts(posts: string[]): Promise<{
    sentiment: SentimentScore;
    score: number;
    confidence: number;
    keyThemes: string[];
    summary: string;
  }> {
    if (posts.length === 0) {
      return {
        sentiment: 'neutral',
        score: 0,
        confidence: 0,
        keyThemes: [],
        summary: 'No data available',
      };
    }

    try {
      // Take sample of posts if too many (to stay within token limits)
      const samplePosts = posts.length > 50 
        ? this.samplePosts(posts, 50)
        : posts;

      const postsText = samplePosts
        .filter(p => p && p.trim().length > 0)
        .map((p, i) => `${i + 1}. ${p.slice(0, 500)}`) // Limit each post
        .join('\n\n');

      const prompt = this.SENTIMENT_PROMPT.replace('{posts}', postsText);

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a cryptocurrency sentiment analysis expert. Analyze social media sentiment accurately and provide structured insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        sentiment: result.sentiment || 'neutral',
        score: result.score || 0,
        confidence: result.confidence || 0.5,
        keyThemes: result.keyThemes || [],
        summary: result.summary || 'No summary available',
      };
    } catch (error) {
      console.error('OpenAI sentiment analysis error:', error);
      
      // Fallback to simple keyword-based sentiment
      return this.fallbackSentimentAnalysis(posts);
    }
  }

  /**
   * Fallback sentiment analysis using keyword matching
   */
  private fallbackSentimentAnalysis(posts: string[]): {
    sentiment: SentimentScore;
    score: number;
    confidence: number;
    keyThemes: string[];
    summary: string;
  } {
    const positiveKeywords = ['bullish', 'moon', 'pump', 'buy', 'growth', 'adoption', 'partnership', 'upgrade'];
    const negativeKeywords = ['bearish', 'dump', 'sell', 'crash', 'scam', 'fail', 'risk', 'concern'];

    let positiveCount = 0;
    let negativeCount = 0;

    posts.forEach(post => {
      const lowerPost = post.toLowerCase();
      positiveKeywords.forEach(kw => {
        if (lowerPost.includes(kw)) positiveCount++;
      });
      negativeKeywords.forEach(kw => {
        if (lowerPost.includes(kw)) negativeCount++;
      });
    });

    const total = positiveCount + negativeCount;
    const score = total > 0 ? (positiveCount - negativeCount) / total : 0;

    return {
      sentiment: this.scoreToSentiment(score),
      score,
      confidence: 0.6,
      keyThemes: ['general discussion'],
      summary: `Basic sentiment analysis based on ${posts.length} posts.`,
    };
  }

  /**
   * Convert numeric score to sentiment category
   */
  private scoreToSentiment(score: number): SentimentScore {
    if (score >= 0.5) return 'very_positive';
    if (score >= 0.2) return 'positive';
    if (score <= -0.5) return 'very_negative';
    if (score <= -0.2) return 'negative';
    return 'neutral';
  }

  /**
   * Combine summaries from different sources
   */
  private combineSummaries(summary1: string, summary2: string): string {
    if (!summary1 && !summary2) return 'No summary available';
    if (!summary1) return summary2;
    if (!summary2) return summary1;
    return `${summary1} ${summary2}`;
  }

  /**
   * Randomly sample posts
   */
  private samplePosts(posts: string[], count: number): string[] {
    const shuffled = [...posts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Analyze sentiment trend over time
   */
  async analyzeSentimentTrend(
    asset: string,
    periods: number = 7
  ): Promise<SentimentTrend> {
    const dataPoints: SentimentTrend['dataPoints'] = [];
    const hoursPerPeriod = 24; // Daily periods

    // Fetch sentiment for each period
    for (let i = 0; i < periods; i++) {
      const hoursBack = (i + 1) * hoursPerPeriod;
      try {
        const sentiment = await this.analyzeAssetSentiment(asset, hoursPerPeriod);
        dataPoints.push({
          timestamp: new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString(),
          sentiment: sentiment.overallSentiment,
          score: sentiment.sentimentScore,
        });
      } catch (error) {
        console.error(`Failed to fetch sentiment for period ${i}:`, error);
      }
    }

    // Calculate trend
    const currentSentiment = dataPoints[0]?.sentiment || 'neutral';
    const momentum = this.calculateMomentum(dataPoints);
    const trend = momentum > 0.1 ? 'improving' : momentum < -0.1 ? 'declining' : 'stable';

    return {
      asset,
      currentSentiment,
      trend,
      momentum,
      dataPoints: dataPoints.reverse(), // Oldest first
    };
  }

  /**
   * Calculate sentiment momentum (rate of change)
   */
  private calculateMomentum(dataPoints: SentimentTrend['dataPoints']): number {
    if (dataPoints.length < 2) return 0;

    const recentScores = dataPoints.slice(0, Math.min(3, dataPoints.length));
    const olderScores = dataPoints.slice(-Math.min(3, dataPoints.length));

    const recentAvg = recentScores.reduce((sum, dp) => sum + dp.score, 0) / recentScores.length;
    const olderAvg = olderScores.reduce((sum, dp) => sum + dp.score, 0) / olderScores.length;

    return recentAvg - olderAvg;
  }

  /**
   * Check if sentiment analysis is available
   */
  isAvailable(): boolean {
    return twitterService.isConfigured() || redditService.isConfigured();
  }
}

// Export singleton instance
export const sentimentAnalysisService = new SentimentAnalysisService();
