// T095: Historical price data fetching service using Horizon SDK
// Purpose: Fetch historical asset prices and yields for backtesting

import { horizonServer } from '../lib/horizonClient';
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

    // Calculate resolution in milliseconds
    const resolutionMs = resolution;
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    // Fetch trade aggregations from Horizon
    const aggregations = await horizonServer
      .tradeAggregation(baseAsset, counterAsset, start, end, resolutionMs)
      .limit(200)
      .call();

    // Transform to price points
    const dataPoints: PricePoint[] = aggregations.records.map((record: any) => ({
      timestamp: new Date(parseInt(record.timestamp)).toISOString(),
      price: parseFloat(record.close),
      volume: parseFloat(record.base_volume),
      high: parseFloat(record.high),
      low: parseFloat(record.low),
      open: parseFloat(record.open),
      close: parseFloat(record.close),
    }));

    // Fill gaps with interpolation if needed
    const filledDataPoints = fillDataGaps(dataPoints, start, end, resolutionMs);

    return {
      assetCode,
      assetIssuer,
      startTime,
      endTime,
      resolution,
      dataPoints: filledDataPoints,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch historical prices: ${error.message}`);
  }
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
 * Note: This is a placeholder - actual implementation would query pool contracts
 */
export async function fetchHistoricalAPY(
  _poolAddress: string,
  startTime: string,
  endTime: string
): Promise<{ timestamp: string; apy: number }[]> {
  try {
    // TODO: Implement actual pool APY fetching from Soroban contracts
    // For now, return mock data for testing
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    const apyData: { timestamp: string; apy: number }[] = [];
    let currentTime = start;

    while (currentTime <= end) {
      // Mock APY between 5-15%
      const apy = 5 + Math.random() * 10;
      apyData.push({
        timestamp: new Date(currentTime).toISOString(),
        apy,
      });
      currentTime += oneDay;
    }

    return apyData;
  } catch (error: any) {
    throw new Error(`Failed to fetch historical APY: ${error.message}`);
  }
}

/**
 * Get current market price for an asset
 */
export async function getCurrentPrice(
  assetCode: string,
  assetIssuer?: string,
  counterAssetCode: string = 'USDC',
  counterAssetIssuer?: string
): Promise<number> {
  try {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const data = await fetchHistoricalPrices({
      assetCode,
      assetIssuer,
      counterAssetCode,
      counterAssetIssuer,
      startTime: new Date(oneHourAgo).toISOString(),
      endTime: new Date(now).toISOString(),
      resolution: 60 * 60 * 1000, // 1 hour
    });

    if (data.dataPoints.length === 0) {
      throw new Error('No recent price data available');
    }

    return data.dataPoints[data.dataPoints.length - 1].close;
  } catch (error: any) {
    throw new Error(`Failed to get current price: ${error.message}`);
  }
}

export default {
  fetchHistoricalPrices,
  fetchHistoricalAPY,
  getCurrentPrice,
};
