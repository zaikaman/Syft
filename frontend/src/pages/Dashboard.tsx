import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, DollarSign, Percent, Box, Activity, AlertCircle } from 'lucide-react';
import { Card, Button } from '../components/ui';
import { useWallet } from '../providers/WalletProvider';
import { Link } from 'react-router-dom';

interface Vault {
  vault_id: string;
  owner: string;
  contract_address: string;
  config: {
    name: string;
    assets: Array<{ code: string; issuer?: string }>;
  };
  status: string;
  created_at: string;
  updated_at: string;
}

const Dashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { address } = useWallet();

  useEffect(() => {
    if (address) {
      fetchVaults();
    } else {
      setLoading(false);
    }
  }, [address]);

  const fetchVaults = async () => {
    try {
      setLoading(true);
      setError(null);

      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/vaults/user/${address}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch vaults');
      }

      const data = await response.json();
      
      if (data.success) {
        setVaults(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch vaults');
      }
    } catch (err) {
      console.error('Error fetching vaults:', err);
      setError(err instanceof Error ? err.message : 'Failed to load vaults');
      setVaults([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats from real vault data
  const stats = [
    {
      label: 'Total Value Locked',
      value: vaults.length > 0 ? '$0.00' : '$0.00', // Would need to fetch balances
      change: 'N/A',
      icon: DollarSign,
      isPositive: true,
    },
    {
      label: 'Average APY',
      value: 'N/A', // Would need performance data
      change: 'N/A',
      icon: Percent,
      isPositive: true,
    },
    {
      label: 'Active Vaults',
      value: vaults.length.toString(),
      change: vaults.filter(v => v.status === 'active').length === vaults.length ? 'All Active' : 'Some Inactive',
      icon: Box,
      isPositive: true,
    },
    {
      label: 'Total Earnings',
      value: '$0.00', // Would need performance data
      change: 'N/A',
      icon: TrendingUp,
      isPositive: true,
    },
  ];

  // Placeholder data for charts (would need to fetch from API)
  const performanceData = [
    { date: 'Day 1', value: 0, apy: 0 },
    { date: 'Day 2', value: 0, apy: 0 },
    { date: 'Day 3', value: 0, apy: 0 },
    { date: 'Day 4', value: 0, apy: 0 },
    { date: 'Day 5', value: 0, apy: 0 },
    { date: 'Day 6', value: 0, apy: 0 },
    { date: 'Day 7', value: 0, apy: 0 },
  ];

  // Calculate allocation from vaults
  const allocationData = vaults.length > 0
    ? vaults.flatMap(v => v.config.assets || [])
        .reduce((acc, asset) => {
          const existing = acc.find(a => a.name === asset.code);
          if (existing) {
            existing.value += 1;
          } else {
            acc.push({
              name: asset.code,
              value: 1,
              color: ['#dce85d', '#74b97f', '#60a5fa', '#e06c6e', '#dca204'][acc.length % 5]
            });
          }
          return acc;
        }, [] as Array<{ name: string; value: number; color: string }>)
    : [];

  // Show wallet connection prompt if not connected
  if (!address) {
    return (
      <div className="min-h-screen pt-16 pb-12 bg-app">
        <div className="container mx-auto px-4 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <AlertCircle className="w-16 h-16 text-primary-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-neutral-50">
              Connect Your Wallet
            </h2>
            <p className="text-neutral-400 mb-8">
              Please connect your wallet to view your dashboard
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 pb-12 bg-app">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-neutral-50">
            Dashboard
          </h1>
          <p className="text-neutral-400">
            Monitor your vaults and track performance
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card hover className="p-4 bg-card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary-500" />
                    </div>
                    <div className={`text-xs font-medium ${stat.isPositive ? 'text-success-400' : 'text-error-400'}`}>
                      {stat.change}
                    </div>
                  </div>
                  <div className="text-2xl font-bold mb-1 text-neutral-50">
                    {stat.value}
                  </div>
                  <div className="text-sm text-neutral-400">{stat.label}</div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Performance Chart */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="p-5 bg-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-neutral-50">Portfolio Performance</h2>
                <div className="flex gap-1">
                  {['24h', '7d', '30d', '1y'].map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        selectedPeriod === period
                          ? 'bg-primary-500 text-dark-950'
                          : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dce85d" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#dce85d" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" stroke="#71717a" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#71717a" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#16181a',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#dce85d"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Asset Allocation */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-5 bg-card">
              <h2 className="text-lg font-bold mb-4 text-neutral-50">Asset Allocation</h2>
              {allocationData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {allocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#16181a',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-2">
                    {allocationData.map((asset, idx) => (
                      <div key={`${asset.name}-${idx}`} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: asset.color }} />
                          <span className="text-sm text-neutral-300">{asset.name}</span>
                        </div>
                        <span className="text-sm font-medium text-neutral-50">{asset.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-neutral-400 text-sm">No assets yet</p>
                  <p className="text-neutral-500 text-xs mt-1">Create a vault to see allocation</p>
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Active Vaults */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-5 bg-card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2 text-neutral-50">
                <Activity className="w-5 h-5 text-primary-500" />
                Active Vaults
              </h2>
              <Link to="/builder">
                <Button variant="primary" size="md">Create New Vault</Button>
              </Link>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                <p className="text-neutral-400 mt-4 text-sm">Loading vaults...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-error-400 mx-auto mb-4" />
                <p className="text-error-400 mb-2">Failed to load vaults</p>
                <p className="text-neutral-400 text-sm mb-4">{error}</p>
                <Button onClick={fetchVaults} variant="outline">Try Again</Button>
              </div>
            ) : vaults.length === 0 ? (
              <div className="text-center py-12">
                <Box className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                <p className="text-neutral-400 mb-2">No vaults yet</p>
                <p className="text-neutral-500 text-sm mb-6">
                  Create your first vault to start earning yield
                </p>
                <Link to="/builder">
                  <Button variant="primary">Create Vault</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {vaults.map((vault, index) => {
                  const assets = vault.config.assets?.map(a => a.code).join('/') || 'Unknown';
                  
                  return (
                    <motion.div
                      key={vault.vault_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.05 }}
                    >
                      <Card hover className="p-4 bg-neutral-900">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                          <div className="md:col-span-2">
                            <h3 className="text-base font-semibold text-neutral-50 mb-1">{vault.config.name || 'Unnamed Vault'}</h3>
                            <p className="text-sm text-neutral-400">{assets}</p>
                            <p className="text-xs text-neutral-500 mt-0.5">ID: {vault.vault_id.slice(0, 8)}...</p>
                          </div>
                          <div>
                            <div className="text-xs text-neutral-500 mb-0.5">TVL</div>
                            <div className="text-base font-semibold text-neutral-50">N/A</div>
                          </div>
                          <div>
                            <div className="text-xs text-neutral-500 mb-0.5">APY</div>
                            <div className="text-base font-semibold text-success-400">N/A</div>
                          </div>
                          <div className="flex items-center justify-between md:justify-end gap-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${vault.status === 'active' ? 'bg-success-400' : 'bg-neutral-400'}`} />
                              <span className="text-xs text-neutral-400 capitalize">{vault.status}</span>
                            </div>
                            <Link to={`/vaults/${vault.vault_id}`}>
                              <Button size="sm" variant="outline">View</Button>
                            </Link>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
