// T032: Prophet time-series forecasting client setup
// Purpose: Integrate Prophet for APY forecasting and trend analysis

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

/**
 * Interface for Prophet forecast input data
 */
export interface ProphetDataPoint {
  ds: string; // Date in YYYY-MM-DD format
  y: number; // Value to forecast
}

/**
 * Interface for Prophet forecast output
 */
export interface ProphetForecast {
  ds: string; // Date
  yhat: number; // Predicted value
  yhat_lower: number; // Lower confidence bound
  yhat_upper: number; // Upper confidence bound
  trend: number; // Trend component
}

/**
 * Configuration for Prophet forecasting
 */
export interface ProphetConfig {
  periods?: number; // Number of periods to forecast (default: 30)
  freq?: string; // Frequency of data ('D' for daily, 'H' for hourly, etc.)
  changepoint_prior_scale?: number; // Flexibility of trend (default: 0.05)
  seasonality_prior_scale?: number; // Flexibility of seasonality (default: 10)
  yearly_seasonality?: boolean | number; // Whether to model yearly seasonality
  weekly_seasonality?: boolean | number; // Whether to model weekly seasonality
  daily_seasonality?: boolean | number; // Whether to model daily seasonality
}

/**
 * Run Prophet forecasting using Python subprocess
 * Note: Requires Prophet to be installed in Python environment
 * Install with: pip install prophet
 */
export async function runProphetForecast(
  data: ProphetDataPoint[],
  config: ProphetConfig = {}
): Promise<ProphetForecast[]> {
  // Check if Prophet Python script exists
  const scriptPath = path.join(__dirname, '../../scripts/prophet_forecast.py');
  
  try {
    await fs.access(scriptPath);
  } catch (error) {
    console.warn('Prophet Python script not found. Returning mock forecast data.');
    return generateMockForecast(data, config.periods || 30);
  }

  return new Promise((resolve, reject) => {
    // Prepare input data
    const input = {
      data,
      config: {
        periods: config.periods || 30,
        freq: config.freq || 'D',
        changepoint_prior_scale: config.changepoint_prior_scale || 0.05,
        seasonality_prior_scale: config.seasonality_prior_scale || 10,
        yearly_seasonality: config.yearly_seasonality !== false,
        weekly_seasonality: config.weekly_seasonality !== false,
        daily_seasonality: config.daily_seasonality || false,
      },
    };

    // Spawn Python process
    const pythonProcess = spawn('python', [scriptPath]);

    let outputData = '';
    let errorData = '';

    // Send input data to Python script
    pythonProcess.stdin.write(JSON.stringify(input));
    pythonProcess.stdin.end();

    // Collect output
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Prophet forecasting error:', errorData);
        reject(new Error(`Prophet process exited with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(outputData);
        resolve(result.forecast);
      } catch (error) {
        console.error('Error parsing Prophet output:', error);
        reject(new Error('Failed to parse Prophet forecast output'));
      }
    });
  });
}

/**
 * Generate mock forecast data for testing/fallback
 * This is used when Prophet is not available
 */
function generateMockForecast(
  data: ProphetDataPoint[],
  periods: number
): ProphetForecast[] {
  if (data.length === 0) {
    return [];
  }

  // Calculate simple trend from last few data points
  const recent = data.slice(-10);
  const avgValue = recent.reduce((sum, d) => sum + d.y, 0) / recent.length;
  const trend = recent.length > 1
    ? (recent[recent.length - 1].y - recent[0].y) / recent.length
    : 0;

  // Generate forecast
  const lastDate = new Date(data[data.length - 1].ds);
  const forecasts: ProphetForecast[] = [];

  for (let i = 1; i <= periods; i++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setDate(forecastDate.getDate() + i);

    const predictedValue = avgValue + trend * i;
    const uncertainty = Math.abs(predictedValue * 0.1); // 10% uncertainty

    forecasts.push({
      ds: forecastDate.toISOString().split('T')[0],
      yhat: predictedValue,
      yhat_lower: predictedValue - uncertainty,
      yhat_upper: predictedValue + uncertainty,
      trend: predictedValue,
    });
  }

  return forecasts;
}

/**
 * Forecast APY trends for a vault strategy
 */
export async function forecastAPY(
  historicalAPY: { date: string; apy: number }[],
  forecastDays: number = 30
): Promise<ProphetForecast[]> {
  const data: ProphetDataPoint[] = historicalAPY.map((point) => ({
    ds: point.date,
    y: point.apy,
  }));

  return runProphetForecast(data, {
    periods: forecastDays,
    freq: 'D',
    yearly_seasonality: false,
    weekly_seasonality: true,
    daily_seasonality: false,
  });
}

/**
 * Analyze trend strength and direction
 */
export function analyzeTrend(forecast: ProphetForecast[]): {
  direction: 'up' | 'down' | 'stable';
  strength: number; // 0-1
  confidence: number; // 0-1
} {
  if (forecast.length < 2) {
    return { direction: 'stable', strength: 0, confidence: 0 };
  }

  const first = forecast[0];
  const last = forecast[forecast.length - 1];

  const change = last.yhat - first.yhat;
  const avgValue = forecast.reduce((sum, f) => sum + f.yhat, 0) / forecast.length;
  const relativeChange = Math.abs(change / avgValue);

  // Calculate average confidence interval width
  const avgUncertainty =
    forecast.reduce((sum, f) => sum + (f.yhat_upper - f.yhat_lower), 0) /
    forecast.length;
  const confidence = 1 - Math.min(avgUncertainty / avgValue, 1);

  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (relativeChange > 0.05) {
    // More than 5% change
    direction = change > 0 ? 'up' : 'down';
  }

  return {
    direction,
    strength: Math.min(relativeChange * 2, 1), // Scale to 0-1
    confidence,
  };
}
