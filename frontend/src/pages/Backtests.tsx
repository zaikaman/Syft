import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  TrendingUp, 
  Play, 
  Clock, 
  BarChart3,
  Target,
  Zap,
  RefreshCw,
  Archive,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  TrendingDown,
  Award,
  Percent,
  DollarSign,
  Calendar,
  Settings,
  Eye,
  Filter,
  Search,
  X,
  Box
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { Card, Button, useModal } from '../components/ui';
import { useWallet } from '../providers/WalletProvider';
import { Link } from 'react-router-dom';

interface BacktestConfig {
  startTime: string;
  endTime: string;
  initialCapital: number;
  resolution: 'hour' | 'day' | 'week';
  selectedVaultId: string | null;
}

interface UserVault {
  vault_id: string;
  name: string;
  description?: string;
  config: {
    name: string;
    assets: Array<{ assetId?: string; assetCode: string; assetIssuer?: string; percentage: number }>;
    rules?: any[];
  };
  status: string;
  contract_address?: string;
  owner_wallet_address: string;
  network: string;
  created_at: string;
}

interface BacktestMetrics {
  totalReturn: number;
  totalReturnAmount: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  numRebalances: number;
  finalValue: number;
  buyAndHoldReturn: number;
}

interface BacktestResult {
  backtestId: string;
  vaultId: string;
  vaultConfig: any;
  timeframe: { start: string; end: string };
  initialCapital: number;
  results: {
    metrics: BacktestMetrics;
    timeline: any[];
    portfolioValueHistory: { timestamp: string; value: number }[];
    allocationHistory: any[];
  };
  createdAt: string;
}

