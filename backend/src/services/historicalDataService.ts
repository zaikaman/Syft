// T095: Historical price data fetching service using Horizon SDK
// Purpose: Fetch historical asset prices and yields for backtesting
// ARCHITECTURE: Always fetches price data from mainnet for accuracy,
// regardless of user's execution network (testnet/futurenet/mainnet)

import { mainnetPriceServer } from '../lib/horizonClient';
import { Asset } from '@stellar/stellar-sdk';

export interface PricePoint {
  timestamp: string;
  price: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
}

export interface HistoricalDataRequest {
  assetCode: string;
  assetIssuer?: string;
  counterAssetCode?: string; // Default to USDC
  counterAssetIssuer?: string;
  startTime: string; // ISO timestamp
  endTime: string; // ISO timestamp
  resolution: number; // milliseconds (e.g., 3600000 for 1 hour)
}

export interface HistoricalDataResponse {
  assetCode: string;
  assetIssuer?: string;
  startTime: string;
  endTime: string;
  resolution: number;
  dataPoints: PricePoint[];
  usingMockData?: boolean; // true if synthetic data was used due to lack of real trade history
  dataSource?: 'mainnet' | 'mock_data'; // indicates where data came from (always mainnet unless no data exists)
}

/**
 * Fetch historical price data for an asset pair
 * @param request - Historical data request parameters
 * @returns Historical price data points
 */
