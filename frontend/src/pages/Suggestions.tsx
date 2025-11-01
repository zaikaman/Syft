import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, Skeleton } from '../components/ui';
import { Lightbulb, Sparkles, AlertCircle, RefreshCw, X, CheckCircle, TrendingUp, Shield, Zap } from 'lucide-react';
import { useWallet } from '../providers/WalletProvider';
import { resolveAssetNames } from '../services/tokenService';

interface Vault {
  vault_id: string;
  name?: string;
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
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionsMessage, setSuggestionsMessage] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showImplementationModal, setShowImplementationModal] = useState(false);
  const [resolvedTokenNames, setResolvedTokenNames] = useState<Record<string, string>>({}); // Cache for resolved token names
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
    setSuggestionsMessage(null);

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
      console.log(`[Frontend] Requesting suggestions for vault: ${selectedVault}`);
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
      console.log('[Frontend] Received response:', postData);
      
      if (postData.success) {
        setSuggestions(postData.suggestions || []);
        
        // Check if there's a message from the backend
        if (postData.meta?.message) {
          setSuggestionsMessage(postData.meta.message);
          console.warn('[Frontend] Backend message:', postData.meta.message);
        }
        
        // Log empty suggestions
        if (!postData.suggestions || postData.suggestions.length === 0) {
          console.warn('[Frontend] Received empty suggestions array');
        }
      } else {
        throw new Error(postData.error || 'Failed to generate suggestions');
      }
    } catch (err: any) {
      console.error('[Frontend] Error fetching suggestions:', err);
      setSuggestionsError(err.message);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const generateNewSuggestions = async () => {
    await fetchSuggestions(true); // Force refresh to generate new AI suggestions
  };

  const handleViewImplementation = (suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion);
    setShowImplementationModal(true);
  };

  const handleCloseModal = () => {
    setShowImplementationModal(false);
    setSelectedSuggestion(null);
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
      <div className="h-full bg-app overflow-auto">
        <div className="container mx-auto px-4 py-8 pb-16 max-w-7xl">
          <div className="space-y-6 pb-8">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <Skeleton className="h-9 w-80" />
                </div>
                <Skeleton className="h-5 w-96" />
              </div>
              <Skeleton className="h-10 w-24" />
            </div>

            {/* Vault Selector Skeleton */}
            <Card className="p-6 bg-card border border-default">
              <div className="mb-5">
                <Skeleton className="h-6 w-32 mb-1" />
                <Skeleton className="h-4 w-96" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="p-4 bg-neutral-900 border border-default">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <Skeleton className="h-5 w-32 mb-2" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <Skeleton className="h-3 w-20 mb-1" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                      <div>
                        <Skeleton className="h-3 w-12 mb-1" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-1.5 h-1.5 rounded-full" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </Card>
                ))}
              </div>
            </Card>

            {/* AI Suggestions Skeleton */}
            <Card className="p-6 bg-card border border-default">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div>
                    <Skeleton className="h-6 w-64 mb-2" />
                    <Skeleton className="h-4 w-96" />
                  </div>
                </div>
                <Skeleton className="h-10 w-48" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="p-5 bg-secondary border border-default">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <div>
                          <Skeleton className="h-5 w-32 mb-2" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                    </div>
                    
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-5/6 mb-4" />
                    
                    <div className="space-y-2 mb-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4/5" />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[...Array(3)].map((_, j) => (
                        <div key={j}>
                          <Skeleton className="h-3 w-16 mb-1" />
                          <Skeleton className="h-5 w-12" />
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <Skeleton className="h-9 flex-1" />
                      <Skeleton className="h-9 w-9" />
                    </div>
                  </Card>
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
      <div className="container mx-auto px-4 py-8 pb-16 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6 pb-8"
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
                
                // Get resolved token names from cache or use fallback
                const vaultKey = vault.vault_id;
                const cachedNames = resolvedTokenNames[vaultKey];
                let assets = cachedNames || 'Loading...';
                
                // Resolve token names asynchronously if not cached
                if (!cachedNames && vault.config?.assets) {
                  resolveAssetNames(vault.config.assets, network || 'testnet')
                    .then(names => {
                      setResolvedTokenNames(prev => ({
                        ...prev,
                        [vaultKey]: names.join(' / ')
                      }));
                    })
                    .catch(err => {
                      console.error('Error resolving token names:', err);
                      // Fallback
                      const fallback = vault.config?.assets
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
                }

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
                            {vault.name || vault.config?.name || 'Unnamed Vault'}
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
                    <Skeleton className="h-8 w-32 mx-auto mb-4" />
                    <p className="text-neutral-400">Generating AI suggestions...</p>
                  </div>
                ) : suggestionsError ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-error-400 mx-auto mb-3" />
                    <p className="text-neutral-50 font-semibold mb-2">Failed to Generate Suggestions</p>
                    <p className="text-sm text-neutral-400 mb-4">{suggestionsError}</p>
                    <Button
                      variant="outline"
                      size="md"
                      onClick={generateNewSuggestions}
                    >
                      Try Again
                    </Button>
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="text-center py-12">
                    <Lightbulb className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                    <p className="text-neutral-400 mb-2">No suggestions generated</p>
                    {suggestionsMessage ? (
                      <div className="bg-warning-400/10 border border-warning-400/30 rounded-lg p-4 mb-4 max-w-2xl mx-auto">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-warning-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-neutral-300 text-left">{suggestionsMessage}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500 mb-4">Click "Get New Suggestions" to generate AI recommendations</p>
                    )}
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
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="w-full"
                                  onClick={() => handleViewImplementation(suggestion)}
                                >
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

      {/* Implementation Modal */}
      <AnimatePresence>
        {showImplementationModal && selectedSuggestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-neutral-900 rounded-xl border border-default max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-default flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{getTypeIcon(selectedSuggestion.type)}</span>
                    <div>
                      <h3 className="text-2xl font-bold text-neutral-50">{selectedSuggestion.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(selectedSuggestion.priority)}`}>
                          {selectedSuggestion.priority} priority
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${getDifficultyBadge(selectedSuggestion.implementation.difficulty)}`}>
                          {selectedSuggestion.implementation.difficulty}
                        </span>
                        <span className="text-xs text-neutral-500">⏱️ {selectedSuggestion.implementation.estimatedTime}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Description */}
                <div>
                  <h4 className="text-sm font-semibold text-neutral-400 mb-2">Description</h4>
                  <p className="text-neutral-300">{selectedSuggestion.description}</p>
                </div>

                {/* Rationale */}
                {selectedSuggestion.rationale && (
                  <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-primary-400 mb-1">Why This Helps</h4>
                        <p className="text-sm text-neutral-300">{selectedSuggestion.rationale}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Expected Impact */}
                {(selectedSuggestion.expectedImpact?.returnIncrease || 
                  selectedSuggestion.expectedImpact?.riskReduction || 
                  selectedSuggestion.expectedImpact?.efficiencyGain) && (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-400 mb-3">Expected Impact</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {selectedSuggestion.expectedImpact.returnIncrease && (
                        <div className="bg-success-400/10 border border-success-400/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-success-400" />
                            <span className="text-xs font-semibold text-success-400">Return Increase</span>
                          </div>
                          <p className="text-2xl font-bold text-success-400">+{selectedSuggestion.expectedImpact.returnIncrease}%</p>
                        </div>
                      )}
                      {selectedSuggestion.expectedImpact.riskReduction && (
                        <div className="bg-success-400/10 border border-success-400/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-success-400" />
                            <span className="text-xs font-semibold text-success-400">Risk Reduction</span>
                          </div>
                          <p className="text-2xl font-bold text-success-400">-{selectedSuggestion.expectedImpact.riskReduction}%</p>
                        </div>
                      )}
                      {selectedSuggestion.expectedImpact.efficiencyGain && (
                        <div className="bg-success-400/10 border border-success-400/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-success-400" />
                            <span className="text-xs font-semibold text-success-400">Efficiency Gain</span>
                          </div>
                          <p className="text-2xl font-bold text-success-400">+{selectedSuggestion.expectedImpact.efficiencyGain}%</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Implementation Steps */}
                {selectedSuggestion.implementation.steps.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-400 mb-3">Implementation Steps</h4>
                    <div className="space-y-3">
                      {selectedSuggestion.implementation.steps.map((step, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-neutral-950 rounded-lg border border-default">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 border border-primary-500/50 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary-400">{index + 1}</span>
                          </div>
                          <p className="text-sm text-neutral-300 flex-1">{step}</p>
                          <CheckCircle className="w-4 h-4 text-neutral-600 flex-shrink-0 mt-0.5" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Data Support */}
                {selectedSuggestion.dataSupport && (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-400 mb-3">Supporting Data</h4>
                    <div className="space-y-3">
                      {selectedSuggestion.dataSupport.sentiment && Object.keys(selectedSuggestion.dataSupport.sentiment).length > 0 && (
                        <div className="p-3 bg-neutral-950 rounded-lg border border-default">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-warning-400" />
                            <span className="text-xs font-semibold text-neutral-300">Social Sentiment</span>
                          </div>
                          <div className="text-xs text-neutral-500">
                            {Object.entries(selectedSuggestion.dataSupport.sentiment).map(([asset, data]: [string, any]) => (
                              <div key={asset} className="mt-1">
                                <span className="text-neutral-400">{asset}:</span> {data.overallSentiment || 'neutral'} ({data.totalPosts || 0} posts)
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedSuggestion.dataSupport.analysis && (
                        <div className="p-3 bg-neutral-950 rounded-lg border border-default">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-info-400" />
                            <span className="text-xs font-semibold text-neutral-300">Strategy Analysis</span>
                          </div>
                          <div className="text-xs text-neutral-500">
                            <div>Diversification Score: {selectedSuggestion.dataSupport.analysis.diversificationScore || 0}/100</div>
                            <div>Issues Found: {selectedSuggestion.dataSupport.analysis.issues?.length || 0}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Config Changes */}
                {selectedSuggestion.configChanges && Object.keys(selectedSuggestion.configChanges).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-400 mb-3">Configuration Changes</h4>
                    <div className="p-3 bg-neutral-950 rounded-lg border border-default">
                      <pre className="text-xs text-neutral-400 overflow-x-auto">
                        {JSON.stringify(selectedSuggestion.configChanges, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-default flex items-center justify-between">
                <p className="text-xs text-neutral-500">
                  Created {new Date(selectedSuggestion.createdAt).toLocaleDateString()} at{' '}
                  {new Date(selectedSuggestion.createdAt).toLocaleTimeString()}
                </p>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="md" onClick={handleCloseModal}>
                    Close
                  </Button>
                  <Button variant="primary" size="md">
                    Apply Suggestion
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Suggestions;
