import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Box, DollarSign, TrendingUp, AlertCircle, 
  Search, Grid, List, Package, Users, Crown,
  ExternalLink, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Card, Button, Skeleton } from '../components/ui';
import { useWallet } from '../providers/WalletProvider';
import { resolveAssetNames } from '../services/tokenService';

interface Vault {
  vault_id: string;
  owner: string;
  contract_address: string;
  name?: string;
  description?: string;
  config: {
    name?: string;
    assets: Array<{ code: string; issuer?: string }>;
    current_state?: {
      totalShares: string;
      totalValue: string;
      lastRebalance: number;
    };
  };
  status: string;
  created_at: string;
  updated_at: string;
  performance?: {
    tvl: number;
    returns24h: number | null;
    returns7d: number | null;
    returns30d: number | null;
    returnsAllTime: number | null;
    apyCurrent: number | null;
  };
}

interface Subscription {
  subscription_id: string;
  vault_id: string;
  subscriber_address: string;
  shares: string;
  initial_deposit: string;
  current_value: string;
  subscribed_at: string;
  vault?: Vault;
}

const Vaults = () => {
  const [ownedVaults, setOwnedVaults] = useState<Vault[]>([]);
  const [subscribedVaults, setSubscribedVaults] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [xlmPrice, setXlmPrice] = useState<number>(0.10);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [resolvedTokenNames, setResolvedTokenNames] = useState<Record<string, string>>({});
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
    fetchXLMPrice();
    const priceInterval = setInterval(() => {
      fetchXLMPrice();
    }, 60000);
    return () => clearInterval(priceInterval);
  }, []);

  useEffect(() => {
    if (address) {
      fetchVaults();
    }
  }, [address, network]);

  const fetchXLMPrice = async () => {
    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/price/xlm`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.price) {
          setXlmPrice(data.price);
        }
      }
    } catch (err) {
      console.error('[Vaults] Failed to fetch XLM price:', err);
    }
  };

  const fetchVaults = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);

    try {
      const normalizedNetwork = normalizeNetwork(network, networkPassphrase);
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';

      // Fetch owned vaults
      const ownedResponse = await fetch(
        `${backendUrl}/api/vaults/user/${address}?network=${normalizedNetwork}`
      );
      
      if (ownedResponse.ok) {
        const ownedData = await ownedResponse.json();
        if (ownedData.success) {
          setOwnedVaults(ownedData.data || []);
        }
      }

      // Fetch subscribed vaults
      const subscribedResponse = await fetch(
        `${backendUrl}/api/vaults/subscriptions/${address}?network=${normalizedNetwork}`
      );
      
      if (subscribedResponse.ok) {
        const subscribedData = await subscribedResponse.json();
        if (subscribedData.success) {
          setSubscribedVaults(subscribedData.data || []);
        }
      }
    } catch (err) {
      console.error('[Vaults] Error fetching vaults:', err);
      setError(err instanceof Error ? err.message : 'Failed to load vaults');
    } finally {
      setLoading(false);
    }
  };

  const getResolvedAssetNames = (vault: Vault) => {
    const vaultKey = vault.vault_id;
    const cachedNames = resolvedTokenNames[vaultKey];
    
    if (!cachedNames && vault.config.assets) {
      resolveAssetNames(vault.config.assets, network || 'testnet')
        .then(names => {
          setResolvedTokenNames(prev => ({
            ...prev,
            [vaultKey]: names.join(' / ')
          }));
        })
        .catch(err => {
          console.error('Error resolving token names:', err);
          const fallback = vault.config.assets
            ?.map((a: any) => {
              if (typeof a === 'string') {
                return a.startsWith('C') && a.length > 20 ? `${a.slice(0, 8)}...` : a;
              }
              return a.code || a.assetCode || 'Unknown';
            })
            .join(' / ') || 'Unknown';
          setResolvedTokenNames(prev => ({
            ...prev,
            [vaultKey]: fallback
          }));
        });
      return 'Loading...';
    }
    
    return cachedNames || vault.config.assets?.map((a: any) => typeof a === 'string' ? a : a.code).join(' / ') || 'Unknown';
  };

  const calculateVaultTVL = (vault: Vault) => {
    if (vault.performance?.tvl) {
      return vault.performance.tvl;
    }
    if (vault.config?.current_state?.totalValue) {
      const tvlInXLM = Number(vault.config.current_state.totalValue) / 10_000_000;
      return tvlInXLM * xlmPrice;
    }
    return 0;
  };

  const filteredOwnedVaults = ownedVaults.filter(vault => {
    const matchesSearch = 
      (vault.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (vault.config?.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      vault.vault_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = 
      filterStatus === 'all' || 
      vault.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const filteredSubscribedVaults = subscribedVaults.filter(sub => {
    const vault = sub.vault;
    if (!vault) return false;
    
    const matchesSearch = 
      (vault.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (vault.config?.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      vault.vault_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = 
      filterStatus === 'all' || 
      vault.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const totalOwnedTVL = ownedVaults.reduce((sum, vault) => sum + calculateVaultTVL(vault), 0);
  const totalSubscribedValue = subscribedVaults.reduce((sum, sub) => {
    const currentValue = parseFloat(sub.current_value || '0') / 10_000_000;
    return sum + (currentValue * xlmPrice);
  }, 0);

  const stats = [
    {
      label: 'Owned Vaults',
      value: ownedVaults.length.toString(),
      change: `$${totalOwnedTVL.toFixed(2)} TVL`,
      icon: Crown,
      color: 'primary',
    },
    {
      label: 'Subscriptions',
      value: subscribedVaults.length.toString(),
      change: `$${totalSubscribedValue.toFixed(2)} Value`,
      icon: Users,
      color: 'success',
    },
    {
      label: 'Total Value',
      value: `$${(totalOwnedTVL + totalSubscribedValue).toFixed(2)}`,
      change: `${ownedVaults.length + subscribedVaults.length} total vaults`,
      icon: DollarSign,
      color: 'warning',
    },
    {
      label: 'Active Vaults',
      value: (ownedVaults.filter(v => v.status === 'active').length + 
        subscribedVaults.filter(s => s.vault?.status === 'active').length).toString(),
      change: 'Across all vaults',
      icon: TrendingUp,
      color: 'success',
    },
  ];

  if (!address) {
    return (
      <div className="h-full bg-app flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <AlertCircle className="w-16 h-16 text-primary-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-neutral-50">
            Connect Your Wallet
          </h2>
          <p className="text-neutral-400 mb-8">
            Please connect your wallet to view your vaults
          </p>
        </motion.div>
      </div>
    );
  }

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
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Box className="w-8 h-8 text-primary-500" />
              <h1 className="text-3xl md:text-4xl font-bold text-neutral-50">My Vaults</h1>
            </div>
            <p className="text-neutral-400">
              Manage and monitor all your owned vaults and subscriptions
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-4 bg-card border border-default">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-${stat.color}-500/10 flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 text-${stat.color}-500`} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-neutral-400">{stat.label}</div>
                        <div className="text-xl font-bold text-neutral-50">{stat.value}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">{stat.change}</div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Filters and Search */}
          <Card className="p-4 bg-card border border-default">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex-1 w-full md:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search vaults by name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-secondary border border-default rounded-lg text-neutral-50 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-secondary p-1 rounded-lg">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      filterStatus === 'all'
                        ? 'bg-primary-500 text-dark-950'
                        : 'text-neutral-400 hover:text-neutral-50'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterStatus('active')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      filterStatus === 'active'
                        ? 'bg-primary-500 text-dark-950'
                        : 'text-neutral-400 hover:text-neutral-50'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setFilterStatus('inactive')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      filterStatus === 'inactive'
                        ? 'bg-primary-500 text-dark-950'
                        : 'text-neutral-400 hover:text-neutral-50'
                    }`}
                  >
                    Inactive
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-secondary p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-primary-500 text-dark-950'
                        : 'text-neutral-400 hover:text-neutral-50'
                    }`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'list'
                        ? 'bg-primary-500 text-dark-950'
                        : 'text-neutral-400 hover:text-neutral-50'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="p-5 bg-card border border-default">
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-8 w-1/2" />
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : error ? (
            <Card className="p-8 text-center bg-card">
              <AlertCircle className="w-12 h-12 text-error-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2 text-neutral-50">Error Loading Vaults</h3>
              <p className="text-neutral-400 mb-4">{error}</p>
              <Button onClick={() => fetchVaults()} variant="primary">Try Again</Button>
            </Card>
          ) : (
            <>
              {/* Owned Vaults Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-primary-500" />
                    <h2 className="text-xl font-bold text-neutral-50">Owned Vaults</h2>
                    <span className="text-sm text-neutral-400">({filteredOwnedVaults.length})</span>
                  </div>
                  <Link to="/app/builder">
                    <Button variant="primary" size="sm">
                      Create New Vault
                    </Button>
                  </Link>
                </div>

                {filteredOwnedVaults.length === 0 ? (
                  <Card className="p-8 text-center bg-card">
                    <Package className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-400 mb-2">No owned vaults found</p>
                    <p className="text-neutral-500 text-sm mb-6">
                      Create your first vault to start earning yield
                    </p>
                    <Link to="/app/builder">
                      <Button variant="primary">Create Vault</Button>
                    </Link>
                  </Card>
                ) : (
                  <div className={viewMode === 'grid' 
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
                    : 'space-y-3'
                  }>
                    {filteredOwnedVaults.map((vault, index) => {
                      const assets = getResolvedAssetNames(vault);
                      const vaultTVL = calculateVaultTVL(vault);
                      const apy = vault.performance?.apyCurrent;

                      return (
                        <motion.div
                          key={vault.vault_id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card className="p-5 bg-card border border-default hover:border-primary-500/50 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-base font-semibold text-neutral-50">
                                    {vault.name || vault.config?.name || 'Unnamed Vault'}
                                  </h3>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    vault.status === 'active' 
                                      ? 'bg-success-400/20 text-success-400' 
                                      : 'bg-neutral-700 text-neutral-400'
                                  }`}>
                                    {vault.status}
                                  </span>
                                </div>
                                <p className="text-sm text-neutral-400">{assets}</p>
                                <p className="text-xs text-neutral-500 mt-1">ID: {vault.vault_id.slice(0, 12)}...</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <div className="text-xs text-neutral-500 mb-0.5">TVL</div>
                                <div className="text-lg font-semibold text-neutral-50">
                                  ${vaultTVL > 0 ? vaultTVL.toFixed(2) : '0.00'}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-neutral-500 mb-0.5">APY</div>
                                <div className={`text-lg font-semibold flex items-center gap-1 ${
                                  (apy ?? 0) >= 0 ? 'text-success-400' : 'text-error-400'
                                }`}>
                                  {(apy ?? 0) >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                  {apy !== null && apy !== undefined ? `${apy.toFixed(2)}%` : 'N/A'}
                                </div>
                              </div>
                            </div>

                            <Link to={`/app/vaults/${vault.vault_id}`}>
                              <Button variant="outline" size="sm" className="w-full flex items-center justify-center gap-2">
                                <ExternalLink className="w-4 h-4" />
                                View Details
                              </Button>
                            </Link>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Subscribed Vaults Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-success-400" />
                  <h2 className="text-xl font-bold text-neutral-50">Subscriptions</h2>
                  <span className="text-sm text-neutral-400">({filteredSubscribedVaults.length})</span>
                </div>

                {filteredSubscribedVaults.length === 0 ? (
                  <Card className="p-8 text-center bg-card">
                    <Users className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-400 mb-2">No subscriptions found</p>
                    <p className="text-neutral-500 text-sm mb-6">
                      Browse the marketplace to find vaults to invest in
                    </p>
                    <Link to="/app/marketplace">
                      <Button variant="primary">Browse Marketplace</Button>
                    </Link>
                  </Card>
                ) : (
                  <div className={viewMode === 'grid' 
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
                    : 'space-y-3'
                  }>
                    {filteredSubscribedVaults.map((subscription, index) => {
                      const vault = subscription.vault;
                      if (!vault) return null;

                      const assets = getResolvedAssetNames(vault);
                      const currentValue = (parseFloat(subscription.current_value || '0') / 10_000_000) * xlmPrice;
                      const initialDeposit = (parseFloat(subscription.initial_deposit || '0') / 10_000_000) * xlmPrice;
                      const profitLoss = currentValue - initialDeposit;
                      const profitLossPct = initialDeposit > 0 ? (profitLoss / initialDeposit) * 100 : 0;
                      const shares = parseFloat(subscription.shares || '0') / 10_000_000;

                      return (
                        <motion.div
                          key={subscription.subscription_id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card className="p-5 bg-card border border-default hover:border-success-500/50 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-base font-semibold text-neutral-50">
                                    {vault.name || vault.config?.name || 'Unnamed Vault'}
                                  </h3>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    vault.status === 'active' 
                                      ? 'bg-success-400/20 text-success-400' 
                                      : 'bg-neutral-700 text-neutral-400'
                                  }`}>
                                    {vault.status}
                                  </span>
                                </div>
                                <p className="text-sm text-neutral-400">{assets}</p>
                                <p className="text-xs text-neutral-500 mt-1">Shares: {shares.toFixed(4)}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <div className="text-xs text-neutral-500 mb-0.5">Current Value</div>
                                <div className="text-lg font-semibold text-neutral-50">
                                  ${currentValue.toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-neutral-500 mb-0.5">P&L</div>
                                <div className={`text-lg font-semibold flex items-center gap-1 ${
                                  profitLoss >= 0 ? 'text-success-400' : 'text-error-400'
                                }`}>
                                  {profitLoss >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                  {profitLoss >= 0 ? '+' : ''}${Math.abs(profitLoss).toFixed(2)}
                                  <span className="text-xs">({profitLossPct.toFixed(1)}%)</span>
                                </div>
                              </div>
                            </div>

                            <Link to={`/app/vaults/${vault.vault_id}`}>
                              <Button variant="outline" size="sm" className="w-full flex items-center justify-center gap-2">
                                <ExternalLink className="w-4 h-4" />
                                View Details
                              </Button>
                            </Link>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Vaults;
