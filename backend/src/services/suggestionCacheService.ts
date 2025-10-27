/**
 * Suggestion Cache Service (T116)
 * Caches AI suggestions to reduce API costs and improve response times
 */

import { Suggestion } from './suggestionGenerator';

interface CacheEntry {
  suggestions: Suggestion[];
  createdAt: number;
  expiresAt: number;
}

export class SuggestionCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
  private readonly MAX_CACHE_SIZE = 100;

  /**
   * Get cached suggestions for a vault
   */
  get(vaultId: string): Suggestion[] | null {
    const entry = this.cache.get(vaultId);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(vaultId);
      return null;
    }

    return entry.suggestions;
  }

  /**
   * Cache suggestions for a vault
   */
  set(vaultId: string, suggestions: Suggestion[], ttl?: number): void {
    // Enforce cache size limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    const now = Date.now();
    const entry: CacheEntry = {
      suggestions,
      createdAt: now,
      expiresAt: now + (ttl || this.DEFAULT_TTL),
    };

    this.cache.set(vaultId, entry);
  }

  /**
   * Invalidate cache for a specific vault
   */
  invalidate(vaultId: string): void {
    this.cache.delete(vaultId);
  }

  /**
   * Clear all cached suggestions
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    entries: Array<{ vaultId: string; createdAt: Date; expiresAt: Date }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([vaultId, entry]) => ({
      vaultId,
      createdAt: new Date(entry.createdAt),
      expiresAt: new Date(entry.expiresAt),
    }));

    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      entries,
    };
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const suggestionCacheService = new SuggestionCacheService();

// Run cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    suggestionCacheService.cleanup();
  }, 10 * 60 * 1000);
}
