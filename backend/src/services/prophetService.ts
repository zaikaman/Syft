// T097: Prophet integration for APY trend forecasting in backtest scenarios
// Purpose: Use Prophet time-series forecasting to predict APY trends

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const execAsync = promisify(exec);

export interface ProphetForecastRequest {
  historicalData: { timestamp: string; value: number }[];
  periodsToForecast: number; // Number of future periods
  frequency: 'D' | 'H' | 'W' | 'M'; // Daily, Hourly, Weekly, Monthly
}

export interface ProphetForecastResult {
  forecast: { timestamp: string; predicted: number; lower: number; upper: number }[];
  trend: 'up' | 'down' | 'flat';
  confidence: number; // 0-100
}

/**
 * Generate APY forecast using Prophet
 * Calls Python Prophet script for time-series forecasting
 */
export async function forecastAPY(
  request: ProphetForecastRequest
): Promise<ProphetForecastResult> {
  const { historicalData, periodsToForecast, frequency } = request;

  if (historicalData.length < 10) {
    throw new Error('Insufficient historical data for forecasting (minimum 10 data points)');
  }

  try {
    // Create temporary files for data exchange
    const tempId = crypto.randomBytes(16).toString('hex');
    const inputFile = path.join(__dirname, `../../temp/prophet_input_${tempId}.json`);
    const outputFile = path.join(__dirname, `../../temp/prophet_output_${tempId}.json`);

    // Ensure temp directory exists
    await fs.mkdir(path.join(__dirname, '../../temp'), { recursive: true });

    // Write input data
    await fs.writeFile(
      inputFile,
      JSON.stringify({
        data: historicalData,
        periods: periodsToForecast,
        frequency,
      })
    );

    // Call Prophet Python script
    const scriptPath = path.join(__dirname, '../../scripts/prophet_forecast.py');
    const command = `python ${scriptPath} ${inputFile} ${outputFile}`;

    await execAsync(command, { timeout: 30000 }); // 30 second timeout

    // Read forecast results
    const outputData = await fs.readFile(outputFile, 'utf-8');
    const result = JSON.parse(outputData);

    // Cleanup temp files
    await fs.unlink(inputFile).catch(() => {});
    await fs.unlink(outputFile).catch(() => {});

    // Analyze trend
    const firstValue = result.forecast[0].predicted;
    const lastValue = result.forecast[result.forecast.length - 1].predicted;
    const change = ((lastValue - firstValue) / firstValue) * 100;

    let trend: 'up' | 'down' | 'flat';
    if (change > 2) trend = 'up';
    else if (change < -2) trend = 'down';
    else trend = 'flat';

    // Calculate confidence based on prediction intervals
    const avgRange =
      result.forecast.reduce((sum: number, f: any) => sum + (f.upper - f.lower), 0) /
      result.forecast.length;
    const confidence = Math.max(0, Math.min(100, 100 - avgRange * 10));

    return {
      forecast: result.forecast,
      trend,
      confidence,
    };
  } catch (error: any) {
    // Fallback to simple linear regression if Prophet fails
    console.warn('Prophet forecasting failed, using fallback linear regression:', error.message);
    return fallbackLinearForecast(historicalData, periodsToForecast);
  }
}

/**
 * Fallback simple linear regression forecast
 */
function fallbackLinearForecast(
  historicalData: { timestamp: string; value: number }[],
  periodsToForecast: number
): ProphetForecastResult {
  // Calculate simple linear trend
  const n = historicalData.length;
  const xValues = Array.from({ length: n }, (_, i) => i);
  const yValues = historicalData.map((d) => d.value);

  // Calculate slope and intercept
  const xMean = xValues.reduce((a, b) => a + b, 0) / n;
  const yMean = yValues.reduce((a, b) => a + b, 0) / n;

  const numerator = xValues.reduce((sum, x, i) => sum + (x - xMean) * (yValues[i] - yMean), 0);
  const denominator = xValues.reduce((sum, x) => sum + Math.pow(x - xMean, 2), 0);

  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;

  // Generate forecast
  const forecast: { timestamp: string; predicted: number; lower: number; upper: number }[] = [];
  const lastTimestamp = new Date(historicalData[historicalData.length - 1].timestamp);

  for (let i = 1; i <= periodsToForecast; i++) {
    const predicted = slope * (n + i) + intercept;
    const forecastTime = new Date(lastTimestamp.getTime() + i * 24 * 60 * 60 * 1000);

    // Simple confidence intervals (±10%)
    forecast.push({
      timestamp: forecastTime.toISOString(),
      predicted: Math.max(0, predicted),
      lower: Math.max(0, predicted * 0.9),
      upper: predicted * 1.1,
    });
  }

  // Determine trend
  let trend: 'up' | 'down' | 'flat';
  if (slope > 0.1) trend = 'up';
  else if (slope < -0.1) trend = 'down';
  else trend = 'flat';

  return {
    forecast,
    trend,
    confidence: 60, // Lower confidence for fallback method
  };
}

/**
 * Forecast asset price trends (wrapper for forecastAPY with different semantics)
 */
export async function forecastPriceTrend(
  historicalPrices: { timestamp: string; price: number }[],
  periodsToForecast: number = 7,
  frequency: 'D' | 'H' | 'W' | 'M' = 'D'
): Promise<ProphetForecastResult> {
  const data = historicalPrices.map((p) => ({
    timestamp: p.timestamp,
    value: p.price,
  }));

  return forecastAPY({ historicalData: data, periodsToForecast, frequency });
}

export default {
  forecastAPY,
  forecastPriceTrend,
};
