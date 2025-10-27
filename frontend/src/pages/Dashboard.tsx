import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Percent, Box, Activity, AlertCircle } from 'lucide-react';
import { Card, CardBody, CardHeader, GradientText, Button } from '../components/ui';
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
      const response = await fetch(`${backendUrl}/api/vaults?owner=${address}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch vaults');
      }

      const data = await response.json();
      
      if (data.success) {
        setVaults(data.data.vaults || []);
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
      color: 'from-purple-600 to-blue-600',
      isPositive: true,
    },
    {
      label: 'Average APY',
      value: 'N/A', // Would need performance data
      change: 'N/A',
      icon: Percent,
      color: 'from-blue-600 to-cyan-600',
      isPositive: true,
    },
    {
      label: 'Active Vaults',
      value: vaults.length.toString(),
      change: vaults.filter(v => v.status === 'active').length === vaults.length ? 'All Active' : 'Some Inactive',
      icon: Box,
      color: 'from-pink-600 to-purple-600',
      isPositive: true,
    },
    {
      label: 'Total Earnings',
      value: '$0.00', // Would need performance data
      change: 'N/A',
      icon: TrendingUp,
      color: 'from-green-600 to-emerald-600',
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
              color: ['#8b5cf6', '#3b82f6', '#ec4899', '#10b981', '#f59e0b'][acc.length % 5]
            });
          }
          return acc;
        }, [] as Array<{ name: string; value: number; color: string }>)
    : [];

  // Show wallet connection prompt if not connected
  if (!address) {
    return (
      <div className="min-h-screen pt-20 pb-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <AlertCircle className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              <GradientText>Connect Your Wallet</GradientText>
            </h2>
            <p className="text-gray-400 mb-8">
              Please connect your wallet to view your dashboard
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            <GradientText>Dashboard</GradientText>
          </h1>
          <p className="text-gray-400 text-lg">
            Monitor your vaults and track performance
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card hover glow className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-semibold ${stat.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {stat.isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {stat.change}
                    </div>
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    <GradientText>{stat.value}</GradientText>
                  </div>
                  <div className="text-sm text-gray-400">{stat.label}</div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Performance Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="p-6">
              <CardHeader className="p-0 mb-6 border-none">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Portfolio Performance</h2>
                  <div className="flex gap-2">
                    {['24h', '7d', '30d', '1y'].map((period) => (
                      <button
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          selectedPeriod === period
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="date" stroke="#888" />
                    <YAxis stroke="#888" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1a24',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </motion.div>

          {/* Asset Allocation */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-6">Asset Allocation</h2>
              {allocationData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {allocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a24',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {allocationData.map((asset) => (
                      <div key={asset.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color }} />
                          <span className="text-sm text-gray-300">{asset.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-white">{asset.value} vault(s)</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400">No assets yet</p>
                  <p className="text-gray-500 text-sm mt-2">Create a vault to see allocation</p>
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Active Vaults */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-6 h-6 text-purple-400" />
                Active Vaults
              </h2>
              <Link to="/builder">
                <Button variant="gradient">Create New Vault</Button>
              </Link>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                <p className="text-gray-400 mt-4">Loading vaults...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-400 mb-2">Failed to load vaults</p>
                <p className="text-gray-400 text-sm mb-4">{error}</p>
                <Button onClick={fetchVaults}>Try Again</Button>
              </div>
            ) : vaults.length === 0 ? (
              <div className="text-center py-12">
                <Box className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">No vaults yet</p>
                <p className="text-gray-500 text-sm mb-6">
                  Create your first vault to start earning yield
                </p>
                <Link to="/builder">
                  <Button variant="gradient">Create Vault</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {vaults.map((vault, index) => {
                  const assets = vault.config.assets?.map(a => a.code).join('/') || 'Unknown';
                  
                  return (
                    <motion.div
                      key={vault.vault_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                    >
                      <Card hover className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                          <div className="md:col-span-2">
                            <h3 className="text-lg font-bold text-white mb-1">{vault.config.name || 'Unnamed Vault'}</h3>
                            <p className="text-sm text-gray-400">{assets}</p>
                            <p className="text-xs text-gray-500 mt-1">ID: {vault.vault_id.slice(0, 8)}...</p>
                          </div>
                          <div>
                            <div className="text-sm text-gray-400 mb-1">TVL</div>
                            <div className="text-lg font-bold text-white">N/A</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-400 mb-1">APY</div>
                            <div className="text-lg font-bold text-green-400">N/A</div>
                          </div>
                          <div className="flex items-center justify-between md:justify-end gap-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${vault.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                              <span className="text-sm text-gray-400 capitalize">{vault.status}</span>
                            </div>
                            <Link to={`/vaults/${vault.vault_id}`}>
                              <Button size="sm">View Details</Button>
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
