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
 * Fetch price for any token from CoinGecko by contract address or symbol
 */
export async function getTokenPrice(assetCodeOrAddress: string): Promise<number | null> {
  try {
    // Check cache first
    const cached = priceCache.get(assetCodeOrAddress);
    if (cached && Date.now() - cached.lastUpdated < CACHE_TTL) {
      console.log(`[PriceService] Using cached ${assetCodeOrAddress} price: $${cached.price.toFixed(4)}`);
      return cached.price;
    }

    // Handle known symbols
    const symbolToCoinGeckoId: Record<string, string> = {
      'XLM': 'stellar',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'DAI': 'dai',
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'AQUA': 'aquarius',
      'yXLM': 'yxlm',
      'native': 'stellar',
      // Add more common Stellar/Soroban tokens as they become available on CoinGecko
      'EURC': 'euro-coin',
      'yUSDC': 'yusd-stablecoin',
      'BLND': 'blend', // if available
    };

    let coinGeckoId = symbolToCoinGeckoId[assetCodeOrAddress.toUpperCase()];

    // If it's a Soroban contract address (starts with C), try to find it on CoinGecko
    // For now, we don't have a reliable way to map Soroban addresses to CoinGecko IDs
    // So we'll return null for unmapped tokens
    if (!coinGeckoId && assetCodeOrAddress.startsWith('C')) {
      console.warn(`[PriceService] No CoinGecko mapping for Soroban token: ${assetCodeOrAddress}`);
      return null;
    }

    // If still no ID found, return null
    if (!coinGeckoId) {
      console.warn(`[PriceService] No CoinGecko ID found for: ${assetCodeOrAddress}`);
      return null;
    }

    // Fetch from CoinGecko
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`
    );

    if (!response.ok) {
      console.error(`[PriceService] CoinGecko API error for ${assetCodeOrAddress}:`, response.status);
      return null;
    }

    const data = await response.json() as any;
    const price = data[coinGeckoId]?.usd || null;

    if (price) {
      // Cache the result
      priceCache.set(assetCodeOrAddress, {
        price,
        lastUpdated: Date.now(),
      });
      console.log(`[PriceService] Fetched ${assetCodeOrAddress} price from CoinGecko: $${price.toFixed(4)}`);
    }

    return price;
  } catch (error) {
    console.error(`[PriceService] Error fetching price for ${assetCodeOrAddress}:`, error);
    return null;
  }
}

/**
 * Get multiple asset prices at once (for future multi-asset support)
 */
export async function getAssetPrices(assets: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  for (const asset of assets) {
    const price = await getTokenPrice(asset);
    if (price !== null) {
      prices[asset] = price;
    } else {
      prices[asset] = 0;
    }
  }
  
  return prices;
}

/**
 * Fetch historical price data from CoinGecko
 * @param assetCodeOrAddress - Asset symbol or contract address
 * @param startTime - Start timestamp in ISO format
 * @param endTime - End timestamp in ISO format
 * @param resolution - Time resolution in milliseconds
 * @returns Array of price points with timestamp and price
 */
export async function getHistoricalPricesFromCoinGecko(
  assetCodeOrAddress: string,
  startTime: string,
  endTime: string,
  resolution: number
): Promise<{ timestamp: string; price: number }[] | null> {
  try {
    // Map symbols to CoinGecko IDs
    const symbolToCoinGeckoId: Record<string, string> = {
      'XLM': 'stellar',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'DAI': 'dai',
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'AQUA': 'aquarius',
      'yXLM': 'yxlm',
      'native': 'stellar',
      'EURC': 'euro-coin',
      'yUSDC': 'yusd-stablecoin',
      'BLND': 'blend',
    };

    const coinGeckoId = symbolToCoinGeckoId[assetCodeOrAddress.toUpperCase()];

    if (!coinGeckoId) {
      console.warn(`[PriceService] No CoinGecko mapping for historical data: ${assetCodeOrAddress}`);
      return null;
    }

    const start = Math.floor(new Date(startTime).getTime() / 1000);
    const end = Math.floor(new Date(endTime).getTime() / 1000);

    // CoinGecko's market_chart/range endpoint
    const url = `https://api.coingecko.com/api/v3/coins/${coinGeckoId}/market_chart/range?vs_currency=usd&from=${start}&to=${end}`;
    
    console.log(`[PriceService] Fetching historical data from CoinGecko for ${assetCodeOrAddress}...`);
    
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[PriceService] CoinGecko historical API error for ${assetCodeOrAddress}:`, response.status);
      return null;
    }

    const data = await response.json() as any;
    
    if (!data.prices || data.prices.length === 0) {
      console.warn(`[PriceService] No historical data available from CoinGecko for ${assetCodeOrAddress}`);
      return null;
    }

    // CoinGecko returns [timestamp_ms, price] pairs
    const prices = data.prices.map(([timestamp, price]: [number, number]) => ({
      timestamp: new Date(timestamp).toISOString(),
      price: price,
    }));

    console.log(`[PriceService] ✓ Fetched ${prices.length} historical price points from CoinGecko for ${assetCodeOrAddress}`);

    // Resample to match requested resolution if needed
    return resamplePrices(prices, resolution);
  } catch (error) {
    console.error(`[PriceService] Error fetching historical prices for ${assetCodeOrAddress}:`, error);
    return null;
  }
}

/**
 * Resample price data to match requested resolution
 */
function resamplePrices(
  prices: { timestamp: string; price: number }[],
  targetResolution: number
): { timestamp: string; price: number }[] {
  if (prices.length === 0) return [];

  const resampled: { timestamp: string; price: number }[] = [];
  const startTime = new Date(prices[0].timestamp).getTime();
  const endTime = new Date(prices[prices.length - 1].timestamp).getTime();
  
  let currentTime = startTime;
  let priceIndex = 0;

  while (currentTime <= endTime) {
    // Find the closest price point
    let closestPrice = prices[priceIndex];
    let closestDiff = Math.abs(new Date(closestPrice.timestamp).getTime() - currentTime);

    for (let i = priceIndex; i < prices.length; i++) {
      const diff = Math.abs(new Date(prices[i].timestamp).getTime() - currentTime);
      if (diff < closestDiff) {
        closestPrice = prices[i];
        closestDiff = diff;
        priceIndex = i;
      } else {
        break; // Prices are sorted, so we can stop
      }
    }

    resampled.push({
      timestamp: new Date(currentTime).toISOString(),
      price: closestPrice.price,
    });

    currentTime += targetResolution;
  }

  return resampled;
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