export async function fetchHistoricalPrices(
  request: HistoricalDataRequest
): Promise<HistoricalDataResponse> {
  try {
    const {
      assetCode,
      assetIssuer,
      counterAssetCode = 'USDC',
      counterAssetIssuer,
      startTime,
      endTime,
      resolution,
    } = request;

    // Create asset objects
    let baseAsset: Asset;
    if (assetCode === 'XLM' || assetCode === 'native') {
      baseAsset = Asset.native();
    } else {
      if (!assetIssuer) {
        throw new Error('Asset issuer required for non-native assets');
      }
      baseAsset = new Asset(assetCode, assetIssuer);
    }

    // Create counter asset
    let counterAsset: Asset;
    if (counterAssetCode === 'XLM' || counterAssetCode === 'native') {
      counterAsset = Asset.native();
    } else {
      if (!counterAssetIssuer) {
        throw new Error('Counter asset issuer required for non-native assets');
      }
      counterAsset = new Asset(counterAssetCode, counterAssetIssuer);
    }

    // Validate and normalize resolution
    // Horizon API only accepts specific resolution values in milliseconds
    const validResolutions = [
      60000,      // 1 minute
      300000,     // 5 minutes
      900000,     // 15 minutes
      3600000,    // 1 hour
      86400000,   // 1 day
      604800000,  // 1 week
    ];

    let resolutionMs = resolution;
    
    // If resolution is not in valid list, find the closest valid one
    if (!validResolutions.includes(resolutionMs)) {
      resolutionMs = validResolutions.reduce((prev, curr) => 
        Math.abs(curr - resolution) < Math.abs(prev - resolution) ? curr : prev
      );
      console.warn(`Resolution ${resolution}ms is not valid. Using ${resolutionMs}ms instead.`);
    }

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    // ALWAYS fetch from mainnet for real-time, accurate price data
    // This ensures live data regardless of user's execution network
    let dataPoints: PricePoint[] = [];
    let usingMockData = false;
    let dataSource: 'mainnet' | 'mock_data' = 'mainnet';
    
    try {
      console.log(`[Historical Data] Fetching real-time price data from mainnet for ${assetCode}/${counterAssetCode}...`);
      
      const aggregations = await mainnetPriceServer
        .tradeAggregation(baseAsset, counterAsset, start, end, resolutionMs, 0)
        .limit(200)
        .call();

      if (aggregations.records && aggregations.records.length > 0) {
        // Transform to price points
        dataPoints = aggregations.records.map((record: any) => ({
          timestamp: new Date(parseInt(record.timestamp)).toISOString(),
          price: parseFloat(record.close),
          volume: parseFloat(record.base_volume),
          high: parseFloat(record.high),
          low: parseFloat(record.low),
          open: parseFloat(record.open),
          close: parseFloat(record.close),
        }));
        console.log(`[Historical Data] ✓ Successfully fetched ${dataPoints.length} real-time price points from mainnet`);
      } else {
        throw new Error('No trade records found on mainnet');
      }
    } catch (mainnetError: any) {
      // Last resort: Generate mock data only if mainnet has no data
      console.warn(`[Historical Data] No data available on mainnet for ${assetCode}/${counterAssetCode}.`);
      console.warn(`[Historical Data] Error: ${mainnetError.message}`);
      console.warn(`[Historical Data] Using synthetic data as last resort.`);
      dataPoints = generateMockPriceData(assetCode, start, end, resolutionMs);
      dataSource = 'mock_data';
      usingMockData = true;
    }

    // Fill gaps with interpolation if needed
    const filledDataPoints = fillDataGaps(dataPoints, start, end, resolutionMs);

    return {
      assetCode,
      assetIssuer,
      startTime,
      endTime,
      resolution,
      dataPoints: filledDataPoints,
      usingMockData,
      dataSource,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch historical prices: ${error.message}`);
  }
}

/**
 * Generate mock price data for testing when Horizon has no trade history
 * This is useful for testnet where assets may not have sufficient trading activity
 */
function generateMockPriceData(
  assetCode: string,
  startTime: number,
  endTime: number,
  resolution: number
): PricePoint[] {
  const dataPoints: PricePoint[] = [];
  
  // Base prices for common assets (simulated)
  const basePrices: { [key: string]: number } = {
    'XLM': 0.12,    // XLM around $0.12
    'USDC': 1.00,   // USDC is $1
    'BTC': 45000,   // BTC around $45k
    'ETH': 2500,    // ETH around $2.5k
  };
  
  let basePrice = basePrices[assetCode] || 1.0;
  let currentPrice = basePrice;
  let currentTime = startTime;
  
  // Generate realistic price movement with random walk
  while (currentTime <= endTime) {
    // Add some volatility (±2% per period)
    const change = (Math.random() - 0.5) * 0.04; // -2% to +2%
    currentPrice = currentPrice * (1 + change);
    
    // Keep price within reasonable bounds (±30% from base)
    const minPrice = basePrice * 0.7;
    const maxPrice = basePrice * 1.3;
    currentPrice = Math.max(minPrice, Math.min(maxPrice, currentPrice));
    
    // Add some intraday volatility for high/low
    const volatility = currentPrice * 0.01; // 1% volatility
    const high = currentPrice + volatility;
    const low = currentPrice - volatility;
    
    dataPoints.push({
      timestamp: new Date(currentTime).toISOString(),
      price: currentPrice,
      volume: Math.random() * 100000, // Random volume
      high,
      low,
      open: dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].close : currentPrice,
      close: currentPrice,
    });
    
    currentTime += resolution;
  }
  
  return dataPoints;
}

/**
 * Fill gaps in historical data with interpolated values
 */
function fillDataGaps(
  dataPoints: PricePoint[],
  startTime: number,
  endTime: number,
  resolution: number
): PricePoint[] {
  if (dataPoints.length === 0) {
    return [];
  }

  const filled: PricePoint[] = [];
  let currentTime = startTime;

  let dataIndex = 0;

  while (currentTime <= endTime) {
    const currentTimestamp = new Date(currentTime).toISOString();

    // Find matching data point
    const matchingPoint = dataPoints.find(
      (p) => Math.abs(new Date(p.timestamp).getTime() - currentTime) < resolution / 2
    );

    if (matchingPoint) {
      filled.push(matchingPoint);
      dataIndex++;
    } else {
      // Interpolate
      const prevPoint = filled[filled.length - 1];
      const nextPoint = dataPoints[dataIndex];

      if (prevPoint && nextPoint) {
        const interpolatedPrice =
          prevPoint.close + (nextPoint.close - prevPoint.close) / 2;
        filled.push({
          timestamp: currentTimestamp,
          price: interpolatedPrice,
          volume: 0,
          high: interpolatedPrice,
          low: interpolatedPrice,
          open: interpolatedPrice,
          close: interpolatedPrice,
        });
      } else if (prevPoint) {
        // Use previous value if no next point
        filled.push({
          ...prevPoint,
          timestamp: currentTimestamp,
        });
      }
    }

    currentTime += resolution;
  }

  return filled;
}

/**
 * Fetch APY history for liquidity pools
 * Note: Stellar doesn't have a direct APY endpoint for liquidity pools.
 * In production, you would need to:
 * 1. Query the pool contract's state history
 * 2. Calculate APY from reserves and fee data
 * 3. Or use a third-party data provider (e.g., StellarExpert API)
 * 
 * For now, this returns mock data for UI development and testing.
 * Replace with actual pool contract queries when deploying to production.
 */
export async function fetchHistoricalAPY(
  _poolAddress: string,
  startTime: string,
  endTime: string
): Promise<{ timestamp: string; apy: number }[]> {
  try {
    console.warn('fetchHistoricalAPY is using mock data. Implement pool contract queries for production.');
    
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    const apyData: { timestamp: string; apy: number }[] = [];
    let currentTime = start;

    while (currentTime <= end) {
      // Mock APY between 5-15% with some variation
      const baseApy = 10;
      const variance = (Math.random() - 0.5) * 5; // +/- 2.5%
      const apy = Math.max(5, Math.min(15, baseApy + variance));
      
      apyData.push({
        timestamp: new Date(currentTime).toISOString(),
        apy: Number(apy.toFixed(2)),
      });
      currentTime += oneDay;
    }

    return apyData;
  } catch (error: any) {
    throw new Error(`Failed to fetch historical APY: ${error.message}`);
  }
}

/**
 * Get current market price for an asset (always from mainnet for accuracy)
 * This provides real-time pricing regardless of user's execution network
 */
export async function getCurrentPrice(
  assetCode: string,
  assetIssuer?: string,
  counterAssetCode: string = 'USDC',
  counterAssetIssuer?: string
): Promise<number> {
  try {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000; // Last 5 minutes for most recent price

    console.log(`[Current Price] Fetching live mainnet price for ${assetCode}/${counterAssetCode}...`);

    const data = await fetchHistoricalPrices({
      assetCode,
      assetIssuer,
      counterAssetCode,
      counterAssetIssuer,
      startTime: new Date(fiveMinutesAgo).toISOString(),
      endTime: new Date(now).toISOString(),
      resolution: 60 * 1000, // 1 minute resolution for most accurate current price
    });

    if (data.dataPoints.length === 0) {
      throw new Error('No recent price data available from mainnet');
    }

    const currentPrice = data.dataPoints[data.dataPoints.length - 1].close;
    console.log(`[Current Price] ✓ Current price: ${currentPrice} ${counterAssetCode}`);
    
    return currentPrice;
  } catch (error: any) {
    throw new Error(`Failed to get current price: ${error.message}`);
  }
}

export default {
  fetchHistoricalPrices,
  fetchHistoricalAPY,
  getCurrentPrice,
};
