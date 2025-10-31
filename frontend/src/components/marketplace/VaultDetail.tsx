// T136: Vault detail page showing performance and ownership
// Purpose: Display comprehensive vault information for marketplace listings

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, Percent, Activity, Clock, Copy, ExternalLink, Package, ShoppingBag, Image } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { VaultActions } from '../vault/VaultActions';
import { useWallet } from '../../providers/WalletProvider';
import { useModal } from '../ui';
import { MintNFTModal } from './MintNFTModal';
import { ListingModal } from './ListingModal';

interface VaultDetailProps {
  vaultId: string;
  listingId?: string;
}

interface VaultData {
  vaultId: string;
  name?: string;
  description?: string;
  contractAddress: string;
  owner: string;
  config: any;
  status: string;
  state?: any;
  performance?: {
    currentValue: number;
    totalDeposits: number;
    totalWithdrawals: number;
    netReturn: number;
    returnPercentage: number;
    lastUpdated: string;
    returns24h?: number | null;
    returns7d?: number | null;
    returns30d?: number | null;
    returnsAllTime?: number | null;
    apyCurrent?: number | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface NFTHolder {
  nft_id: string;
  holder_address: string;
  ownership_pct: number;
  metadata: {
    name: string;
  };
}

interface UserPosition {
  shares: string;
  investmentAmount: number;
  currentValue: number;
  sharePrice: number;
  depositedAt?: string;
  unrealizedGainLoss: number;
}

export function VaultDetail({ vaultId, listingId }: VaultDetailProps) {
  const [vault, setVault] = useState<VaultData | null>(null);
  const [nftHolders, setNftHolders] = useState<NFTHolder[]>([]);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [xlmPrice, setXlmPrice] = useState<number>(0.10); // Fallback price
  const [vaultAnalytics, setVaultAnalytics] = useState<any>(null);
  const { address } = useWallet();
  const modal = useModal();
  const [showMintModal, setShowMintModal] = useState(false);
  const [showListingModal, setShowListingModal] = useState(false);

  useEffect(() => {
    loadVaultDetails(true); // Initial load with loading state
    fetchXLMPrice();
    fetchVaultAnalytics();
    if (address) {
      fetchUserPosition();
    }

    // Auto-refresh every 10 seconds for real-time updates (without loading state)
    const refreshInterval = setInterval(() => {
      loadVaultDetails(false); // Background refresh without loading state
      fetchVaultAnalytics();
      if (address) {
        fetchUserPosition();
      }
    }, 10000);

    // Refresh XLM price every 60 seconds
    const priceInterval = setInterval(() => {
      fetchXLMPrice();
    }, 60000);

    // Cleanup intervals on unmount
    return () => {
      clearInterval(refreshInterval);
      clearInterval(priceInterval);
    };
  }, [vaultId, address]);

  const fetchXLMPrice = async () => {
    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/price/xlm`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.price) {
          setXlmPrice(data.price);
          console.log(`[VaultDetail] XLM Price: $${data.price.toFixed(4)}`);
        }
      }
    } catch (err) {
      console.error('[VaultDetail] Failed to fetch XLM price:', err);
      // Keep using fallback price
    }
  };

  const fetchUserPosition = async () => {
    if (!address) return;
    
    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/vaults/${vaultId}/position/${address}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserPosition(data.data);
          console.log(`[VaultDetail] User position:`, data.data);
        }
      }
    } catch (err) {
      console.error('[VaultDetail] Failed to fetch user position:', err);
    }
  };

  const fetchVaultAnalytics = async () => {
    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/analytics/vault/${vaultId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVaultAnalytics(data.data);
          console.log(`[VaultDetail] Analytics:`, data.data);
        }
      }
    } catch (err) {
      console.error('[VaultDetail] Failed to fetch analytics:', err);
    }
  };

  const loadVaultDetails = async (showLoading: boolean = false) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setError('');

    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      // Load vault data
      const vaultResponse = await fetch(`${backendUrl}/api/vaults/${vaultId}`);
      const vaultData = await vaultResponse.json();

      if (!vaultData.success) {
        throw new Error(vaultData.error || 'Failed to load vault');
      }

      setVault(vaultData.data);

      // Load NFT holders
      const nftResponse = await fetch(`${backendUrl}/api/vaults/${vaultId}/nfts`);
      const nftData = await nftResponse.json();

      if (nftData.success) {
        setNftHolders(nftData.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load vault details');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const totalOwnership = nftHolders.reduce(
    (sum, holder) => sum + holder.ownership_pct,
    0
  );

  // Calculate TVL from vault state in stroops
  const calculateTVL = () => {
    if (!vault?.state?.totalValue) {
      // Fallback to performance data if state is not available
      return vault?.performance?.currentValue || 0;
    }
    
    const stateValue = Number(vault.state.totalValue);
    const xlmAmount = stateValue / 10_000_000; // Convert stroops to XLM
    return xlmAmount * xlmPrice; // Convert to USD
  };

  const tvlValue = calculateTVL();

  // NFT minting handler
  const handleMintNFT = () => {
    if (!vault) return;
    setShowMintModal(true);
  };

  // List on marketplace handler
  const handleListOnMarketplace = () => {
    if (!vault) return;
    setShowListingModal(true);
  };

  // Handle successful NFT mint
  const handleMintSuccess = () => {
    modal.message('Success', 'NFT minted successfully!', 'success');
    loadVaultDetails(false); // Refresh vault data
    fetchUserPosition(); // Refresh position
  };

  // Handle successful listing
  const handleListingSuccess = () => {
    modal.message('Success', 'Vault listed on marketplace successfully!', 'success');
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        <p className="text-neutral-400 mt-4 text-sm">Loading vault details...</p>
      </div>
    );
  }

  if (error || !vault) {
    return (
      <Card className="p-8 text-center bg-card">
        <Activity className="w-12 h-12 text-error-400 mx-auto mb-4" />
        <p className="text-error-400 text-lg font-medium">{error || 'Vault not found'}</p>
      </Card>
    );
  }

  const assets = vault.config.assets?.map((a: any) => typeof a === 'string' ? a : a.code).join(' / ') || 'Unknown';

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="p-6 bg-card border border-default">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-neutral-50">
                  {vault.name || vault.config?.name || 'Unnamed Vault'}
                </h1>
                <span
                  className={`px-3 py-1 rounded-md text-xs font-semibold ${
                    vault.status === 'active'
                      ? 'bg-success-400/20 text-success-400'
                      : 'bg-neutral-900 text-neutral-400'
                  }`}
                >
                  {vault.status}
                </span>
              </div>
              <p className="text-neutral-400 text-sm mb-2">
                {vault.description || vault.config?.description || 'No description available'}
              </p>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Package className="w-3.5 h-3.5" />
                <span>{assets}</span>
              </div>
            </div>
          </div>
          
          {/* Contract Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-default">
            <div>
              <div className="text-xs text-neutral-500 mb-1">Contract Address</div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-neutral-300 bg-neutral-900 px-2 py-1 rounded">
                  {truncateAddress(vault.contractAddress)}
                </code>
                <button
                  onClick={() => copyToClipboard(vault.contractAddress)}
                  className="p-1 hover:bg-neutral-900 rounded transition-colors"
                  title="Copy address"
                >
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                </button>
                <a
                  href={`https://stellar.expert/explorer/testnet/contract/${vault.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-neutral-900 rounded transition-colors"
                  title="View on Stellar Expert"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                </a>
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500 mb-1">Vault ID</div>
              <code className="text-xs font-mono text-neutral-300 bg-neutral-900 px-2 py-1 rounded inline-block">
                {vault.vaultId.slice(0, 16)}...
              </code>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Performance Metrics - Main Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <Card className="p-4 bg-card border border-default">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary-500" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1 text-neutral-50">
            ${tvlValue.toLocaleString(undefined, { 
              minimumFractionDigits: 0, 
              maximumFractionDigits: 2 
            })}
          </div>
          <div className="text-sm text-neutral-400 mb-2">Total Value Locked</div>
          {vault?.state?.totalValue && (
            <p className="text-xs text-neutral-500">
              {(Number(vault.state.totalValue) / 10_000_000).toFixed(7)} XLM
            </p>
          )}
        </Card>

        <Card className="p-4 bg-card border border-default">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
              <Percent className="w-5 h-5 text-primary-500" />
            </div>
            <div className={`text-xs font-medium ${
              (vault.performance?.apyCurrent ?? vaultAnalytics?.apy ?? 0) >= 0 ? 'text-success-400' : 'text-error-400'
            }`}>
              Current
            </div>
          </div>
          <div className={`text-2xl font-bold mb-1 ${
            (vault.performance?.apyCurrent ?? vaultAnalytics?.apy ?? 0) >= 0 ? 'text-success-400' : 'text-error-400'
          }`}>
            {(vault.performance?.apyCurrent ?? vaultAnalytics?.apy) !== null && 
             (vault.performance?.apyCurrent ?? vaultAnalytics?.apy) !== undefined
              ? `${(vault.performance?.apyCurrent ?? vaultAnalytics?.apy) >= 0 ? '+' : ''}${(vault.performance?.apyCurrent ?? vaultAnalytics?.apy).toFixed(2)}%`
              : 'N/A'}
          </div>
          <div className="text-sm text-neutral-400">APY</div>
        </Card>

        <Card className="p-4 bg-card border border-default">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-500" />
            </div>
          </div>
          <div className={`text-2xl font-bold mb-1 ${
            (vaultAnalytics?.totalEarnings || 0) >= 0 ? 'text-success-400' : 'text-error-400'
          }`}>
            ${(vaultAnalytics?.totalEarnings || 0) > 0 ? (vaultAnalytics.totalEarnings).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-sm text-neutral-400 mb-2">Total Earnings</div>
          <p className="text-xs text-neutral-500">
            {vaultAnalytics?.earningsPercentage 
              ? `${vaultAnalytics.earningsPercentage.toFixed(2)}% ROI`
              : 'No earnings yet'}
          </p>
        </Card>

        <Card className="p-4 bg-card border border-default">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary-500" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1 text-neutral-50">
            {vault?.state?.totalShares 
              ? (Number(vault.state.totalShares) / 10_000_000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
              : '0'}
          </div>
          <div className="text-sm text-neutral-400 mb-2">Total Shares</div>
          <p className="text-xs text-neutral-500">
            {formatDate(vault.createdAt)}
          </p>
        </Card>
      </motion.div>

      {/* Time-Based Returns */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-5 bg-card border border-default">
          <h2 className="text-lg font-bold mb-4 text-neutral-50 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-500" />
            Performance History
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-neutral-900 rounded-lg p-3 border border-default">
              <div className="text-xs text-neutral-500 mb-1">24h Return</div>
              <div
                className={`text-xl font-bold ${
                  (vault.performance?.returns24h ?? vaultAnalytics?.tvlChange24h ?? 0) >= 0
                    ? 'text-success-400'
                    : 'text-error-400'
                }`}
              >
                {(vault.performance?.returns24h ?? vaultAnalytics?.tvlChange24h) !== null &&
                 (vault.performance?.returns24h ?? vaultAnalytics?.tvlChange24h) !== undefined
                  ? `${(vault.performance?.returns24h ?? vaultAnalytics?.tvlChange24h) >= 0 ? '+' : ''}${(
                      vault.performance?.returns24h ?? vaultAnalytics?.tvlChange24h
                    ).toFixed(2)}%`
                  : 'N/A'}
              </div>
            </div>

            <div className="bg-neutral-900 rounded-lg p-3 border border-default">
              <div className="text-xs text-neutral-500 mb-1">7d Return</div>
              <div
                className={`text-xl font-bold ${
                  (vault.performance?.returns7d ?? vaultAnalytics?.tvlChange7d ?? 0) >= 0
                    ? 'text-success-400'
                    : 'text-error-400'
                }`}
              >
                {(vault.performance?.returns7d ?? vaultAnalytics?.tvlChange7d) !== null &&
                 (vault.performance?.returns7d ?? vaultAnalytics?.tvlChange7d) !== undefined
                  ? `${(vault.performance?.returns7d ?? vaultAnalytics?.tvlChange7d) >= 0 ? '+' : ''}${(
                      vault.performance?.returns7d ?? vaultAnalytics?.tvlChange7d
                    ).toFixed(2)}%`
                  : 'N/A'}
              </div>
            </div>

            <div className="bg-neutral-900 rounded-lg p-3 border border-default">
              <div className="text-xs text-neutral-500 mb-1">30d Return</div>
              <div
                className={`text-xl font-bold ${
                  (vault.performance?.returns30d ?? 0) >= 0 ? 'text-success-400' : 'text-error-400'
                }`}
              >
                {vault.performance?.returns30d !== null && vault.performance?.returns30d !== undefined
                  ? `${vault.performance.returns30d >= 0 ? '+' : ''}${vault.performance.returns30d.toFixed(2)}%`
                  : 'N/A'}
              </div>
            </div>

            <div className="bg-neutral-900 rounded-lg p-3 border border-default">
              <div className="text-xs text-neutral-500 mb-1">All-Time</div>
              <div
                className={`text-xl font-bold ${
                  (vault.performance?.returnsAllTime ?? vault.performance?.returnPercentage ?? 0) >= 0
                    ? 'text-success-400'
                    : 'text-error-400'
                }`}
              >
                {((vault.performance?.returnsAllTime !== null && vault.performance?.returnsAllTime !== undefined) ||
                  (vault.performance?.returnPercentage !== null && vault.performance?.returnPercentage !== undefined))
                  ? `${((vault.performance?.returnsAllTime ?? vault.performance?.returnPercentage) ?? 0) >= 0 ? '+' : ''}${((
                      vault.performance?.returnsAllTime ?? vault.performance?.returnPercentage
                    ) ?? 0).toFixed(2)}%`
                  : 'N/A'}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* User Position Section */}
      {address && userPosition && (userPosition.shares !== '0' || userPosition.investmentAmount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6 bg-card border-2 border-primary-500/30">
            <h2 className="text-xl font-bold mb-5 text-neutral-50 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-500" />
              Your Position
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-neutral-900 rounded-lg p-4 border border-default">
                <div className="text-xs text-neutral-500 mb-2">Your Shares</div>
                <div className="text-xl font-bold text-primary-400">
                  {(parseFloat(userPosition.shares) / 10_000_000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 7 })}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  @ ${userPosition.sharePrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 7 })} per share
                </div>
              </div>

              <div className="bg-neutral-900 rounded-lg p-4 border border-default">
                <div className="text-xs text-neutral-500 mb-2">Your Investment</div>
                <div className="text-xl font-bold text-neutral-50">
                  {userPosition.investmentAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                  {' '}XLM
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  ${(userPosition.investmentAmount * xlmPrice).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                </div>
              </div>

              <div className="bg-neutral-900 rounded-lg p-4 border border-default">
                <div className="text-xs text-neutral-500 mb-2">Current Value</div>
                <div className="text-xl font-bold text-neutral-50">
                  {userPosition.currentValue.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                  {' '}XLM
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  ${(userPosition.currentValue * xlmPrice).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                </div>
              </div>

              <div className="bg-neutral-900 rounded-lg p-4 border border-default">
                <div className="text-xs text-neutral-500 mb-2">Unrealized P&L</div>
                <div className={`text-xl font-bold ${
                  userPosition.unrealizedGainLoss >= 0 ? 'text-success-400' : 'text-error-400'
                }`}>
                  {userPosition.unrealizedGainLoss >= 0 ? '+' : ''}
                  {userPosition.unrealizedGainLoss.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                  {' '}XLM
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {userPosition.investmentAmount > 0 
                    ? `${((userPosition.unrealizedGainLoss / userPosition.investmentAmount) * 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`
                    : 'N/A'}
                </div>
              </div>
            </div>

            {userPosition.depositedAt && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-default">
                <Clock className="w-4 h-4 text-neutral-500" />
                <span className="text-xs text-neutral-500">
                  Deposited on {new Date(userPosition.depositedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* NFT Holders */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="p-5 bg-card border border-default">
          <h2 className="text-lg font-bold mb-4 text-neutral-50 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-500" />
            NFT Ownership Distribution
          </h2>
          <div className="space-y-3">
            {nftHolders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-400 text-sm mb-1">No NFTs minted for this vault yet</p>
                <p className="text-neutral-500 text-xs">Ownership can be tokenized as NFTs</p>
              </div>
            ) : (
              nftHolders.map((holder) => (
                <div
                  key={holder.nft_id}
                  className="flex items-center justify-between p-4 bg-neutral-900 rounded-lg border border-default hover:border-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
                      <span className="text-dark-950 font-bold text-sm">
                        {holder.metadata.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-neutral-50">{holder.metadata.name}</p>
                      <code className="text-xs font-mono text-neutral-500">
                        {truncateAddress(holder.holder_address)}
                      </code>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary-500 text-lg">
                      {holder.ownership_pct.toFixed(1)}%
                    </p>
                    <p className="text-xs text-neutral-500">ownership</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ownership Progress Bar */}
          {totalOwnership > 0 && (
            <div className="mt-5 pt-5 border-t border-default">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-neutral-400">Total Tokenized</span>
                <span className="font-medium text-neutral-50">{totalOwnership.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-neutral-900 rounded-full h-2.5">
                <div
                  className="bg-gradient-to-r from-primary-500 to-primary-600 h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min(totalOwnership, 100)}%` }}
                />
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Vault Actions - Deposit/Withdraw */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <VaultActions 
          vaultId={vaultId}
          contractAddress={vault.contractAddress}
          onActionComplete={(action) => {
            console.log(`${action} completed, reloading vault...`);
            loadVaultDetails(false); // Update without showing loading state
            fetchVaultAnalytics(); // Refresh analytics too
            fetchUserPosition(); // Refresh user position
          }}
        />
      </motion.div>

      {/* Owner Actions - Mint NFT & List on Marketplace */}
      {address && vault.owner === address && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="bg-secondary border-default">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-neutral-50 mb-4">Vault Owner Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={handleMintNFT}
                  className="flex items-center justify-center gap-2"
                >
                  <Image className="w-5 h-5" />
                  Mint NFT
                </Button>
                <Button 
                  variant="primary" 
                  size="lg"
                  onClick={handleListOnMarketplace}
                  className="flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-5 h-5" />
                  List on Marketplace
                </Button>
              </div>
              <p className="text-xs text-neutral-500 mt-3">
                As the vault owner, you can mint NFTs representing shares and list your vault on the marketplace.
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Action Button */}
      {listingId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center"
        >
          <Button variant="primary" size="lg">
            View Listing Details
          </Button>
        </motion.div>
      )}

      {/* Mint NFT Modal */}
      {vault && (
        <MintNFTModal
          isOpen={showMintModal}
          onClose={() => setShowMintModal(false)}
          vaultId={vaultId}
          vaultName={vault.name || 'Vault'}
          onSuccess={handleMintSuccess}
        />
      )}

      {/* Listing Modal */}
      {vault && (
        <ListingModal
          isOpen={showListingModal}
          onClose={() => setShowListingModal(false)}
          vaultId={vaultId}
          vaultName={vault.name || 'Vault'}
          vaultDescription={vault.description}
          contractAddress={vault.contractAddress}
          onSuccess={handleListingSuccess}
        />
      )}
    </div>
  );
}
