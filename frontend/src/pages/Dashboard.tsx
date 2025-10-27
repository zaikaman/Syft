import { motion } from 'framer-motion';
import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Percent, Box, Activity } from 'lucide-react';
import { Card, CardBody, CardHeader, GradientText, Button } from '../components/ui';

const Dashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('7d');

  // Mock data
  const performanceData = [
    { date: 'Jan 1', value: 10000, apy: 12.5 },
    { date: 'Jan 8', value: 10500, apy: 13.2 },
    { date: 'Jan 15', value: 11200, apy: 14.1 },
    { date: 'Jan 22', value: 10800, apy: 13.5 },
    { date: 'Jan 29', value: 11800, apy: 15.2 },
    { date: 'Feb 5', value: 12500, apy: 16.1 },
    { date: 'Feb 12', value: 13200, apy: 17.2 },
  ];

  const allocationData = [
    { name: 'XLM', value: 40, color: '#8b5cf6' },
    { name: 'USDC', value: 30, color: '#3b82f6' },
    { name: 'BTC', value: 20, color: '#ec4899' },
    { name: 'ETH', value: 10, color: '#10b981' },
  ];

  const vaults = [
    {
      id: 1,
      name: 'Stable Yield Vault',
      tvl: '$125,000',
      apy: '15.2%',
      change: '+2.3%',
      status: 'active',
      allocation: 'USDC/XLM',
    },
    {
      id: 2,
      name: 'High Growth Vault',
      tvl: '$87,500',
      apy: '24.7%',
      change: '+5.1%',
      status: 'active',
      allocation: 'BTC/ETH',
    },
    {
      id: 3,
      name: 'Conservative Vault',
      tvl: '$203,000',
      apy: '8.9%',
      change: '+1.2%',
      status: 'active',
      allocation: 'USDC',
    },
  ];

  const stats = [
    {
      label: 'Total Value Locked',
      value: '$415,500',
      change: '+12.5%',
      icon: DollarSign,
      color: 'from-purple-600 to-blue-600',
      isPositive: true,
    },
    {
      label: 'Average APY',
      value: '16.3%',
      change: '+2.1%',
      icon: Percent,
      color: 'from-blue-600 to-cyan-600',
      isPositive: true,
    },
    {
      label: 'Active Vaults',
      value: '3',
      change: 'All Active',
      icon: Box,
      color: 'from-pink-600 to-purple-600',
      isPositive: true,
    },
    {
      label: 'Total Earnings',
      value: '$32,450',
      change: '+8.7%',
      icon: TrendingUp,
      color: 'from-green-600 to-emerald-600',
      isPositive: true,
    },
  ];

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
                    <span className="text-sm font-semibold text-white">{asset.value}%</span>
                  </div>
                ))}
              </div>
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
              <Button variant="gradient">Create New Vault</Button>
            </div>

            <div className="space-y-4">
              {vaults.map((vault, index) => (
                <motion.div
                  key={vault.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                >
                  <Card hover className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                      <div className="md:col-span-2">
                        <h3 className="text-lg font-bold text-white mb-1">{vault.name}</h3>
                        <p className="text-sm text-gray-400">{vault.allocation}</p>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 mb-1">TVL</div>
                        <div className="text-lg font-bold text-white">{vault.tvl}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 mb-1">APY</div>
                        <div className="text-lg font-bold text-green-400">{vault.apy}</div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-4">
                        <div className="flex items-center gap-1 text-sm font-semibold text-green-400">
                          <TrendingUp className="w-4 h-4" />
                          {vault.change}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-sm text-gray-400 capitalize">{vault.status}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
