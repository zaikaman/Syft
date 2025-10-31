import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, DollarSign, Percent, Activity, Calendar, AlertCircle, 
  ArrowUpRight, ArrowDownRight, Shield, Target, TrendingDown,
  RefreshCw, ChevronDown, ChevronUp, ExternalLink,
  Clock, Package, Zap
} from 'lucide-react';
import { Card, Button, Skeleton } from '../components/ui';
import { useWallet } from '../providers/WalletProvider';
import { Link } from 'react-router-dom';

interface VaultBreakdown {
  vaultId: string;
  name: string;
  assets: any[];
  status: string;
  tvl: number;
  tvlChange24h: number;
  tvlChange7d: number;
  apy: number;
  totalDeposits: number;
  totalEarnings: number;
  earningsPercentage: number;
  sharePrice: number;
  totalShares: string;
  riskMetrics: {
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
  };
  config?: {
    name?: string;
  };
}

const Analytics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioAnalytics, setPortfolioAnalytics] = useState<any>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [allocationData, setAllocationData] = useState<any[]>([]);
  const [vaultBreakdown, setVaultBreakdown] = useState<VaultBreakdown[]>([]);
  const [expandedVault, setExpandedVault] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'tvl' | 'apy' | 'earnings'>('tvl');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [refreshing, setRefreshing] = useState(false);
  const { address, network, networkPassphrase } = useWallet();

  const normalizeNetwork = (net?: string, passphrase?: string): string => {
    if (!net) return 'testnet';
    if (passphrase) {
      if (passphrase.includes('Test SDF Future')) return 'futurenet';
      if (passphrase.includes('Test SDF Network')) return 'testnet';
      if (passphrase.includes('Public Global')) return 'mainnet';
    }
    const normalized = net.toLowerCase();
    if (normalized === 'standalone' || normalized === 'futurenet') return 'futurenet';
    if (normalized === 'testnet') return 'testnet';
    if (normalized === 'mainnet' || normalized === 'public') return 'mainnet';
    return 'testnet';
  };

  useEffect(() => {
    if (address) {
      fetchAllAnalytics();
    }
  }, [address, network, selectedPeriod]);

  const fetchAllAnalytics = async (isRefresh = false) => {
    if (!address) return;
    
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const normalizedNetwork = normalizeNetwork(network, networkPassphrase);
      
      // Fetch all analytics data in parallel
      const [portfolioRes, historyRes, allocationRes, breakdownRes] = await Promise.all([
        fetch(`${backendUrl}/api/analytics/portfolio/${address}?network=${normalizedNetwork}`),
        fetch(`${backendUrl}/api/analytics/portfolio/${address}/history?network=${normalizedNetwork}&days=${getPeriodDays()}`),
        fetch(`${backendUrl}/api/analytics/portfolio/${address}/allocation?network=${normalizedNetwork}`),
        fetch(`${backendUrl}/api/analytics/portfolio/${address}/breakdown?network=${normalizedNetwork}`),
      ]);

      // Process portfolio analytics
      if (portfolioRes.ok) {
        const data = await portfolioRes.json();
        if (data.success) {
          setPortfolioAnalytics(data.data);
        }
      }

      // Process historical data
      if (historyRes.ok) {
        const data = await historyRes.json();
        if (data.success && data.data.length > 0) {
          setHistoricalData(data.data.map((d: any) => ({
            ...d,
            timestamp: d.date,
            totalValue: d.value,
          })));
        }
      }

      // Process allocation data
      if (allocationRes.ok) {
        const data = await allocationRes.json();
        if (data.success) {
          setAllocationData(data.data);
        }
      }

      // Process vault breakdown
      if (breakdownRes.ok) {
        const data = await breakdownRes.json();
        if (data.success) {
          setVaultBreakdown(data.data);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getPeriodDays = () => {
    const map: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, '1y': 365 };
    return map[selectedPeriod] || 7;
  };

  const handleRefresh = () => {
    fetchAllAnalytics(true);
  };

  const handleSort = (field: 'tvl' | 'apy' | 'earnings') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const sortedVaults = [...vaultBreakdown].sort((a, b) => {
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'tvl') return (a.tvl - b.tvl) * multiplier;
    if (sortBy === 'apy') return (a.apy - b.apy) * multiplier;
    if (sortBy === 'earnings') return (a.totalEarnings - b.totalEarnings) * multiplier;
    return 0;
  });

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
      <div className="h-full bg-app overflow-auto">
        <div className="container mx-auto px-4 py-8 pb-16 max-w-7xl">
          <div className="space-y-6 pb-8">
            {/* Header Skeleton */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <Skeleton className="h-9 w-64 mb-2" />
                <Skeleton className="h-5 w-96" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>

            {/* Key Metrics Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="p-5 bg-card border border-default">
                  <div className="flex items-start justify-between mb-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </Card>
              ))}
            </div>

            {/* Performance Chart and Allocation Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart Skeleton */}
              <Card className="lg:col-span-2 p-6 bg-card border border-default">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
                <Skeleton className="h-64 w-full rounded-lg" />
              </Card>

              {/* Allocation Skeleton */}
              <Card className="p-6 bg-card border border-default">
                <Skeleton className="h-6 w-40 mb-6" />
                <Skeleton className="h-48 w-48 mx-auto mb-4 rounded-full" />
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="w-3 h-3 rounded-full" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Vault Breakdown Skeleton */}
            <Card className="p-6 bg-card border border-default">
              <div className="flex justify-between items-center mb-6">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-10 w-32" />
              </div>
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 bg-secondary rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-12 h-12 rounded-lg" />
                        <div>
                          <Skeleton className="h-5 w-32 mb-2" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      {[...Array(4)].map((_, j) => (
                        <div key={j}>
                          <Skeleton className="h-4 w-16 mb-1" />
                          <Skeleton className="h-6 w-20" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
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
          <Button onClick={() => fetchAllAnalytics()} variant="primary">Try Again</Button>
        </Card>
      </div>
    );
  }

  const totalValue = portfolioAnalytics?.totalTVL || 0;
  const totalReturn = portfolioAnalytics?.totalEarnings || 0;
  const totalReturnPct = portfolioAnalytics?.totalDeposits > 0 
    ? (totalReturn / portfolioAnalytics.totalDeposits) * 100 
    : 0;
  const avgApy = portfolioAnalytics?.weightedAPY || 0;

  return (
    <div className="h-full bg-app overflow-auto">
      <div className="container mx-auto px-4 py-8 pb-16 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6 pb-8"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-neutral-50 mb-2">Portfolio Analytics</h1>
              <p className="text-neutral-400">
                Deep insights into your vault performance and returns
              </p>
            </div>
            
            <div className="flex items-center gap-3">
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

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="md"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
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
                  <div className="text-xs text-neutral-500">
                    {portfolioAnalytics?.vaultCount || 0} vaults
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
                  <div className={`flex items-center gap-1 text-xs font-medium ${totalReturnPct >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                    {totalReturnPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(totalReturnPct).toFixed(2)}%
                  </div>
                </div>
                <div className="space-y-1">
                  <div className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                    {totalReturn >= 0 ? '+' : ''}${totalReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-neutral-400">Total Earnings</div>
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
                  <div className="text-xs text-neutral-500">Weighted</div>
                </div>
                <div className="space-y-1">
                  <div className={`text-2xl font-bold ${avgApy >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                    {avgApy >= 0 ? '+' : ''}{avgApy.toFixed(2)}%
                  </div>
                  <div className="text-sm text-neutral-400">Average APY</div>
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
                  <div className="text-xs text-neutral-500">
                    {portfolioAnalytics?.activeVaultCount || 0} active
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-neutral-50">
                    ${(portfolioAnalytics?.totalDeposits || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-neutral-400">Total Invested</div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Performance Chart and Allocation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="lg:col-span-2"
            >
              <Card className="p-6 bg-card border border-default">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-50">Portfolio Performance</h2>
                    <p className="text-sm text-neutral-400 mt-1">Historical value over time</p>
                  </div>
                </div>
                
                {historicalData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
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
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Value']}
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
                  <div className="h-[350px] flex items-center justify-center">
                    <div className="text-center">
                      <Calendar className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                      <p className="text-neutral-400">No historical data available</p>
                      <p className="text-sm text-neutral-500 mt-1">Data will appear as your vaults generate performance history</p>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="p-6 bg-card border border-default">
                <h3 className="text-lg font-bold text-neutral-50 mb-4">Asset Allocation</h3>
                {allocationData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={allocationData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {allocationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#F9FAFB',
                          }}
                          formatter={(value: number, _name: string, props: any) => [
                            `$${value.toFixed(2)} (${props.payload.percentage.toFixed(1)}%)`,
                            props.payload.asset
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2 max-h-32 overflow-y-auto">
                      {allocationData.map((asset, idx) => (
                        <div key={`${asset.asset}-${idx}`} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: asset.color }} />
                            <span className="text-sm text-neutral-300">{asset.asset}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium text-neutral-50">${asset.value.toFixed(2)}</span>
                            <span className="text-xs text-neutral-400 ml-2">({asset.percentage.toFixed(1)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                    <p className="text-neutral-400 text-sm">No assets yet</p>
                    <p className="text-neutral-500 text-xs mt-1">Create a vault to see allocation</p>
                  </div>
                )}
              </Card>
            </motion.div>
          </div>

          {/* Vault Breakdown Table */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="p-6 bg-card border border-default">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-neutral-50 flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary-500" />
                    Vault Performance Breakdown
                  </h2>
                  <p className="text-sm text-neutral-400 mt-1">Detailed analytics for each vault</p>
                </div>
                
                {/* Sort Controls */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-400">Sort by:</span>
                  <button
                    onClick={() => handleSort('tvl')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      sortBy === 'tvl' ? 'bg-primary-500 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
                    }`}
                  >
                    TVL {sortBy === 'tvl' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                  <button
                    onClick={() => handleSort('apy')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      sortBy === 'apy' ? 'bg-primary-500 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
                    }`}
                  >
                    APY {sortBy === 'apy' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                  <button
                    onClick={() => handleSort('earnings')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      sortBy === 'earnings' ? 'bg-primary-500 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
                    }`}
                  >
                    Earnings {sortBy === 'earnings' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                </div>
              </div>

              {sortedVaults.length > 0 ? (
                <div className="space-y-3">
                  {sortedVaults.map((vault, index) => (
                    <motion.div
                      key={vault.vaultId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + index * 0.05 }}
                      className="border border-default rounded-lg overflow-hidden"
                    >
                      {/* Vault Header */}
                      <div
                        className="p-4 bg-neutral-900 cursor-pointer hover:bg-neutral-800 transition-colors"
                        onClick={() => setExpandedVault(expandedVault === vault.vaultId ? null : vault.vaultId)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-neutral-50">{vault.name || vault.config?.name || 'Unnamed Vault'}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  vault.status === 'active' ? 'bg-success-400/20 text-success-400' : 'bg-neutral-700 text-neutral-400'
                                }`}>
                                  {vault.status}
                                </span>
                              </div>
                              <p className="text-sm text-neutral-400">
                                {vault.assets.map((a: any) => typeof a === 'string' ? a : a.code).join(' / ')}
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-8 flex-1">
                              <div>
                                <div className="text-xs text-neutral-500 mb-0.5">TVL</div>
                                <div className="text-sm font-semibold text-neutral-50">
                                  ${vault.tvl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                              
                              <div>
                                <div className="text-xs text-neutral-500 mb-0.5">APY</div>
                                <div className={`text-sm font-semibold ${vault.apy >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                                  {vault.apy >= 0 ? '+' : ''}{vault.apy.toFixed(2)}%
                                </div>
                              </div>
                              
                              <div>
                                <div className="text-xs text-neutral-500 mb-0.5">Earnings</div>
                                <div className={`text-sm font-semibold ${vault.totalEarnings >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                                  {vault.totalEarnings >= 0 ? '+' : ''}${vault.totalEarnings.toFixed(2)}
                                </div>
                              </div>
                              
                              <div>
                                <div className="text-xs text-neutral-500 mb-0.5">Return</div>
                                <div className={`text-sm font-semibold ${vault.earningsPercentage >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                                  {vault.earningsPercentage >= 0 ? '+' : ''}{vault.earningsPercentage.toFixed(2)}%
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Link to={`/app/vaults/${vault.vaultId}`}>
                              <Button size="sm" variant="outline" className="flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" />
                                View
                              </Button>
                            </Link>
                            <button className="p-2 hover:bg-neutral-700 rounded-md transition-colors">
                              {expandedVault === vault.vaultId ? (
                                <ChevronUp className="w-4 h-4 text-neutral-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-neutral-400" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedVault === vault.vaultId && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-default bg-card"
                        >
                          <div className="p-4">
                            <div className="grid grid-cols-3 gap-4">
                              {/* Risk Metrics */}
                              <Card className="p-4 bg-neutral-900">
                                <div className="flex items-center gap-2 mb-3">
                                  <Shield className="w-4 h-4 text-primary-500" />
                                  <h4 className="text-sm font-semibold text-neutral-50">Risk Metrics</h4>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-xs text-neutral-400">Sharpe Ratio</span>
                                    <span className="text-xs font-medium text-neutral-50">
                                      {vault.riskMetrics.sharpeRatio.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-xs text-neutral-400">Max Drawdown</span>
                                    <span className="text-xs font-medium text-error-400">
                                      {vault.riskMetrics.maxDrawdown.toFixed(2)}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-xs text-neutral-400">Volatility</span>
                                    <span className="text-xs font-medium text-neutral-50">
                                      {vault.riskMetrics.volatility.toFixed(2)}%
                                    </span>
                                  </div>
                                </div>
                              </Card>

                              {/* Performance Stats */}
                              <Card className="p-4 bg-neutral-900">
                                <div className="flex items-center gap-2 mb-3">
                                  <Zap className="w-4 h-4 text-warning-400" />
                                  <h4 className="text-sm font-semibold text-neutral-50">Performance</h4>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-xs text-neutral-400">Total Deposited</span>
                                    <span className="text-xs font-medium text-neutral-50">
                                      ${vault.totalDeposits.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-xs text-neutral-400">Share Price</span>
                                    <span className="text-xs font-medium text-neutral-50">
                                      ${vault.sharePrice.toFixed(4)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-xs text-neutral-400">Total Shares</span>
                                    <span className="text-xs font-medium text-neutral-50">
                                      {(Number(vault.totalShares) / 1e7).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </Card>

                              {/* Vault Info */}
                              <Card className="p-4 bg-neutral-900">
                                <div className="flex items-center gap-2 mb-3">
                                  <Clock className="w-4 h-4 text-primary-500" />
                                  <h4 className="text-sm font-semibold text-neutral-50">Info</h4>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-xs text-neutral-400">Vault ID</span>
                                    <span className="text-xs font-mono text-neutral-50">
                                      {vault.vaultId.slice(0, 8)}...
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-xs text-neutral-400">24h Change</span>
                                    <span className={`text-xs font-medium ${vault.tvlChange24h >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                                      {vault.tvlChange24h >= 0 ? '+' : ''}{vault.tvlChange24h.toFixed(2)}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-xs text-neutral-400">7d Change</span>
                                    <span className={`text-xs font-medium ${vault.tvlChange7d >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                                      {vault.tvlChange7d >= 0 ? '+' : ''}{vault.tvlChange7d.toFixed(2)}%
                                    </span>
                                  </div>
                                </div>
                              </Card>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                  <p className="text-neutral-400">No vaults found</p>
                  <p className="text-sm text-neutral-500 mt-1">Create your first vault to see analytics</p>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Best & Worst Performers */}
          {portfolioAnalytics?.bestPerformingVault && portfolioAnalytics?.worstPerformingVault && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                <Card className="p-6 bg-card border border-default">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-success-400/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-success-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-neutral-50">Best Performer</h3>
                      <p className="text-xs text-neutral-400">Highest APY vault</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">Vault Name</span>
                      <span className="font-semibold text-neutral-50">
                        {portfolioAnalytics.bestPerformingVault.name}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">APY</span>
                      <span className="text-xl font-bold text-success-400">
                        +{portfolioAnalytics.bestPerformingVault.apy.toFixed(2)}%
                      </span>
                    </div>
                    <Link to={`/app/vaults/${portfolioAnalytics.bestPerformingVault.vaultId}`}>
                      <Button variant="outline" size="sm" className="w-full mt-2">
                        View Vault
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
              >
                <Card className="p-6 bg-card border border-default">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-error-400/10 flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-error-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-neutral-50">Needs Attention</h3>
                      <p className="text-xs text-neutral-400">Lowest APY vault</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">Vault Name</span>
                      <span className="font-semibold text-neutral-50">
                        {portfolioAnalytics.worstPerformingVault.name}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">APY</span>
                      <span className="text-xl font-bold text-error-400">
                        {portfolioAnalytics.worstPerformingVault.apy.toFixed(2)}%
                      </span>
                    </div>
                    <Link to={`/app/vaults/${portfolioAnalytics.worstPerformingVault.vaultId}`}>
                      <Button variant="outline" size="sm" className="w-full mt-2">
                        View Vault
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;
