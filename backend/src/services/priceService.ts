/**
 * Price Service - Fetch real-time cryptocurrency prices
 */

interface PriceData {
  price: number;
  lastUpdated: number;
}

// In-memory cache for prices
const priceCache = new Map<string, PriceData>();
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Fetch XLM price from CoinGecko API
 */
async function fetchXLMPriceFromCoinGecko(): Promise<number | null> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd'
    );

    if (!response.ok) {
      console.error('[PriceService] CoinGecko API error:', response.status);
      return null;
    }

    const data = await response.json() as any;
    return data.stellar?.usd || null;
  } catch (error) {
    console.error('[PriceService] Error fetching from CoinGecko:', error);
    return null;
  }
}

/**
 * Fetch XLM price from CoinMarketCap API (backup)
 */
async function fetchXLMPriceFromCoinMarketCap(): Promise<number | null> {
  try {
    const apiKey = process.env.COINMARKETCAP_API_KEY;
    if (!apiKey) {
      return null;
    }

    const response = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=XLM',
      {
        headers: {
          'X-CMC_PRO_API_KEY': apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error('[PriceService] CoinMarketCap API error:', response.status);
      return null;
    }

    const data = await response.json() as any;
    return data.data?.XLM?.quote?.USD?.price || null;
  } catch (error) {
    console.error('[PriceService] Error fetching from CoinMarketCap:', error);
    return null;
  }
}

/**
 * Fetch XLM price from Binance API (backup)
 */
async function fetchXLMPriceFromBinance(): Promise<number | null> {
  try {
    // Try XLMUSDT pair
    const response = await fetch(
      'https://api.binance.com/api/v3/ticker/price?symbol=XLMUSDT'
    );

    if (!response.ok) {
      console.error('[PriceService] Binance API error:', response.status);
      return null;
    }

    const data = await response.json() as any;
    return parseFloat(data.price) || null;
  } catch (error) {
    console.error('[PriceService] Error fetching from Binance:', error);
    return null;
  }
}

/**
 * Fetch XLM price from Kraken API (backup)
 */
async function fetchXLMPriceFromKraken(): Promise<number | null> {
  try {
    const response = await fetch(
      'https://api.kraken.com/0/public/Ticker?pair=XLMUSD'
    );

    if (!response.ok) {
      console.error('[PriceService] Kraken API error:', response.status);
      return null;
    }

    const data = await response.json() as any;
    const xlmUsdData = data.result?.XXLMZUSD;
    if (xlmUsdData && xlmUsdData.c && xlmUsdData.c.length > 0) {
      return parseFloat(xlmUsdData.c[0]);
    }
    return null;
  } catch (error) {
    console.error('[PriceService] Error fetching from Kraken:', error);
    return null;
  }
}

/**
 * Get XLM price with fallback chain and caching
 */
export async function getXLMPrice(): Promise<number> {
  // Check cache first
  const cached = priceCache.get('XLM');
  if (cached && Date.now() - cached.lastUpdated < CACHE_TTL) {
    console.log(`[PriceService] Using cached XLM price: $${cached.price.toFixed(4)}`);
    return cached.price;
  }

  // Try multiple sources in order
  const sources = [
    { name: 'CoinGecko', fetch: fetchXLMPriceFromCoinGecko },
    { name: 'Binance', fetch: fetchXLMPriceFromBinance },
    { name: 'Kraken', fetch: fetchXLMPriceFromKraken },
    { name: 'CoinMarketCap', fetch: fetchXLMPriceFromCoinMarketCap },
  ];

  for (const source of sources) {
    const price = await source.fetch();
    if (price && price > 0) {
      console.log(`[PriceService] Fetched XLM price from ${source.name}: $${price.toFixed(4)}`);
      
      // Cache the result
      priceCache.set('XLM', {
        price,
        lastUpdated: Date.now(),
      });
      
      return price;
    }
  }

  // Fallback to cached price even if expired
  if (cached) {
    const ageMinutes = Math.floor((Date.now() - cached.lastUpdated) / 60000);
    console.warn(`[PriceService] Using stale cached price (${ageMinutes} minutes old): $${cached.price.toFixed(4)}`);
    return cached.price;
  }

  // Last resort: use a conservative estimate
  console.error('[PriceService] All price sources failed, using fallback estimate');
  return 0.10; // Conservative fallback
}

/**
 * Convert stroops to USD
 */
export async function stroopsToUSD(stroops: string | number): Promise<number> {
  const stroopsNum = typeof stroops === 'string' ? parseFloat(stroops) : stroops;
  const xlmAmount = stroopsNum / 10_000_000;
  const xlmPrice = await getXLMPrice();
  return xlmAmount * xlmPrice;
}

/**
 * Convert XLM to USD
 */
export async function xlmToUSD(xlm: string | number): Promise<number> {
  const xlmNum = typeof xlm === 'string' ? parseFloat(xlm) : xlm;
  const xlmPrice = await getXLMPrice();
  return xlmNum * xlmPrice;
}

/**
 * Get multiple asset prices at once (for future multi-asset support)
 */
export async function getAssetPrices(assets: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  // For now, only support XLM
  // In the future, extend this to support other Stellar assets
  for (const asset of assets) {
    if (asset === 'XLM' || asset === 'native') {
      prices[asset] = await getXLMPrice();
    } else {
      // For other assets, would need to implement proper price feeds
      prices[asset] = 0;
    }
  }
  
  return prices;
}

/**
 * Clear price cache (useful for testing)
 */
export function clearPriceCache(): void {
  priceCache.clear();
  console.log('[PriceService] Price cache cleared');
}

/**
 * Get cache status
 */
export function getPriceCacheStatus(): {
  assets: string[];
  oldestAge: number;
} {
  const entries = Array.from(priceCache.entries());
  const now = Date.now();
  
  return {
    assets: entries.map(([asset]) => asset),
    oldestAge: entries.length > 0 
      ? Math.max(...entries.map(([_, data]) => now - data.lastUpdated))
      : 0,
  };
}
