import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, Button } from '../components/ui';
import { Lightbulb, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { useWallet } from '../providers/WalletProvider';

interface Vault {
  vault_id: string;
  name: string;
  config?: {
    name?: string;
    assets?: any[];
  };
  performance?: {
    tvl?: number;
    returns30d?: number | null;
    returns7d?: number | null;
    apyCurrent?: number | null;
  };
  status?: string;
}

interface Suggestion {
  id: string;
  vaultId: string;
  type: 'rebalance' | 'add_asset' | 'remove_asset' | 'adjust_rule' | 'risk_adjustment';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  rationale: string;
  expectedImpact: {
    returnIncrease?: number;
    riskReduction?: number;
    efficiencyGain?: number;
  };
  implementation: {
    steps: string[];
    difficulty: 'easy' | 'moderate' | 'advanced';
    estimatedTime: string;
  };
  dataSupport?: {
    sentiment?: any;
    forecast?: any;
    analysis?: any;
  };
  configChanges?: any;
  createdAt: string;
  expiresAt?: string;
}

const Suggestions = () => {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_suggestionsError, setSuggestionsError] = useState<string | null>(null);
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
      fetchVaults();
    }
  }, [address, network]);

  useEffect(() => {
    if (selectedVault) {
      fetchSuggestions();
    }
  }, [selectedVault]);

  const fetchVaults = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);

    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const normalizedNetwork = normalizeNetwork(network, networkPassphrase);
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

  const fetchSuggestions = async (forceRefresh = false) => {
    if (!selectedVault) return;
    
    setLoadingSuggestions(true);
    setSuggestionsError(null);

    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      // First try to get cached suggestions (GET endpoint)
      if (!forceRefresh) {
        const getResponse = await fetch(`${backendUrl}/api/vaults/${selectedVault}/suggestions`);
        
        if (getResponse.ok) {
          const getData = await getResponse.json();
          if (getData.success && getData.suggestions?.length > 0) {
            setSuggestions(getData.suggestions);
            setLoadingSuggestions(false);
            return;
          }
        }
      }

      // Generate new AI suggestions (POST endpoint)
      const postResponse = await fetch(`${backendUrl}/api/vaults/${selectedVault}/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          forceRefresh,
          userPreferences: {
            riskTolerance: 'medium',
            timeHorizon: 'medium',
            focusAreas: ['performance', 'risk', 'diversification'],
          },
        }),
      });

      if (!postResponse.ok) {
        throw new Error('Failed to generate suggestions');
      }

      const postData = await postResponse.json();
      if (postData.success) {
        setSuggestions(postData.suggestions || []);
      } else {
        throw new Error(postData.error || 'Failed to generate suggestions');
      }
    } catch (err: any) {
      console.error('Error fetching suggestions:', err);
      setSuggestionsError(err.message);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const generateNewSuggestions = async () => {
    await fetchSuggestions(true); // Force refresh to generate new AI suggestions
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-error-400 bg-error-400/10';
      case 'medium': return 'text-warning-400 bg-warning-400/10';
      case 'low': return 'text-success-400 bg-success-400/10';
      default: return 'text-neutral-400 bg-neutral-400/10';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'rebalance': return '⚖️';
      case 'add_asset': return '➕';
      case 'remove_asset': return '➖';
      case 'adjust_rule': return '⚙️';
      case 'risk_adjustment': return '🛡️';
      default: return '📊';
    }
  };

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-success-400/10 text-success-400';
      case 'moderate': return 'bg-warning-400/10 text-warning-400';
      case 'advanced': return 'bg-error-400/10 text-error-400';
      default: return 'bg-neutral-400/10 text-neutral-400';
    }
  };

  if (!address) {
    return (
      <div className="h-full bg-app flex items-center justify-center p-4">
        <Card className="p-8 text-center bg-card max-w-md border border-default">
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
        <Card className="p-8 text-center bg-card max-w-md border border-default">
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
        <Card className="p-12 text-center bg-card max-w-lg border border-default">
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-neutral-50 mb-2 flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-primary-500" />
                AI Optimization Suggestions
              </h1>
              <p className="text-neutral-400">
                Get intelligent recommendations to improve your vault's performance and maximize returns
              </p>
            </div>
            <Button
              variant="outline"
              size="md"
              onClick={fetchVaults}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>

          {/* Vault Selector */}
          <Card className="p-6 bg-card border border-default">
            <div className="mb-5">
              <h3 className="text-lg font-bold text-neutral-50 mb-1">Select Vault</h3>
              <p className="text-sm text-neutral-400">Choose a vault to receive personalized suggestions</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {vaults.map((vault) => {
                const perfValue = vault.performance?.returns30d ?? vault.performance?.apyCurrent ?? vault.performance?.returns7d ?? 0;
                const tvl = vault.performance?.tvl ?? 0;
                const assets = vault.config?.assets?.map((a: any) => typeof a === 'string' ? a : a.code).join(' / ') || 'Unknown';

                return (
                  <motion.div
                    key={vault.vault_id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      hover
                      className={`p-4 cursor-pointer transition-all ${
                        selectedVault === vault.vault_id 
                          ? 'bg-primary-500/10 border-2 border-primary-500' 
                          : 'bg-neutral-900 border border-default'
                      }`}
                      onClick={() => setSelectedVault(vault.vault_id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-neutral-50 truncate">
                            {vault.config?.name || vault.name || 'Unnamed Vault'}
                          </h4>
                          <p className="text-xs text-neutral-400 mt-0.5">{assets}</p>
                        </div>
                        {selectedVault === vault.vault_id && (
                          <Sparkles className="w-4 h-4 text-primary-500 flex-shrink-0 ml-2" />
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-neutral-500">Performance</div>
                          <div className={`font-semibold ${perfValue >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                            {perfValue >= 0 ? '+' : ''}{Number(perfValue).toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-neutral-500">TVL</div>
                          <div className="font-semibold text-neutral-50">
                            ${tvl.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-2 flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${vault.status === 'active' ? 'bg-success-400' : 'bg-neutral-400'}`} />
                        <span className="text-xs text-neutral-400 capitalize">{vault.status || 'active'}</span>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
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
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-warning-400/10 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-warning-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-neutral-50">
                        Suggestions for {selectedVaultData?.config?.name || selectedVaultData?.name}
                      </h3>
                      <p className="text-sm text-neutral-400 mt-1">
                        AI-powered recommendations based on market conditions and performance analysis
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={generateNewSuggestions}
                    disabled={loadingSuggestions}
                    className="flex items-center gap-2"
                  >
                    {loadingSuggestions ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Get New Suggestions
                      </>
                    )}
                  </Button>
                </div>

                {loadingSuggestions ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-4"></div>
                    <p className="text-neutral-400">Generating AI suggestions...</p>
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="text-center py-12">
                    <Lightbulb className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                    <p className="text-neutral-400 mb-2">No suggestions yet</p>
                    <p className="text-sm text-neutral-500 mb-4">Click "Get New Suggestions" to generate AI recommendations</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {suggestions.map((suggestion, index) => {
                      const hasImpact = suggestion.expectedImpact?.returnIncrease || 
                                       suggestion.expectedImpact?.riskReduction || 
                                       suggestion.expectedImpact?.efficiencyGain;
                      
                      return (
                        <motion.div
                          key={suggestion.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Card className="p-5 bg-neutral-900 border border-default hover:border-primary-500/50 transition-all h-full flex flex-col">
                            <div className="flex items-start justify-between mb-3">
                              <span className="text-2xl">{getTypeIcon(suggestion.type)}</span>
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(suggestion.priority)}`}>
                                {suggestion.priority} priority
                              </span>
                            </div>
                            
                            <h4 className="font-bold text-neutral-50 mb-2">{suggestion.title}</h4>
                            <p className="text-sm text-neutral-400 mb-3">{suggestion.description}</p>
                            
                            {suggestion.rationale && (
                              <p className="text-xs text-neutral-500 mb-3 italic">
                                💡 {suggestion.rationale}
                              </p>
                            )}

                            {hasImpact && (
                              <div className="mb-3 p-2 bg-neutral-950 rounded-md">
                                <div className="text-xs font-semibold text-neutral-400 mb-1">Expected Impact:</div>
                                <div className="space-y-1 text-xs">
                                  {suggestion.expectedImpact.returnIncrease && (
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">Return:</span>
                                      <span className="text-success-400">+{suggestion.expectedImpact.returnIncrease}%</span>
                                    </div>
                                  )}
                                  {suggestion.expectedImpact.riskReduction && (
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">Risk:</span>
                                      <span className="text-success-400">-{suggestion.expectedImpact.riskReduction}%</span>
                                    </div>
                                  )}
                                  {suggestion.expectedImpact.efficiencyGain && (
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">Efficiency:</span>
                                      <span className="text-success-400">+{suggestion.expectedImpact.efficiencyGain}%</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="mt-auto">
                              <div className="flex items-center justify-between text-xs text-neutral-500 mb-3">
                                <span className={`px-2 py-1 rounded ${getDifficultyBadge(suggestion.implementation.difficulty)}`}>
                                  {suggestion.implementation.difficulty}
                                </span>
                                <span>⏱️ {suggestion.implementation.estimatedTime}</span>
                              </div>
                              
                              {suggestion.implementation.steps.length > 0 && (
                                <Button variant="outline" size="sm" className="w-full">
                                  View Implementation
                                </Button>
                              )}
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* Info Card */}
          <Card className="p-6 bg-gradient-to-br from-primary-500/10 to-primary-600/10 border border-primary-500/30">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <h4 className="font-bold text-neutral-50 mb-2">How AI Suggestions Work</h4>
                <p className="text-sm text-neutral-400 mb-3">
                  Our AI analyzes market trends, historical performance, and risk metrics to provide
                  personalized optimization suggestions for your vaults.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-neutral-400">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary-500" />
                    <span>Real-time market analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary-500" />
                    <span>Risk-adjusted optimization</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary-500" />
                    <span>Asset allocation improvements</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary-500" />
                    <span>Rebalancing recommendations</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Suggestions;
