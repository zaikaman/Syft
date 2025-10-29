import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Percent, Activity, Calendar, AlertCircle } from 'lucide-react';
import { Card, Button } from '../components/ui';
import { useWallet } from '../providers/WalletProvider';

const Analytics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioAnalytics, setPortfolioAnalytics] = useState<any>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const { address } = useWallet();

  useEffect(() => {
    if (address) {
      fetchAnalytics();
    }
  }, [address, selectedPeriod]);

  const fetchAnalytics = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);

    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const normalizedNetwork = 'futurenet'; // Default network
      
      // Fetch portfolio analytics
      const analyticsResponse = await fetch(
        `${backendUrl}/api/analytics/portfolio/${address}?network=${normalizedNetwork}`
      );
      
      if (!analyticsResponse.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const analyticsData = await analyticsResponse.json();
      if (analyticsData.success) {
        setPortfolioAnalytics(analyticsData.data);
      }

      // Fetch historical data based on selected period
      const days = selectedPeriod === '24h' ? 1 : selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 365;
      const historyResponse = await fetch(
        `${backendUrl}/api/analytics/portfolio/${address}/history?network=${normalizedNetwork}&days=${days}`
      );

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        if (historyData.success) {
          setHistoricalData(historyData.data || []);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const periods = [
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
    { value: '1y', label: '1y' },
  ];

  if (!address) {
    return (
      <div className="h-full bg-app flex items-center justify-center p-4">
        <Card className="p-8 text-center bg-card max-w-md">
          <Activity className="w-12 h-12 text-primary-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-neutral-50">Connect Your Wallet</h2>
          <p className="text-neutral-400">
            Connect your wallet to view detailed analytics and insights about your portfolio performance
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full bg-app flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
          <p className="text-neutral-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-app flex items-center justify-center p-4">
        <Card className="p-8 text-center bg-card max-w-md">
          <AlertCircle className="w-12 h-12 text-error-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-neutral-50">Error Loading Analytics</h2>
          <p className="text-neutral-400 mb-4">{error}</p>
          <Button onClick={fetchAnalytics} variant="primary">Try Again</Button>
        </Card>
      </div>
    );
  }

  const totalValue = portfolioAnalytics?.totalValue || 0;
  const totalReturn = portfolioAnalytics?.totalReturn || 0;
  const totalReturnPct = portfolioAnalytics?.totalReturnPct || 0;
  const avgApy = portfolioAnalytics?.avgApy || 0;

  return (
    <div className="h-full bg-app overflow-auto">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-50 mb-2">Portfolio Analytics</h1>
              <p className="text-neutral-400">
                Deep insights into your vault performance and returns
              </p>
            </div>
            
            {/* Period Selector */}
            <div className="flex items-center gap-2 bg-secondary p-1 rounded-lg">
              {periods.map((period) => (
                <button
                  key={period.value}
                  onClick={() => setSelectedPeriod(period.value)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedPeriod === period.value
                      ? 'bg-primary-500 text-white'
                      : 'text-neutral-400 hover:text-neutral-50 hover:bg-neutral-900'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-5 bg-card border border-default">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-primary-500" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-neutral-50">
                    ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-neutral-400">Total Portfolio Value</div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-5 bg-card border border-default">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-success-400/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-success-400" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                    {totalReturn >= 0 ? '+' : ''}${totalReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-neutral-400">Total Return</div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-5 bg-card border border-default">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    <Percent className="w-5 h-5 text-primary-500" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className={`text-2xl font-bold ${totalReturnPct >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                    {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
                  </div>
                  <div className="text-sm text-neutral-400">Return %</div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-5 bg-card border border-default">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-warning-400/10 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-warning-400" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-neutral-50">
                    {avgApy.toFixed(2)}%
                  </div>
                  <div className="text-sm text-neutral-400">Average APY</div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Performance Chart */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6 bg-card border border-default">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-neutral-50">Portfolio Performance</h2>
                  <p className="text-sm text-neutral-400 mt-1">Historical value over time</p>
                </div>
              </div>
              
              {historicalData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={historicalData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a8c93a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a8c93a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="timestamp" 
                      stroke="#9CA3AF"
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB',
                      }}
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <Area
                      type="monotone"
                      dataKey="totalValue"
                      stroke="#a8c93a"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="text-center">
                    <Calendar className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                    <p className="text-neutral-400">No historical data available</p>
                    <p className="text-sm text-neutral-500 mt-1">Data will appear as your vaults generate performance history</p>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Additional Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="p-6 bg-card border border-default">
                <h3 className="text-lg font-bold text-neutral-50 mb-4">Performance Breakdown</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-neutral-900 rounded-lg">
                    <span className="text-neutral-400">Active Vaults</span>
                    <span className="font-semibold text-neutral-50">{portfolioAnalytics?.activeVaults || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-900 rounded-lg">
                    <span className="text-neutral-400">Total Invested</span>
                    <span className="font-semibold text-neutral-50">
                      ${(portfolioAnalytics?.totalInvested || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-900 rounded-lg">
                    <span className="text-neutral-400">Best Performing Vault</span>
                    <span className="font-semibold text-success-400">
                      {portfolioAnalytics?.bestVault ? `+${portfolioAnalytics.bestVault.performance.toFixed(2)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card className="p-6 bg-card border border-default">
                <h3 className="text-lg font-bold text-neutral-50 mb-4">Risk Metrics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-neutral-900 rounded-lg">
                    <span className="text-neutral-400">Volatility</span>
                    <span className="font-semibold text-neutral-50">
                      {portfolioAnalytics?.volatility ? `${portfolioAnalytics.volatility.toFixed(2)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-900 rounded-lg">
                    <span className="text-neutral-400">Sharpe Ratio</span>
                    <span className="font-semibold text-neutral-50">
                      {portfolioAnalytics?.sharpeRatio ? portfolioAnalytics.sharpeRatio.toFixed(2) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-900 rounded-lg">
                    <span className="text-neutral-400">Max Drawdown</span>
                    <span className="font-semibold text-error-400">
                      {portfolioAnalytics?.maxDrawdown ? `${portfolioAnalytics.maxDrawdown.toFixed(2)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;