const Backtests = () => {
  const [activeTab, setActiveTab] = useState<'configure' | 'results' | 'history'>('configure');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'return' | 'sharpe'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { address, network, networkPassphrase } = useWallet();
  const modal = useModal();

  // Vault selection state
  const [userVaults, setUserVaults] = useState<UserVault[]>([]);
  const [loadingVaults, setLoadingVaults] = useState(false);
  const [selectedVault, setSelectedVault] = useState<UserVault | null>(null);

  // Configuration state
  const [config, setConfig] = useState<BacktestConfig>({
    startTime: getDefaultStartTime(3),
    endTime: getDefaultEndTime(),
    initialCapital: 1000,
    resolution: 'day',
    selectedVaultId: null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (address) {
      fetchBacktestHistory();
      fetchUserVaults();
    }
  }, [address, network]);

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

  const fetchUserVaults = async () => {
    if (!address) return;
    
    try {
      setLoadingVaults(true);
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const normalizedNetwork = normalizeNetwork(network, networkPassphrase);
      
      const response = await fetch(`${backendUrl}/api/vaults/user/${address}?status=active&network=${normalizedNetwork}`);
      
      if (response.ok) {
        const data = await response.json();
        setUserVaults(data.data || []);
      }
    } catch (err) {
      console.error('[Backtests] Failed to fetch user vaults:', err);
    } finally {
      setLoadingVaults(false);
    }
  };

  const fetchBacktestHistory = async () => {
    if (!address) return;
    
    try {
      setLoading(true);
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const normalizedNetwork = normalizeNetwork(network, networkPassphrase);
      
      const response = await fetch(`${backendUrl}/api/backtests/vault/${address}?network=${normalizedNetwork}`);
      
      if (response.ok) {
        const data = await response.json();
        setBacktestResults(data.backtests || []);
      }
    } catch (err) {
      console.error('[Backtests] Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateConfig = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!config.selectedVaultId) {
      newErrors.selectedVaultId = 'Please select a vault to backtest';
    }

    if (!config.startTime) {
      newErrors.startTime = 'Start date is required';
    }

    if (!config.endTime) {
      newErrors.endTime = 'End date is required';
    }

    if (config.initialCapital <= 0) {
      newErrors.initialCapital = 'Initial capital must be greater than 0';
    }

    const start = new Date(config.startTime).getTime();
    const end = new Date(config.endTime).getTime();

    if (start >= end) {
      newErrors.endTime = 'End date must be after start date';
    }

    const now = Date.now();
    if (end > now) {
      newErrors.endTime = 'End date cannot be in the future';
    }

    const minDuration = 7 * 24 * 60 * 60 * 1000;
    if (end - start < minDuration) {
      newErrors.startTime = 'Backtest period must be at least 7 days';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [config]);

  const handleRunBacktest = async () => {
    if (!validateConfig()) {
      modal.message('Please fix validation errors before running backtest', 'Validation Failed', 'error');
      return;
    }

    if (!address) {
      modal.message('Please connect your wallet to run backtests', 'Wallet Required', 'warning');
      return;
    }

    if (!selectedVault) {
      modal.message('Please select a vault to backtest', 'Vault Required', 'warning');
      return;
    }

    // Validate vault has assets
    if (!selectedVault.config.assets || selectedVault.config.assets.length === 0) {
      modal.message('Selected vault has no assets configured', 'Invalid Vault', 'error');
      return;
    }

    try {
      setIsRunning(true);
      setProgress(0);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const normalizedNetwork = normalizeNetwork(network, networkPassphrase);

      // Use vault's actual asset allocations
      console.log('[Backtests] Selected vault config:', selectedVault.config);
      
      // Handle both old format (strings) and new format (objects)
      const normalizeAsset = (asset: any, index: number, total: number) => {
        // If asset is a string (old format), convert to object
        if (typeof asset === 'string') {
          return {
            assetId: `asset_${asset.toLowerCase()}`,
            assetCode: asset,
            assetIssuer: undefined,
            percentage: total > 0 ? Math.round(100 / total) : 100, // Equal distribution
          };
        }
        
        // If asset is an object (new format)
        if (asset && typeof asset === 'object' && asset.assetCode) {
          return {
            assetId: asset.assetId || `asset_${asset.assetCode.toLowerCase()}`,
            assetCode: asset.assetCode,
            assetIssuer: asset.assetIssuer,
            percentage: asset.percentage || 0,
          };
        }
        
        // Invalid asset
        return null;
      };
      
      const assets = selectedVault.config.assets
        .map((asset: any, index: number) => normalizeAsset(asset, index, selectedVault.config.assets.length))
        .filter((asset): asset is NonNullable<typeof asset> => asset !== null);

      console.log('[Backtests] Processed assets for backtest:', assets);

      if (assets.length === 0) {
        clearInterval(progressInterval);
        setIsRunning(false);
        modal.message('No valid assets found in vault configuration', 'Invalid Vault', 'error');
        return;
      }

      // Normalize percentages if they don't sum to 100
      const totalPercentage = assets.reduce((sum, asset) => sum + asset.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.1) {
        console.warn('[Backtests] Asset percentages do not sum to 100%, normalizing...', totalPercentage);
        assets.forEach(asset => {
          asset.percentage = (asset.percentage / totalPercentage) * 100;
        });
      }

      // Convert resolution string to milliseconds
      const resolutionMap: Record<string, number> = {
        'hour': 3600000,    // 1 hour
        'day': 86400000,    // 1 day
        'week': 604800000,  // 1 week
      };
      const resolutionMs = resolutionMap[config.resolution] || 86400000; // Default to 1 day

      const backtestPayload = {
        vaultConfig: {
          owner: selectedVault.owner_wallet_address,
          name: selectedVault.name,
          description: selectedVault.description || `Backtest of ${selectedVault.name}`,
          assets: assets,
          rules: selectedVault.config.rules || [],
          managementFee: (selectedVault.config as any).managementFee || 0,
          performanceFee: (selectedVault.config as any).performanceFee || 0,
          isPublic: (selectedVault.config as any).isPublic || false,
        },
        startTime: config.startTime,
        endTime: config.endTime,
        initialCapital: config.initialCapital,
        resolution: resolutionMs,
        network: normalizedNetwork,
      };

      console.log('[Backtests] Sending backtest request:', backtestPayload);
      console.log('[Backtests] Vault rules:', selectedVault.config.rules);

      // Transform database rules format to backtest engine format
      const transformedRules = (selectedVault.config.rules || []).map((rule: any, index: number) => {
        console.log(`[Backtests] Processing rule ${index}:`, rule);
        
        // Handle old database format
        if (rule.condition_type || rule.action) {
          const conditions = [];
          const params = rule.parameters || rule;
          
          // Transform condition
          if (rule.condition_type === 'time_based') {
            // Convert interval + unit to milliseconds
            const interval = params.interval || 1;
            const unit = params.unit || 'hours';
            
            let intervalMs = interval * 60000; // Default to minutes
            if (unit === 'seconds') intervalMs = interval * 1000;
            else if (unit === 'minutes') intervalMs = interval * 60000;
            else if (unit === 'hours') intervalMs = interval * 3600000;
            else if (unit === 'days') intervalMs = interval * 86400000;
            
            conditions.push({
              type: 'time',
              operator: 'gte',
              value: intervalMs,
            });
          } else if (rule.condition_type === 'price_based') {
            conditions.push({
              type: 'price',
              operator: rule.operator || 'gte',
              value: rule.threshold || 0,
              assetId: rule.assetId,
            });
          } else if (rule.condition_type === 'allocation_based') {
            conditions.push({
              type: 'allocation',
              operator: rule.operator || 'gte',
              value: rule.threshold || 0,
              assetId: rule.assetId,
            });
          }

          // Transform action
          const actions = [];
          if (rule.action === 'rebalance' && rule.target_allocation) {
            actions.push({
              type: 'rebalance',
              targetAllocations: rule.target_allocation.map((alloc: any) => ({
                assetId: alloc.assetId || `asset_${alloc.assetCode?.toLowerCase() || 'unknown'}`,
                assetCode: alloc.assetCode || alloc.asset || 'UNKNOWN',
                assetIssuer: alloc.assetIssuer,
                percentage: alloc.percentage || alloc.allocation || 0,
              })),
            });
          }

          return {
            id: rule.id || `rule_${index}`,
            name: rule.name || `Rule ${index + 1}`,
            description: rule.description,
            conditions,
            actions,
            enabled: rule.enabled !== false, // Default to enabled
            priority: rule.priority || index,
          };
        }

        // Already in correct format
        return rule;
      });

      console.log('[Backtests] Transformed rules:', transformedRules);

      backtestPayload.vaultConfig.rules = transformedRules;

      const response = await fetch(`${backendUrl}/api/backtests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backtestPayload),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.ok) {
        const data = await response.json();
        const newResult: BacktestResult = {
          backtestId: data.backtestId,
          vaultId: address,
          vaultConfig: data.result.request.vaultConfig,
          timeframe: {
            start: config.startTime,
            end: config.endTime,
          },
          initialCapital: config.initialCapital,
          results: data.result,
          createdAt: new Date().toISOString(),
        };
        
        setBacktestResults([newResult, ...backtestResults]);
        setSelectedResult(newResult);
        setActiveTab('results');
        
        modal.message('Backtest completed successfully!', 'Success', 'success');
      } else {
        throw new Error('Failed to run backtest');
      }
    } catch (err: any) {
      console.error('[Backtests] Error running backtest:', err);
      modal.message(
        `Failed to run backtest: ${err.message || 'Unknown error'}`,
        'Backtest Failed',
        'error'
      );
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  };

  const handlePresetPeriod = (months: number) => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);

    setConfig({
      ...config,
      startTime: start.toISOString().split('T')[0],
      endTime: end.toISOString().split('T')[0],
    });
  };

  const handleDeleteBacktest = async (backtestId: string) => {
    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/backtests/${backtestId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setBacktestResults(backtestResults.filter(r => r.backtestId !== backtestId));
        if (selectedResult?.backtestId === backtestId) {
          setSelectedResult(null);
        }
        modal.message('Backtest deleted successfully', 'Deleted', 'success');
      }
    } catch (err) {
      console.error('[Backtests] Error deleting backtest:', err);
      modal.message('Failed to delete backtest', 'Error', 'error');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const presetPeriods = [
    { label: '1 Month', months: 1 },
    { label: '3 Months', months: 3 },
    { label: '6 Months', months: 6 },
    { label: '1 Year', months: 12 },
  ];

  // Filter and sort results
  const filteredResults = backtestResults
    .filter(result => {
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'completed' && result.results.metrics) ||
        (statusFilter === 'failed' && !result.results.metrics);
      
      const matchesSearch = !searchQuery || 
        result.vaultConfig?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.backtestId.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'date') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'return') {
        comparison = (a.results.metrics?.totalReturn || 0) - (b.results.metrics?.totalReturn || 0);
      } else if (sortBy === 'sharpe') {
        comparison = (a.results.metrics?.sharpeRatio || 0) - (b.results.metrics?.sharpeRatio || 0);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  if (!address) {
    return (
      <div className="h-full bg-app flex items-center justify-center p-4">
        <Card className="p-8 text-center bg-card max-w-md border border-default">
          <Activity className="w-12 h-12 text-primary-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-neutral-50">Connect Your Wallet</h2>
          <p className="text-neutral-400">
            Connect your wallet to run backtests and analyze vault strategies
          </p>
        </Card>
      </div>
    );
  }

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
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-neutral-50 mb-2 flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-primary-500" />
                Strategy Backtesting
              </h1>
              <p className="text-neutral-400">
                Test your vault strategies against historical data to optimize performance
              </p>
            </div>
            
            {/* Quick Stats */}
            <div className="flex gap-4">
              <Card className="p-4 bg-card border border-default min-w-[140px]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    <Archive className="w-5 h-5 text-primary-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-neutral-50">{backtestResults.length}</div>
                    <div className="text-xs text-neutral-400">Total Tests</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Tab Navigation - Modern Design */}
          <div className="bg-card border border-default rounded-lg p-1 flex gap-1">
            {[
              { id: 'configure', label: 'Configure Test', icon: Settings, count: null },
              { id: 'results', label: 'Results', icon: Eye, count: selectedResult ? '1' : null },
              { id: 'history', label: 'History', icon: Archive, count: backtestResults.length > 0 ? backtestResults.length.toString() : null },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-all flex-1 justify-center relative ${
                    activeTab === tab.id
                      ? 'bg-primary-500 text-dark-950 shadow-lg'
                      : 'text-neutral-400 hover:text-neutral-50 hover:bg-neutral-900/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.count && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      activeTab === tab.id 
                        ? 'bg-dark-950/20 text-dark-950' 
                        : 'bg-primary-500/20 text-primary-500'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            {/* Configure Tab */}
            {activeTab === 'configure' && (
              <motion.div
                key="configure"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Data Source Info Banner */}
                <Card className="p-4 bg-primary-500/10 border border-primary-500/30">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary-500/20 mt-0.5">
                      <AlertCircle className="w-5 h-5 text-primary-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-primary-400 mb-1">Data Source Priority</h3>
                      <p className="text-xs text-neutral-300 mb-2">
                        Backtests attempt to use <strong>real market data</strong> with the following priority: 
                        <strong> 1) Current network</strong>, 
                        <strong> 2) Mainnet fallback</strong>, 
                        <strong> 3) Synthetic data (last resort)</strong>
                      </p>
                      <p className="text-xs text-neutral-400">
                        💡 <strong>Note:</strong> Testnet undergoes quarterly resets. For production-grade backtesting, use <code className="px-1 py-0.5 bg-neutral-800 rounded text-primary-400">stellar snapshot create</code> with mainnet data
                      </p>
                    </div>
                  </div>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Configuration Form */}
                  <div className="lg:col-span-2">
                    <Card className="p-6 bg-card border border-default">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                          <Target className="w-5 h-5 text-primary-500" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-neutral-50">Backtest Configuration</h2>
                          <p className="text-sm text-neutral-400">Set up your backtest parameters</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        {/* Vault Selector */}
                        <div>
                          <label className="block text-sm font-medium mb-3 text-neutral-300">
                            Select Vault to Backtest *
                          </label>
                          {loadingVaults ? (
                            <div className="flex items-center justify-center py-8 bg-neutral-900 rounded-lg border border-default">
                              <RefreshCw className="w-5 h-5 animate-spin text-primary-500 mr-2" />
                              <span className="text-neutral-400">Loading your vaults...</span>
                            </div>
                          ) : userVaults.length === 0 ? (
                            <Card className="p-6 text-center bg-neutral-900 border border-default">
                              <Box className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                              <p className="text-neutral-400 mb-4">No active vaults found on {network}</p>
                              <Link to="/app/builder">
                                <Button variant="primary" size="sm">Create a Vault</Button>
                              </Link>
                            </Card>
                          ) : (
                            <div className="grid grid-cols-1 gap-3">
                              {userVaults.map((vault) => (
                                <button
                                  key={vault.vault_id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedVault(vault);
                                    setConfig({ ...config, selectedVaultId: vault.vault_id });
                                    setErrors({ ...errors, selectedVaultId: '' });
                                  }}
                                  disabled={isRunning}
                                  className={`p-4 rounded-lg border-2 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                                    config.selectedVaultId === vault.vault_id
                                      ? 'border-primary-500 bg-primary-500/10'
                                      : 'border-default bg-neutral-900 hover:border-primary-500/50 hover:bg-neutral-800'
                                  }`}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-neutral-50 mb-1">{vault.name}</h4>
                                      <p className="text-xs text-neutral-500">ID: {vault.vault_id.slice(0, 12)}...</p>
                                    </div>
                                    {config.selectedVaultId === vault.vault_id && (
                                      <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-4 h-4 text-dark-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {vault.config.assets.map((asset, idx) => {
                                      // Handle both string format and object format
                                      const assetCode = typeof asset === 'string' ? asset : asset.assetCode;
                                      const percentage = typeof asset === 'string' 
                                        ? Math.round(100 / vault.config.assets.length) 
                                        : asset.percentage;
                                      
                                      return (
                                        <span
                                          key={idx}
                                          className="px-2 py-1 bg-neutral-800 rounded text-xs text-neutral-300"
                                        >
                                          {assetCode} ({percentage}%)
                                        </span>
                                      );
                                    })}
                                  </div>
                                  {vault.config.rules && vault.config.rules.length > 0 && (
                                    <p className="text-xs text-neutral-500 mt-2">
                                      {vault.config.rules.length} rebalance rule{vault.config.rules.length !== 1 ? 's' : ''}
                                    </p>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                          {errors.selectedVaultId && (
                            <p className="mt-2 text-sm text-error-400 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              {errors.selectedVaultId}
                            </p>
                          )}
                        </div>

                        {/* Quick Presets */}
                        <div>
                          <label className="block text-sm font-medium mb-3 text-neutral-300">
                            Quick Select Period
                          </label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {presetPeriods.map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => handlePresetPeriod(preset.months)}
                                disabled={isRunning}
                                className="px-4 py-3 bg-neutral-900 hover:bg-neutral-800 border border-default rounded-lg text-sm font-medium transition-all text-neutral-300 hover:text-neutral-50 hover:border-primary-500/50 disabled:opacity-50 disabled:cursor-not-allowed group"
                              >
                                <Calendar className="w-4 h-4 mx-auto mb-1 text-neutral-500 group-hover:text-primary-500 transition-colors" />
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Date Range */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2 text-neutral-300">
                              Start Date
                            </label>
                            <input
                              type="date"
                              value={config.startTime}
                              onChange={(e) => setConfig({ ...config, startTime: e.target.value })}
                              disabled={isRunning}
                              max={config.endTime}
                              className="w-full px-4 py-3 border border-default rounded-lg bg-neutral-900 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 transition-all"
                            />
                            {errors.startTime && (
                              <p className="mt-2 text-sm text-error-400 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                {errors.startTime}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2 text-neutral-300">
                              End Date
                            </label>
                            <input
                              type="date"
                              value={config.endTime}
                              onChange={(e) => setConfig({ ...config, endTime: e.target.value })}
                              disabled={isRunning}
                              min={config.startTime}
                              max={new Date().toISOString().split('T')[0]}
                              className="w-full px-4 py-3 border border-default rounded-lg bg-neutral-900 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 transition-all"
                            />
                            {errors.endTime && (
                              <p className="mt-2 text-sm text-error-400 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                {errors.endTime}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Initial Capital */}
                        <div>
                          <label className="block text-sm font-medium mb-2 text-neutral-300">
                            Initial Capital (USDC)
                          </label>
                          <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                            <input
                              type="number"
                              value={config.initialCapital}
                              onChange={(e) => setConfig({ ...config, initialCapital: parseFloat(e.target.value) || 0 })}
                              disabled={isRunning}
                              min="1"
                              step="100"
                              className="w-full pl-12 pr-4 py-3 border border-default rounded-lg bg-neutral-900 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 transition-all"
                            />
                          </div>
                          {errors.initialCapital && (
                            <p className="mt-2 text-sm text-error-400 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              {errors.initialCapital}
                            </p>
                          )}
                        </div>

                        {/* Resolution */}
                        <div>
                          <label className="block text-sm font-medium mb-2 text-neutral-300">
                            Data Resolution
                          </label>
                          <select
                            value={config.resolution}
                            onChange={(e) => setConfig({ ...config, resolution: e.target.value as any })}
                            disabled={isRunning}
                            className="w-full px-4 py-3 border border-default rounded-lg bg-neutral-900 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 transition-all"
                          >
                            <option value="day">📅 Daily (Recommended)</option>
                            <option value="hour">⏰ Hourly (More Detailed)</option>
                            <option value="week">📊 Weekly (Faster)</option>
                          </select>
                          <p className="mt-2 text-xs text-neutral-500">
                            Higher resolution provides more accurate results but takes longer to compute
                          </p>
                        </div>

                        {/* Run Button */}
                        <Button
                          onClick={handleRunBacktest}
                          disabled={isRunning}
                          variant="primary"
                          size="lg"
                          className="w-full flex items-center justify-center gap-2 py-4"
                        >
                          {isRunning ? (
                            <>
                              <RefreshCw className="w-5 h-5 animate-spin" />
                              Running Backtest... {progress}%
                            </>
                          ) : (
                            <>
                              <Play className="w-5 h-5" />
                              Run Backtest
                            </>
                          )}
                        </Button>
                      </div>
                    </Card>
                  </div>

                  {/* Info & Tips Sidebar */}
                  <div className="space-y-4">
                    {/* Configuration Summary */}
                    <Card className="p-5 bg-card border border-default">
                      <h3 className="text-sm font-bold text-neutral-50 mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary-500" />
                        Configuration Summary
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Vault</span>
                          <span className="text-neutral-50 font-medium">
                            {selectedVault ? selectedVault.name : 'Not selected'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Period</span>
                          <span className="text-neutral-50 font-medium">
                            {config.startTime && config.endTime
                              ? `${Math.ceil((new Date(config.endTime).getTime() - new Date(config.startTime).getTime()) / (1000 * 60 * 60 * 24))} days`
                              : 'Not set'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Capital</span>
                          <span className="text-neutral-50 font-medium">${config.initialCapital.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Resolution</span>
                          <span className="text-neutral-50 font-medium capitalize">{config.resolution}</span>
                        </div>
                        {selectedVault && (
                          <div className="pt-3 border-t border-default">
                            <p className="text-xs text-neutral-500 mb-2">Assets:</p>
                            <div className="space-y-1">
                              {selectedVault.config.assets.map((asset, idx) => {
                                const assetCode = typeof asset === 'string' ? asset : asset.assetCode;
                                const percentage = typeof asset === 'string' 
                                  ? Math.round(100 / selectedVault.config.assets.length) 
                                  : asset.percentage;
                                
                                return (
                                  <div key={idx} className="flex justify-between text-xs">
                                    <span className="text-neutral-400">{assetCode}</span>
                                    <span className="text-neutral-300">{percentage}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* Tips Card */}
                    <Card className="p-5 bg-gradient-to-br from-primary-500/10 to-primary-600/5 border border-primary-500/20">
                      <div className="flex items-start gap-3 mb-3">
                        <Zap className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-sm font-bold text-neutral-50 mb-1">Pro Tips</h3>
                          <ul className="text-xs text-neutral-400 space-y-2">
                            <li className="flex items-start gap-2">
                              <span className="text-primary-500 mt-0.5">•</span>
                              <span>Test periods should be at least 7 days for meaningful results</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary-500 mt-0.5">•</span>
                              <span>Higher resolution provides more accurate data but slower computation</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary-500 mt-0.5">•</span>
                              <span>Compare against buy-and-hold to measure strategy alpha</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </Card>

                    {/* Recent History Preview */}
                    {backtestResults.length > 0 && (
                      <Card className="p-5 bg-card border border-default">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-neutral-50">Recent Tests</h3>
                          <button
                            onClick={() => setActiveTab('history')}
                            className="text-xs text-primary-500 hover:text-primary-400 transition-colors"
                          >
                            View All →
                          </button>
                        </div>
                        <div className="space-y-2">
                          {backtestResults.slice(0, 3).map((result) => (
                            <div
                              key={result.backtestId}
                              onClick={() => {
                                setSelectedResult(result);
                                setActiveTab('results');
                              }}
                              className="p-3 bg-neutral-900 hover:bg-neutral-800 rounded-lg cursor-pointer transition-all group"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-neutral-400">
                                  {new Date(result.createdAt).toLocaleDateString()}
                                </span>
                                <span className={`text-xs font-bold ${
                                  result.results.metrics.totalReturn >= 0 
                                    ? 'text-success-400' 
                                    : 'text-error-400'
                                }`}>
                                  {formatPercent(result.results.metrics.totalReturn)}
                                </span>
                              </div>
                              <div className="text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors">
                                {result.vaultConfig?.name || 'Unnamed Test'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Results Tab */}
            {activeTab === 'results' && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {selectedResult ? (
                  <div className="space-y-6">
                    {/* Mock Data Warning (if applicable) */}
                    {selectedResult.results.metrics.usingMockData && (
                      <Card className="p-4 bg-warning-500/10 border border-warning-500/30">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-warning-500/20 mt-0.5">
                            <AlertTriangle className="w-5 h-5 text-warning-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-bold text-warning-400 mb-1">Synthetic Data Used</h3>
                            <p className="text-xs text-neutral-300">
                              {selectedResult.results.metrics.dataSourceWarning}
                            </p>
                          </div>
                        </div>
                      </Card>
                    )}

                    {/* No Rebalancing Info */}
                    {selectedResult.results.metrics.numRebalances === 0 && (
                      <Card className="p-4 bg-blue-500/10 border border-blue-500/30">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/20 mt-0.5">
                            <AlertCircle className="w-5 h-5 text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-bold text-blue-400 mb-1">Static Portfolio (No Rebalancing)</h3>
                            <p className="text-xs text-neutral-300">
                              This backtest shows a "buy and hold" strategy. No rebalancing rules were triggered during the test period. 
                              {selectedResult.vaultConfig.rules?.length === 0 && ' The vault has no rebalancing rules configured.'}
                              {(selectedResult.vaultConfig.rules?.length || 0) > 0 && ' None of the configured rules met their trigger conditions.'}
                            </p>
                          </div>
                        </div>
                      </Card>
                    )}

                    {/* Results Header with Export */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                          <Award className="w-5 h-5 text-primary-500" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-neutral-50">Backtest Results</h2>
                          <p className="text-sm text-neutral-400">
                            {new Date(selectedResult.timeframe.start).toLocaleDateString()} - {new Date(selectedResult.timeframe.end).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => {
                          const dataStr = JSON.stringify(selectedResult, null, 2);
                          const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                          const exportFileDefaultName = `backtest-${selectedResult.backtestId}.json`;
                          const linkElement = document.createElement('a');
                          linkElement.setAttribute('href', dataUri);
                          linkElement.setAttribute('download', exportFileDefaultName);
                          linkElement.click();
                        }}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Export Results
                      </Button>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="p-5 bg-card border border-default hover:border-primary-500/50 transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-lg bg-success-400/10 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-success-400" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className={`text-2xl font-bold ${selectedResult.results.metrics.totalReturn >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                            {formatPercent(selectedResult.results.metrics.totalReturn)}
                          </div>
                          <div className="text-sm text-neutral-400">Total Return</div>
                          <div className="text-xs text-neutral-500">
                            {formatCurrency(selectedResult.results.metrics.totalReturnAmount)}
                          </div>
                        </div>
                      </Card>

                      <Card className="p-5 bg-card border border-default hover:border-primary-500/50 transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                            <Target className="w-5 h-5 text-primary-500" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold text-neutral-50">
                            {selectedResult.results.metrics.sharpeRatio.toFixed(2)}
                          </div>
                          <div className="text-sm text-neutral-400">Sharpe Ratio</div>
                          <div className="text-xs text-neutral-500">Risk-adjusted return</div>
                        </div>
                      </Card>

                      <Card className="p-5 bg-card border border-default hover:border-primary-500/50 transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-lg bg-error-400/10 flex items-center justify-center">
                            <TrendingDown className="w-5 h-5 text-error-400" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold text-error-400">
                            {formatPercent(-Math.abs(selectedResult.results.metrics.maxDrawdown))}
                          </div>
                          <div className="text-sm text-neutral-400">Max Drawdown</div>
                          <div className="text-xs text-neutral-500">Worst decline</div>
                        </div>
                      </Card>

                      <Card className="p-5 bg-card border border-default hover:border-primary-500/50 transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-lg bg-warning-400/10 flex items-center justify-center">
                            <Percent className="w-5 h-5 text-warning-400" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold text-neutral-50">
                            {formatPercent(selectedResult.results.metrics.winRate)}
                          </div>
                          <div className="text-sm text-neutral-400">Win Rate</div>
                          <div className="text-xs text-neutral-500">Profitable trades</div>
                        </div>
                      </Card>
                    </div>

                    {/* Performance Chart */}
                    <Card className="p-6 bg-card border border-default">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-lg font-bold text-neutral-50">Portfolio Value Over Time</h3>
                          <p className="text-sm text-neutral-400 mt-1">Track your strategy's performance</p>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={selectedResult.results.portfolioValueHistory.map(p => ({
                          date: new Date(p.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                          value: p.value,
                        }))}>
                          <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#a8c93a" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#a8c93a" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px' }}
                          />
                          <YAxis 
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px' }}
                            tickFormatter={(value) => `$${value.toFixed(0)}`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1F2937',
                              border: '1px solid #374151',
                              borderRadius: '8px',
                              color: '#F9FAFB',
                            }}
                            formatter={(value: number) => [formatCurrency(value), 'Portfolio Value']}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#a8c93a"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Card>

                    {/* Strategy Comparison */}
                    <Card className="p-6 bg-card border border-default">
                      <h3 className="text-lg font-bold text-neutral-50 mb-6">Strategy Comparison</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-6 bg-neutral-900 rounded-lg border border-default hover:border-primary-500/50 transition-all">
                          <p className="text-sm text-neutral-400 mb-3">Your Strategy</p>
                          <p className={`text-4xl font-bold mb-2 ${selectedResult.results.metrics.totalReturn >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                            {formatPercent(selectedResult.results.metrics.totalReturn)}
                          </p>
                          <p className="text-xs text-neutral-500">Total Return</p>
                        </div>
                        <div className="text-center p-6 bg-primary-500/10 rounded-lg border-2 border-primary-500">
                          <p className="text-sm text-neutral-400 mb-3">Alpha Generated</p>
                          <p className={`text-4xl font-bold mb-2 ${(selectedResult.results.metrics.totalReturn - selectedResult.results.metrics.buyAndHoldReturn) >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                            {formatPercent(selectedResult.results.metrics.totalReturn - selectedResult.results.metrics.buyAndHoldReturn)}
                          </p>
                          <p className="text-xs text-neutral-500">vs Buy & Hold</p>
                        </div>
                        <div className="text-center p-6 bg-neutral-900 rounded-lg border border-default hover:border-primary-500/50 transition-all">
                          <p className="text-sm text-neutral-400 mb-3">Buy & Hold</p>
                          <p className={`text-4xl font-bold mb-2 ${selectedResult.results.metrics.buyAndHoldReturn >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                            {formatPercent(selectedResult.results.metrics.buyAndHoldReturn)}
                          </p>
                          <p className="text-xs text-neutral-500">Passive Strategy</p>
                        </div>
                      </div>
                    </Card>

                    {/* Detailed Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Performance Metrics */}
                      <Card className="p-6 bg-card border border-default">
                        <h3 className="text-lg font-bold text-neutral-50 mb-4 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-primary-500" />
                          Performance Metrics
                        </h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center p-3 bg-neutral-900 rounded-lg">
                            <span className="text-sm text-neutral-400">Annualized Return</span>
                            <span className={`text-lg font-bold ${selectedResult.results.metrics.annualizedReturn >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                              {formatPercent(selectedResult.results.metrics.annualizedReturn)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-neutral-900 rounded-lg">
                            <span className="text-sm text-neutral-400">Volatility</span>
                            <span className="text-lg font-bold text-neutral-50">
                              {formatPercent(selectedResult.results.metrics.volatility)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-neutral-900 rounded-lg">
                            <span className="text-sm text-neutral-400">Final Value</span>
                            <span className="text-lg font-bold text-neutral-50">
                              {formatCurrency(selectedResult.results.metrics.finalValue)}
                            </span>
                          </div>
                        </div>
                      </Card>

                      {/* Trading Activity */}
                      <Card className="p-6 bg-card border border-default">
                        <h3 className="text-lg font-bold text-neutral-50 mb-4 flex items-center gap-2">
                          <Activity className="w-5 h-5 text-primary-500" />
                          Trading Activity
                        </h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center p-3 bg-neutral-900 rounded-lg">
                            <div className="flex flex-col">
                              <span className="text-sm text-neutral-400">Total Rebalances</span>
                              {selectedResult.results.metrics.numRebalances === 0 && (
                                <span className="text-xs text-neutral-600 mt-1">No rebalancing rules triggered</span>
                              )}
                            </div>
                            <span className="text-lg font-bold text-neutral-50">
                              {selectedResult.results.metrics.numRebalances}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-neutral-900 rounded-lg">
                            <span className="text-sm text-neutral-400">Win Rate</span>
                            <span className={`text-lg font-bold ${selectedResult.results.metrics.winRate >= 50 ? 'text-success-400' : 'text-warning-400'}`}>
                              {formatPercent(selectedResult.results.metrics.winRate)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-neutral-900 rounded-lg">
                            <span className="text-sm text-neutral-400">Test Duration</span>
                            <span className="text-lg font-bold text-neutral-50">
                              {Math.ceil((new Date(selectedResult.timeframe.end).getTime() - new Date(selectedResult.timeframe.start).getTime()) / (1000 * 60 * 60 * 24))} days
                            </span>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Actions */}
                    <Card className="p-6 bg-gradient-to-r from-primary-500/10 to-primary-600/5 border border-primary-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-neutral-50 mb-1">Like these results?</h3>
                          <p className="text-sm text-neutral-400">Deploy this strategy as a live vault</p>
                        </div>
                        <Link to="/app/builder">
                          <Button variant="primary" size="lg" className="flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Create Vault
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  </div>
                ) : (
                  <Card className="p-12 text-center bg-card border border-default">
                    <BarChart3 className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-neutral-50 mb-2">No Results Selected</h3>
                    <p className="text-neutral-400 mb-6">
                      Run a backtest or select one from history to see detailed results
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button onClick={() => setActiveTab('configure')} variant="primary">
                        Configure Backtest
                      </Button>
                      {backtestResults.length > 0 && (
                        <Button onClick={() => setActiveTab('history')} variant="outline">
                          View History
                        </Button>
                      )}
                    </div>
                  </Card>
                )}
              </motion.div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-6 bg-card border border-default">
                  {/* History Header with Filters */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                          <Archive className="w-5 h-5 text-primary-500" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-neutral-50">Backtest History</h2>
                          <p className="text-sm text-neutral-400">
                            {filteredResults.length} test{filteredResults.length !== 1 ? 's' : ''}
                            {filteredResults.length !== backtestResults.length && ` (filtered from ${backtestResults.length})`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchBacktestHistory}
                        disabled={loading}
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>

                    {/* Search and Filters */}
                    <div className="flex flex-col md:flex-row gap-3">
                      {/* Search */}
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                        <input
                          type="text"
                          placeholder="Search by name or ID..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-default rounded-lg text-sm text-neutral-50 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-800 rounded transition-colors"
                          >
                            <X className="w-3 h-3 text-neutral-500" />
                          </button>
                        )}
                      </div>

                      {/* Status Filter */}
                      <div className="flex items-center gap-2 bg-neutral-900 p-1 rounded-lg border border-default">
                        <button
                          onClick={() => setStatusFilter('all')}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            statusFilter === 'all' 
                              ? 'bg-primary-500 text-dark-950' 
                              : 'text-neutral-400 hover:text-neutral-50'
                          }`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setStatusFilter('completed')}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            statusFilter === 'completed' 
                              ? 'bg-success-500 text-dark-950' 
                              : 'text-neutral-400 hover:text-neutral-50'
                          }`}
                        >
                          Completed
                        </button>
                        <button
                          onClick={() => setStatusFilter('failed')}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            statusFilter === 'failed' 
                              ? 'bg-error-500 text-dark-950' 
                              : 'text-neutral-400 hover:text-neutral-50'
                          }`}
                        >
                          Failed
                        </button>
                      </div>

                      {/* Sort */}
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-neutral-500" />
                        <select
                          value={`${sortBy}-${sortOrder}`}
                          onChange={(e) => {
                            const [newSortBy, newSortOrder] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
                            setSortBy(newSortBy);
                            setSortOrder(newSortOrder);
                          }}
                          className="px-3 py-2 bg-neutral-900 border border-default rounded-lg text-sm text-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        >
                          <option value="date-desc">Newest First</option>
                          <option value="date-asc">Oldest First</option>
                          <option value="return-desc">Best Return</option>
                          <option value="return-asc">Worst Return</option>
                          <option value="sharpe-desc">Best Sharpe</option>
                          <option value="sharpe-asc">Worst Sharpe</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Results List */}
                  {loading ? (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-4"></div>
                      <p className="text-neutral-400">Loading history...</p>
                    </div>
                  ) : filteredResults.length === 0 ? (
                    <div className="text-center py-12">
                      <Archive className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-neutral-50 mb-2">
                        {backtestResults.length === 0 ? 'No History Yet' : 'No Results Found'}
                      </h3>
                      <p className="text-neutral-400 mb-6">
                        {backtestResults.length === 0 
                          ? 'Your completed backtests will appear here'
                          : 'Try adjusting your filters'
                        }
                      </p>
                      {backtestResults.length === 0 && (
                        <Button onClick={() => setActiveTab('configure')} variant="primary">
                          Run First Backtest
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredResults.map((result, index) => (
                        <motion.div
                          key={result.backtestId}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="border border-default rounded-lg overflow-hidden hover:border-primary-500/50 transition-all"
                        >
                          {/* Result Header */}
                          <div
                            className="p-4 bg-neutral-900 cursor-pointer hover:bg-neutral-800 transition-colors"
                            onClick={() => setExpandedResult(expandedResult === result.backtestId ? null : result.backtestId)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 flex-1">
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-neutral-50 truncate">
                                      {result.vaultConfig?.name || 'Unnamed Test'}
                                    </h3>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400">
                                      {result.backtestId?.slice(0, 8) || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {new Date(result.createdAt).toLocaleString('en-US', { 
                                        month: 'short', 
                                        day: 'numeric', 
                                        hour: '2-digit', 
                                        minute: '2-digit' 
                                      })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {Math.ceil((new Date(result.timeframe.end).getTime() - new Date(result.timeframe.start).getTime()) / (1000 * 60 * 60 * 24))} days
                                    </span>
                                  </div>
                                </div>

                                {/* Metrics */}
                                <div className="hidden md:grid grid-cols-4 gap-6">
                                  <div>
                                    <div className="text-xs text-neutral-500 mb-0.5">Return</div>
                                    <div className={`text-sm font-semibold ${result.results.metrics.totalReturn >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                                      {formatPercent(result.results.metrics.totalReturn)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-neutral-500 mb-0.5">Sharpe</div>
                                    <div className="text-sm font-semibold text-neutral-50">
                                      {result.results.metrics.sharpeRatio.toFixed(2)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-neutral-500 mb-0.5">Drawdown</div>
                                    <div className="text-sm font-semibold text-error-400">
                                      {formatPercent(-Math.abs(result.results.metrics.maxDrawdown))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-neutral-500 mb-0.5">Win Rate</div>
                                    <div className="text-sm font-semibold text-neutral-50">
                                      {formatPercent(result.results.metrics.winRate)}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 ml-4">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedResult(result);
                                    setActiveTab('results');
                                  }}
                                  className="flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span className="hidden sm:inline">View</span>
                                </Button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteBacktest(result.backtestId);
                                  }}
                                  className="p-2 hover:bg-error-500/20 rounded-md transition-colors group"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4 text-neutral-400 group-hover:text-error-400 transition-colors" />
                                </button>
                                <button className="p-2 hover:bg-neutral-700 rounded-md transition-colors">
                                  {expandedResult === result.backtestId ? (
                                    <ChevronUp className="w-4 h-4 text-neutral-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Mobile Metrics */}
                            <div className="grid grid-cols-4 gap-3 mt-3 md:hidden">
                              <div>
                                <div className="text-xs text-neutral-500 mb-0.5">Return</div>
                                <div className={`text-sm font-semibold ${result.results.metrics.totalReturn >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                                  {formatPercent(result.results.metrics.totalReturn)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-neutral-500 mb-0.5">Sharpe</div>
                                <div className="text-sm font-semibold text-neutral-50">
                                  {result.results.metrics.sharpeRatio.toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-neutral-500 mb-0.5">Drawdown</div>
                                <div className="text-sm font-semibold text-error-400">
                                  {formatPercent(-Math.abs(result.results.metrics.maxDrawdown))}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-neutral-500 mb-0.5">Win Rate</div>
                                <div className="text-sm font-semibold text-neutral-50">
                                  {formatPercent(result.results.metrics.winRate)}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {expandedResult === result.backtestId && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="border-t border-default bg-card"
                            >
                              <div className="p-5">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                  <div className="p-3 bg-neutral-900 rounded-lg">
                                    <p className="text-xs text-neutral-400 mb-1">Annualized</p>
                                    <p className={`text-lg font-bold ${result.results.metrics.annualizedReturn >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                                      {formatPercent(result.results.metrics.annualizedReturn)}
                                    </p>
                                  </div>
                                  <div className="p-3 bg-neutral-900 rounded-lg">
                                    <p className="text-xs text-neutral-400 mb-1">Volatility</p>
                                    <p className="text-lg font-bold text-neutral-50">
                                      {formatPercent(result.results.metrics.volatility)}
                                    </p>
                                  </div>
                                  <div className="p-3 bg-neutral-900 rounded-lg">
                                    <p className="text-xs text-neutral-400 mb-1">Rebalances</p>
                                    <p className="text-lg font-bold text-neutral-50">
                                      {result.results.metrics.numRebalances}
                                    </p>
                                  </div>
                                  <div className="p-3 bg-neutral-900 rounded-lg">
                                    <p className="text-xs text-neutral-400 mb-1">Final Value</p>
                                    <p className="text-lg font-bold text-neutral-50">
                                      {formatCurrency(result.results.metrics.finalValue)}
                                    </p>
                                  </div>
                                </div>

                                {/* Mini Chart Preview */}
                                <div className="h-32 w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={result.results.portfolioValueHistory.slice(0, 50).map(p => ({
                                      value: p.value,
                                    }))}>
                                      <defs>
                                        <linearGradient id={`mini-${result.backtestId}`} x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#a8c93a" stopOpacity={0.3} />
                                          <stop offset="95%" stopColor="#a8c93a" stopOpacity={0} />
                                        </linearGradient>
                                      </defs>
                                      <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#a8c93a"
                                        strokeWidth={1.5}
                                        fillOpacity={1}
                                        fill={`url(#mini-${result.backtestId})`}
                                      />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

// Helper functions
function getDefaultStartTime(monthsAgo: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  return date.toISOString().split('T')[0];
}

function getDefaultEndTime(): string {
  return new Date().toISOString().split('T')[0];
}

export default Backtests;
