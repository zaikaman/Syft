// T098: Performance metrics calculator
// Purpose: Calculate returns, volatility, drawdown, and other performance metrics

export interface PerformanceData {
  timestamp: string;
  value: number;
}

export interface PerformanceMetrics {
  totalReturn: number; // percentage
  totalReturnAmount: number;
  annualizedReturn: number; // percentage
  volatility: number; // annualized standard deviation
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number; // percentage
  maxDrawdownAmount: number;
  maxDrawdownDuration: number; // days
  winRate: number; // percentage
  profitFactor: number;
  calmarRatio: number;
  avgReturn: number;
  avgWin: number;
  avgLoss: number;
  bestDay: number;
  worstDay: number;
}

/**
 * Calculate comprehensive performance metrics
 */
export function calculatePerformanceMetrics(
  data: PerformanceData[],
  initialValue: number,
  riskFreeRate: number = 0 // Annual risk-free rate (e.g., 0.02 for 2%)
): PerformanceMetrics {
  if (data.length === 0) {
    throw new Error('No performance data provided');
  }

  const finalValue = data[data.length - 1].value;
  const totalReturnAmount = finalValue - initialValue;
  const totalReturn = (totalReturnAmount / initialValue) * 100;

  // Calculate time period
  const startTime = new Date(data[0].timestamp).getTime();
  const endTime = new Date(data[data.length - 1].timestamp).getTime();
  const daysElapsed = (endTime - startTime) / (24 * 60 * 60 * 1000);
  const yearsElapsed = daysElapsed / 365;

  // Annualized return
  const annualizedReturn =
    yearsElapsed > 0
      ? (Math.pow(finalValue / initialValue, 1 / yearsElapsed) - 1) * 100
      : totalReturn;

  // Calculate daily returns
  const dailyReturns: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const prevValue = data[i - 1].value;
    const currentValue = data[i].value;
    if (prevValue > 0) {
      const dailyReturn = (currentValue - prevValue) / prevValue;
      dailyReturns.push(dailyReturn);
    }
  }

  // Volatility (annualized standard deviation of returns)
  const volatility = calculateStandardDeviation(dailyReturns) * Math.sqrt(252) * 100;

  // Sharpe Ratio: (Return - Risk-free rate) / Volatility
  const excessReturn = annualizedReturn - riskFreeRate * 100;
  const sharpeRatio = volatility > 0 ? excessReturn / volatility : 0;

  // Sortino Ratio: (Return - Risk-free rate) / Downside Deviation
  const downsideReturns = dailyReturns.filter((r) => r < 0);
  const downsideDeviation = calculateStandardDeviation(downsideReturns) * Math.sqrt(252) * 100;
  const sortinoRatio = downsideDeviation > 0 ? excessReturn / downsideDeviation : 0;

  // Max Drawdown
  const { maxDrawdown, maxDrawdownAmount, maxDrawdownDuration } = calculateMaxDrawdown(data);

  // Win Rate
  const wins = dailyReturns.filter((r) => r > 0).length;
  const losses = dailyReturns.filter((r) => r < 0).length;
  const winRate = dailyReturns.length > 0 ? (wins / dailyReturns.length) * 100 : 0;

  // Profit Factor
  const totalWins = dailyReturns.filter((r) => r > 0).reduce((sum, r) => sum + r, 0);
  const totalLosses = Math.abs(dailyReturns.filter((r) => r < 0).reduce((sum, r) => sum + r, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

  // Calmar Ratio: Annualized Return / Max Drawdown
  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

  // Average returns
  const avgReturn =
    dailyReturns.length > 0
      ? (dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length) * 100
      : 0;

  const avgWin = wins > 0 ? (totalWins / wins) * 100 : 0;
  const avgLoss = losses > 0 ? (totalLosses / losses) * 100 : 0;

  // Best and worst days
  const bestDay = dailyReturns.length > 0 ? Math.max(...dailyReturns) * 100 : 0;
  const worstDay = dailyReturns.length > 0 ? Math.min(...dailyReturns) * 100 : 0;

  return {
    totalReturn,
    totalReturnAmount,
    annualizedReturn,
    volatility,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    maxDrawdownAmount,
    maxDrawdownDuration,
    winRate,
    profitFactor,
    calmarRatio,
    avgReturn,
    avgWin,
    avgLoss,
    bestDay,
    worstDay,
  };
}

/**
 * Calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Calculate maximum drawdown
 */
function calculateMaxDrawdown(data: PerformanceData[]): {
  maxDrawdown: number;
  maxDrawdownAmount: number;
  maxDrawdownDuration: number;
} {
  let maxValue = data[0].value;
  let maxDrawdown = 0;
  let maxDrawdownAmount = 0;
  let drawdownStart = 0;
  let maxDrawdownDuration = 0;
  let currentDrawdownStart = 0;

  for (let i = 0; i < data.length; i++) {
    const currentValue = data[i].value;

    if (currentValue > maxValue) {
      maxValue = currentValue;
      currentDrawdownStart = i;
    } else {
      const drawdown = (maxValue - currentValue) / maxValue;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownAmount = maxValue - currentValue;
        drawdownStart = currentDrawdownStart;

        // Calculate duration in days
        const startTime = new Date(data[drawdownStart].timestamp).getTime();
        const endTime = new Date(data[i].timestamp).getTime();
        maxDrawdownDuration = (endTime - startTime) / (24 * 60 * 60 * 1000);
      }
    }
  }

  return {
    maxDrawdown: maxDrawdown * 100, // Convert to percentage
    maxDrawdownAmount,
    maxDrawdownDuration,
  };
}

