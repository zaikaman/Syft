import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, Button } from '../components/ui';
import { AISuggestions } from '../components/ai/AISuggestions';
import { Lightbulb, Sparkles, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { useWallet } from '../providers/WalletProvider';

interface Vault {
  vault_id: string;
  name: string;
  performance: number;
  total_value: number;
}

const Suggestions = () => {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { address } = useWallet();

  useEffect(() => {
    if (address) {
      fetchVaults();
    }
  }, [address]);

  const fetchVaults = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);

    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const normalizedNetwork = 'futurenet';
      const response = await fetch(
        `${backendUrl}/api/vaults/user/${address}?network=${normalizedNetwork}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch vaults');
      }

      const data = await response.json();
      if (data.success) {
        const vaultList = data.data || [];
        setVaults(vaultList);
        if (vaultList.length > 0 && !selectedVault) {
          setSelectedVault(vaultList[0].vault_id);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch vaults:', err);
      setError(err.message || 'Failed to load vaults');
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestion = (suggestion: any) => {
    console.log('Applied suggestion:', suggestion);
    // Refresh suggestions after applying
    fetchVaults();
  };

  if (!address) {
    return (
      <div className="h-full bg-app flex items-center justify-center p-4">
        <Card className="p-8 text-center bg-card max-w-md">
          <Sparkles className="w-12 h-12 text-primary-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-neutral-50">Connect Your Wallet</h2>
          <p className="text-neutral-400">
            Connect your wallet to receive AI-powered optimization suggestions for your vaults
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
          <p className="text-neutral-400">Loading vaults...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-app flex items-center justify-center p-4">
        <Card className="p-8 text-center bg-card max-w-md">
          <AlertCircle className="w-12 h-12 text-error-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-neutral-50">Error Loading Vaults</h2>
          <p className="text-neutral-400 mb-4">{error}</p>
          <Button onClick={fetchVaults} variant="primary">Try Again</Button>
        </Card>
      </div>
    );
  }

  if (vaults.length === 0) {
    return (
      <div className="h-full bg-app flex items-center justify-center p-4">
        <Card className="p-12 text-center bg-card max-w-lg">
          <Lightbulb className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-neutral-50">No Vaults Found</h2>
          <p className="text-neutral-400 mb-6">
            Create a vault to start receiving AI-powered optimization suggestions
          </p>
          <Button variant="primary" onClick={() => window.location.href = '/app/builder'}>
            Create Your First Vault
          </Button>
        </Card>
      </div>
    );
  }

  const selectedVaultData = vaults.find(v => v.vault_id === selectedVault);

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
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-8 h-8 text-primary-500" />
              <h1 className="text-3xl font-bold text-neutral-50">AI Optimization Suggestions</h1>
            </div>
            <p className="text-neutral-400">
              Get intelligent recommendations to improve your vault's performance and maximize returns
            </p>
          </div>

          {/* Vault Selector */}
          <Card className="p-6 bg-card border border-default">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-50">Select Vault</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchVaults}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {vaults.map((vault) => (
                <button
                  key={vault.vault_id}
                  onClick={() => setSelectedVault(vault.vault_id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedVault === vault.vault_id
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-default hover:border-primary-500/50 bg-neutral-900'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-neutral-50">{vault.name}</h4>
                    {selectedVault === vault.vault_id && (
                      <Sparkles className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-success-400" />
                      <span className={vault.performance >= 0 ? 'text-success-400' : 'text-error-400'}>
                        {vault.performance >= 0 ? '+' : ''}{vault.performance.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-neutral-400">
                      ${vault.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* AI Suggestions */}
          {selectedVault && (
            <motion.div
              key={selectedVault}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-6 bg-card border border-default">
                <div className="flex items-center gap-3 mb-6">
                  <Lightbulb className="w-6 h-6 text-warning-400" />
                  <div>
                    <h3 className="text-xl font-bold text-neutral-50">
                      Suggestions for {selectedVaultData?.name}
                    </h3>
                    <p className="text-sm text-neutral-400 mt-1">
                      AI-powered recommendations based on market conditions and performance analysis
                    </p>
                  </div>
                </div>

                <AISuggestions
                  vaultId={selectedVault}
                  onApplySuggestion={handleApplySuggestion}
                />
              </Card>
            </motion.div>
          )}

          {/* Info Card */}
          <Card className="p-6 bg-gradient-to-br from-primary-500/10 to-primary-600/10 border border-primary-500/30">
            <div className="flex items-start gap-4">
              <Sparkles className="w-6 h-6 text-primary-500 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-neutral-50 mb-2">How AI Suggestions Work</h4>
                <p className="text-sm text-neutral-400 mb-3">
                  Our AI analyzes market trends, historical performance, and risk metrics to provide
                  personalized optimization suggestions for your vaults.
                </p>
                <ul className="text-sm text-neutral-400 space-y-1">
                  <li>• Real-time market analysis</li>
                  <li>• Risk-adjusted optimization</li>
                  <li>• Asset allocation improvements</li>
                  <li>• Rebalancing recommendations</li>
                </ul>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Suggestions;
