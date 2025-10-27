/**
 * Sentiment Indicator Component (T120)
 * Displays sentiment indicators for assets in the vault builder
 */

import { useState, useEffect } from 'react';
import styles from './SentimentIndicator.module.css';

interface SentimentData {
  sentiment: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  totalPosts: number;
}

interface SentimentIndicatorProps {
  assetCode: string;
  assetName?: string;
  compact?: boolean;
}

export function SentimentIndicator({ assetCode, assetName, compact = false }: SentimentIndicatorProps) {
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSentiment();
  }, [assetCode]);

  const fetchSentiment = async () => {
    setLoading(true);
    setError(null);

    try {
      // In production, this would call the backend sentiment API
      // For now, we'll simulate sentiment data
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock sentiment data
      const mockSentiments: SentimentData[] = [
        { sentiment: 'very_positive', score: 0.8, confidence: 0.85, totalPosts: 245 },
        { sentiment: 'positive', score: 0.4, confidence: 0.75, totalPosts: 189 },
        { sentiment: 'neutral', score: 0.05, confidence: 0.65, totalPosts: 156 },
        { sentiment: 'negative', score: -0.3, confidence: 0.70, totalPosts: 134 },
        { sentiment: 'very_negative', score: -0.7, confidence: 0.80, totalPosts: 98 },
      ];

      const randomSentiment = mockSentiments[Math.floor(Math.random() * mockSentiments.length)];
      setSentiment(randomSentiment);
    } catch (err) {
      console.error('Error fetching sentiment:', err);
      setError('Failed to load sentiment');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (sentiment: SentimentData['sentiment']): string => {
    switch (sentiment) {
      case 'very_positive':
        return styles.veryPositive;
      case 'positive':
        return styles.positive;
      case 'neutral':
        return styles.neutral;
      case 'negative':
        return styles.negative;
      case 'very_negative':
        return styles.veryNegative;
      default:
        return styles.neutral;
    }
  };

  const getSentimentEmoji = (sentiment: SentimentData['sentiment']): string => {
    switch (sentiment) {
      case 'very_positive':
        return '🚀';
      case 'positive':
        return '😊';
      case 'neutral':
        return '😐';
      case 'negative':
        return '😟';
      case 'very_negative':
        return '😱';
      default:
        return '😐';
    }
  };

  const getSentimentLabel = (sentiment: SentimentData['sentiment']): string => {
    return sentiment.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          {!compact && <span>Loading...</span>}
        </div>
      </div>
    );
  }

  if (error || !sentiment) {
    return (
      <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
        <div className={styles.error}>
          <span>N/A</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`${styles.container} ${styles.compact}`} title={`${getSentimentLabel(sentiment.sentiment)} sentiment for ${assetName || assetCode}`}>
        <div className={`${styles.compactIndicator} ${getSentimentColor(sentiment.sentiment)}`}>
          <span className={styles.emoji}>{getSentimentEmoji(sentiment.sentiment)}</span>
          <span className={styles.compactLabel}>
            {getSentimentLabel(sentiment.sentiment)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>
          {assetName || assetCode} Sentiment
        </h4>
        <button className={styles.refreshButton} onClick={fetchSentiment} title="Refresh sentiment">
          ↻
        </button>
      </div>

      <div className={`${styles.sentimentBadge} ${getSentimentColor(sentiment.sentiment)}`}>
        <span className={styles.emoji}>{getSentimentEmoji(sentiment.sentiment)}</span>
        <span className={styles.sentimentLabel}>
          {getSentimentLabel(sentiment.sentiment)}
        </span>
      </div>

      <div className={styles.scoreBar}>
        <div className={styles.scoreBarTrack}>
          <div
            className={`${styles.scoreBarFill} ${getSentimentColor(sentiment.sentiment)}`}
            style={{ width: `${((sentiment.score + 1) / 2) * 100}%` }}
          />
        </div>
        <div className={styles.scoreLabels}>
          <span>Negative</span>
          <span>Neutral</span>
          <span>Positive</span>
        </div>
      </div>

      <div className={styles.metadata}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Confidence</span>
          <span className={styles.metaValue}>{Math.round(sentiment.confidence * 100)}%</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Data Points</span>
          <span className={styles.metaValue}>{sentiment.totalPosts}</span>
        </div>
      </div>
    </div>
  );
}