/**
 * Compare two strategies
 */
export function compareStrategies(
  strategy1: PerformanceMetrics,
  strategy2: PerformanceMetrics
): {
  better: 'strategy1' | 'strategy2' | 'similar';
  score1: number;
  score2: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score1 = 0;
  let score2 = 0;

  // Compare returns (weight: 3)
  if (strategy1.annualizedReturn > strategy2.annualizedReturn) {
    score1 += 3;
    reasons.push('Strategy 1 has higher annualized return');
  } else if (strategy2.annualizedReturn > strategy1.annualizedReturn) {
    score2 += 3;
    reasons.push('Strategy 2 has higher annualized return');
  }

  // Compare Sharpe ratio (weight: 2)
  if (strategy1.sharpeRatio > strategy2.sharpeRatio) {
    score1 += 2;
    reasons.push('Strategy 1 has better risk-adjusted returns (Sharpe ratio)');
  } else if (strategy2.sharpeRatio > strategy1.sharpeRatio) {
    score2 += 2;
    reasons.push('Strategy 2 has better risk-adjusted returns (Sharpe ratio)');
  }

  // Compare max drawdown (weight: 2, lower is better)
  if (strategy1.maxDrawdown < strategy2.maxDrawdown) {
    score1 += 2;
    reasons.push('Strategy 1 has lower maximum drawdown');
  } else if (strategy2.maxDrawdown < strategy1.maxDrawdown) {
    score2 += 2;
    reasons.push('Strategy 2 has lower maximum drawdown');
  }

  // Compare win rate (weight: 1)
  if (strategy1.winRate > strategy2.winRate) {
    score1 += 1;
    reasons.push('Strategy 1 has higher win rate');
  } else if (strategy2.winRate > strategy1.winRate) {
    score2 += 1;
    reasons.push('Strategy 2 has higher win rate');
  }

  // Determine winner
  let better: 'strategy1' | 'strategy2' | 'similar';
  if (Math.abs(score1 - score2) <= 1) {
    better = 'similar';
  } else if (score1 > score2) {
    better = 'strategy1';
  } else {
    better = 'strategy2';
  }

  return {
    better,
    score1,
    score2,
    reasons,
  };
}

export default {
  calculatePerformanceMetrics,
  compareStrategies,
};
