import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, Button } from '../components/ui';
import BacktestConfig from '../components/backtest/BacktestConfig';
import BacktestResults from '../components/backtest/BacktestResults';
import BacktestProgress from '../components/backtest/BacktestProgress';
import StrategyComparison from '../components/backtest/StrategyComparison';
import { Activity, TrendingUp, AlertCircle } from 'lucide-react';
import { useWallet } from '../providers/WalletProvider';

const Backtests = () => {
  const [activeTab, setActiveTab] = useState<'new' | 'results' | 'compare'>('new');
  const [isRunning, setIsRunning] = useState(false);
  const [backtestResults, setBacktestResults] = useState<any[]>([]);
  const { address } = useWallet();

  const handleStartBacktest = (config: any) => {
    setIsRunning(true);
    // Simulate backtest completion after a delay
    setTimeout(() => {
      const result = {
        id: Date.now(),
        config,
        results: {
          totalReturn: 23.45,
          sharpeRatio: 1.8,
          maxDrawdown: -12.3,
          winRate: 68.5,
          trades: 247,
          avgReturn: 0.95,
        },
        completedAt: new Date().toISOString(),
      };
      setBacktestResults([result, ...backtestResults]);
      setIsRunning(false);
      setActiveTab('results');
    }, 3000);
  };

  const tabs = [
    { id: 'new', label: 'New Backtest', icon: Activity },
    { id: 'results', label: 'Results', icon: TrendingUp },
    { id: 'compare', label: 'Compare', icon: TrendingUp },
  ];

  if (!address) {
    return (
      <div className="h-full bg-app flex items-center justify-center p-4">
        <Card className="p-8 text-center bg-card max-w-md">
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-neutral-50 mb-2">Strategy Backtesting</h1>
            <p className="text-neutral-400">
              Test your vault strategies against historical data to optimize performance
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 bg-secondary p-1 rounded-lg mb-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
                    activeTab === tab.id
                      ? 'bg-primary-500 text-white'
                      : 'text-neutral-400 hover:text-neutral-50 hover:bg-neutral-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          {isRunning ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <BacktestProgress 
                message="Running backtest simulation..."
                details="Analyzing historical data and calculating metrics"
                progress={50}
              />
            </motion.div>
          ) : (
            <>
              {activeTab === 'new' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <BacktestConfig onStart={handleStartBacktest} />
                </motion.div>
              )}

              {activeTab === 'results' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {backtestResults.length === 0 ? (
                    <Card className="p-12 text-center bg-card">
                      <AlertCircle className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-neutral-50 mb-2">No Backtest Results</h3>
                      <p className="text-neutral-400 mb-6">
                        Run your first backtest to see results here
                      </p>
                      <Button onClick={() => setActiveTab('new')} variant="primary">
                        Create New Backtest
                      </Button>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {backtestResults.map((result) => (
                        <BacktestResults 
                          key={result.id}
                          metrics={result.results}
                          portfolioValueHistory={[]}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'compare' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {backtestResults.length < 2 ? (
                    <Card className="p-12 text-center bg-card">
                      <AlertCircle className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-neutral-50 mb-2">Not Enough Results</h3>
                      <p className="text-neutral-400 mb-6">
                        Run at least 2 backtests to compare strategies
                      </p>
                      <Button onClick={() => setActiveTab('new')} variant="primary">
                        Create New Backtest
                      </Button>
                    </Card>
                  ) : (
                    <StrategyComparison 
                      vaultStrategy={backtestResults[0]?.results || {}}
                      buyAndHoldReturn={15.5}
                    />
                  )}
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Backtests;
