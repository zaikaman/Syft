// T135: Marketplace browse interface with filters
// Purpose: Display and filter available NFT listings

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { Package, TrendingUp, DollarSign, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { useWallet } from '../../hooks/useWallet';
import { useNavigate } from 'react-router-dom';

interface Listing {
  listing_id: string;
  nft_id: string;
  vault_id: string;
  seller: string;
  profit_share_percentage?: number;
  price?: number;
  currency?: string;
  status: string;
  created_at: string;
  vault_nfts: {
    nft_id: string;
    ownership_percentage: number;
    metadata: {
      name: string;
      description: string;
      imageUrl?: string;
    };
    vaults: {
      vault_id: string;
      name: string;
      description: string;
      total_value: number;
      performance: number;
    };
  };
}

interface MarketplaceBrowseProps {
  onSelectListing?: (listing: Listing) => void;
}

export function MarketplaceBrowse({ onSelectListing }: MarketplaceBrowseProps) {
  const { address, signTransaction, network } = useWallet();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState('');
  const [subscribing, setSubscribing] = useState<string | null>(null);

  // Filters
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    loadListings(isInitialLoad);
    
    // Auto-refresh listings every 30 seconds
    const interval = setInterval(() => {
      loadListings(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [sortBy, sortOrder]);

  const loadListings = async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setError('');

    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const params = new URLSearchParams({
        status: 'active',
        sortBy,
        sortOrder,
      });

      const response = await fetch(`${backendUrl}/api/marketplace/listings?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch marketplace listings');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load listings');
      }

      setListings(data.data || []);
    } catch (err: any) {
      console.error('[Marketplace] Failed to load listings:', err);
      if (showLoading) {
        setError(err.message || 'Failed to load marketplace listings');
      }
    } finally {
      if (showLoading) {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };


  const handleSubscribe = async (listing: Listing) => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    if (!signTransaction) {
      alert('Wallet does not support transaction signing');
      return;
    }

    if (!network) {
      alert('Unable to detect wallet network. Please reconnect your wallet.');
      return;
    }

    console.log(`[Subscribe] Wallet network from context: "${network}"`);
    console.log(`[Subscribe] Wallet address: ${address}`);
    console.log(`[Subscribe] LocalStorage walletNetwork:`, localStorage.getItem('walletNetwork'));

    // Fallback to localStorage if context network is not available yet
    const effectiveNetwork = network || localStorage.getItem('walletNetwork')?.toLowerCase() || 'testnet';
    console.log(`[Subscribe] Effective network to use: "${effectiveNetwork}"`);

    try {
      setSubscribing(listing.listing_id);

      // Backend URL (local fallback)
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';

      // Call subscribe endpoint
      console.log(`[Subscribe] Sending request with network: "${effectiveNetwork}"`);
      const response = await fetch(`${backendUrl}/api/marketplace/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.listing_id,
          subscriberAddress: address,
          network: effectiveNetwork,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Subscribe] Backend error:', data);
        throw new Error(data.error || data.details || 'Failed to start subscription');
      }

      const data = await response.json();
      const { deploymentXdr, vaultId: newVaultId, profitSharePercentage } = data.data;
      
      console.log(`[Subscribe] Got deployment data - vaultId:`, newVaultId);

      console.log(`[Subscribe] Received XDR from backend (first 100 chars):`, deploymentXdr.substring(0, 100));
      console.log(`[Subscribe] XDR length:`, deploymentXdr.length);

      // Decode and inspect the transaction
      try {
        // @ts-ignore - import StellarSdk dynamically
        const { TransactionBuilder, Networks } = await import('@stellar/stellar-sdk');
        const tx = TransactionBuilder.fromXDR(deploymentXdr, Networks.TESTNET);
        console.log(`[Subscribe] Decoded transaction network passphrase:`, tx.networkPassphrase);
      } catch (e) {
        console.error(`[Subscribe] Failed to decode XDR:`, e);
      }

      // Sign deployment transaction
      console.log(`[Subscribe] Calling signTransaction with XDR...`);
      const signResult = await signTransaction(deploymentXdr);
      console.log(`[Subscribe] Sign result:`, signResult);
      
      const signedXdr = signResult.signedTxXdr;
      console.log(`[Subscribe] Extracted signedTxXdr length:`, signedXdr?.length);
      console.log(`[Subscribe] Signed XDR (first 100 chars):`, signedXdr?.substring(0, 100));

      if (!signedXdr) {
        throw new Error('Failed to sign transaction - no XDR returned');
      }

      // Submit transaction
      console.log(`[Subscribe] Submitting signed transaction to backend...`);
      const submitResponse = await fetch(`${backendUrl}/api/vaults/submit-deployment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedXDR: signedXdr, // Note: backend expects signedXDR with capital letters
          vaultId: newVaultId,
          config: {
            owner: address,
            name: `Subscribed ${listing.vault_nfts?.vaults?.name || 'Vault'}`,
            assets: ['XLM'], // Will be properly set from cloned config
            rules: [],
          },
          network: effectiveNetwork,
        }),
      });

      if (!submitResponse.ok) {
        const submitError = await submitResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Subscribe] Submit deployment error:', submitError);
        throw new Error(submitError.error || submitError.details || 'Failed to deploy vault');
      }

      const submitData = await submitResponse.json();
      const { vaultId, transactionHash } = submitData.data;

      // Complete subscription
      await fetch(`${backendUrl}/api/marketplace/subscribe/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.listing_id,
          subscriberAddress: address,
          subscribedVaultId: vaultId,
          transactionHash,
        }),
      });

      alert(`Successfully subscribed! You're sharing ${profitSharePercentage}% of profits with the creator.`);
      navigate(`/app/vaults/${vaultId}`);
    } catch (error) {
      console.error('Subscription error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe';
      
      // Check if it's an account not funded error
      if (errorMessage.includes('Wallet account not found') || errorMessage.includes('Not Found')) {
        alert(
          `❌ Your wallet is not funded on this network.\n\n` +
          `Please fund your wallet first:\n` +
          `• Testnet: Visit https://laboratory.stellar.org/#account-creator?network=test\n` +
          `• Futurenet: Visit https://laboratory.stellar.org/#account-creator?network=futurenet\n\n` +
          `Then try subscribing again.`
        );
      } else {
        alert(`Failed to subscribe: ${errorMessage}`);
      }
    } finally {
      setSubscribing(null);
    }
  };

  if (isLoading && isInitialLoad) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <Skeleton className="h-12 w-48 mx-auto mb-4" />
          <p className="text-neutral-400">Loading marketplace...</p>
        </div>
      </div>
    );
  }

  if (error && listings.length === 0) {
    return (
      <Card className="p-12 text-center bg-card border border-default">
        <AlertCircle className="w-12 h-12 text-error-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-neutral-50 mb-2">Failed to Load Listings</h3>
        <p className="text-neutral-400 mb-6">{error}</p>
        <Button onClick={() => loadListings(true)} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </Card>
    );
  }

  if (listings.length === 0 && !isLoading) {
    return (
      <Card className="p-12 text-center bg-card border border-default">
        <Package className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-neutral-50 mb-2">No Listings Available</h3>
        <p className="text-neutral-400">
          No vault NFTs are currently listed for sale. Check back soon!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-5 bg-card border border-default">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-neutral-50">Filter & Sort</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadListings(true)}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-900 border border-default rounded-lg text-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none cursor-pointer"
            >
              <option value="created_at">Recently Listed</option>
              <option value="profit_share_percentage">Profit Share %</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Order
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-900 border border-default rounded-lg text-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none cursor-pointer"
            >
              <option value="desc">High to Low</option>
              <option value="asc">Low to High</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {listings.map((listing, index) => (
          <motion.div
            key={listing.listing_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card 
              className="p-0 bg-card border border-default hover:border-primary-500 transition-all overflow-hidden group cursor-pointer"
              onClick={() => onSelectListing?.(listing)}
            >
              {/* NFT Image */}
              {listing.vault_nfts?.metadata?.imageUrl ? (
                <div className="relative h-48 overflow-hidden bg-neutral-900">
                  <img
                    src={listing.vault_nfts.metadata.imageUrl}
                    alt={listing.vault_nfts.metadata.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-full">
                    <span className="text-xs font-semibold text-primary-500">
                      {listing.vault_nfts.ownership_percentage ? (listing.vault_nfts.ownership_percentage / 100).toFixed(2) : 'N/A'}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-48 bg-gradient-to-br from-primary-500/20 to-primary-600/20 flex items-center justify-center">
                  <Package className="w-16 h-16 text-primary-500/50" />
                </div>
              )}

              {/* NFT Info */}
              <div className="p-5">
                <h3 className="font-bold text-lg text-neutral-50 mb-2 line-clamp-1">
                  {listing.vault_nfts?.metadata?.name || 'Vault NFT'}
                </h3>
                
                <p className="text-sm text-neutral-400 mb-4 line-clamp-1">
                  {listing.vault_nfts?.vaults?.name || 'Unknown Vault'}
                </p>

                {/* Stats Grid */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between p-2 bg-neutral-900 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-primary-500" />
                      <span className="text-xs text-neutral-400">Ownership</span>
                    </div>
                    <span className="text-sm font-semibold text-primary-500">
                      {listing.vault_nfts?.ownership_percentage ? (listing.vault_nfts.ownership_percentage / 100).toFixed(2) : 'N/A'}%
                    </span>
                  </div>

                  {listing.vault_nfts?.vaults?.performance !== undefined && listing.vault_nfts?.vaults?.performance !== null && (
                    <div className="flex items-center justify-between p-2 bg-neutral-900 rounded-lg">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-success-400" />
                        <span className="text-xs text-neutral-400">Performance</span>
                      </div>
                      <span className={`text-sm font-semibold ${
                        listing.vault_nfts.vaults.performance >= 0 
                          ? 'text-success-400' 
                          : 'text-error-400'
                      }`}>
                        {listing.vault_nfts.vaults.performance >= 0 ? '+' : ''}
                        {listing.vault_nfts.vaults.performance.toFixed(2)}%
                      </span>
                    </div>
                  )}

                  {listing.vault_nfts?.vaults?.total_value !== undefined && listing.vault_nfts?.vaults?.total_value !== null && (
                    <div className="flex items-center justify-between p-2 bg-neutral-900 rounded-lg">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5 text-primary-500" />
                        <span className="text-xs text-neutral-400">Vault Value</span>
                      </div>
                      <span className="text-sm font-semibold text-neutral-50">
                        ${listing.vault_nfts.vaults.total_value.toLocaleString(undefined, { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Profit Share Section */}
                <div className="pt-4 border-t border-default">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Profit Share</p>
                      <p className="text-2xl font-bold text-primary-500">
                        {listing.profit_share_percentage || 0}%
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        Goes to creator
                      </p>
                    </div>
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => handleSubscribe(listing)}
                      disabled={subscribing === listing.listing_id}
                    >
                      {subscribing === listing.listing_id ? 'Subscribing...' : 'Subscribe'}
                    </Button>
                  </div>
                </div>

                {/* Listing Meta */}
                <div className="pt-3 border-t border-default flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-neutral-500">
                    <span>Seller:</span>
                    <code className="text-neutral-400">{truncateAddress(listing.seller)}</code>
                  </div>
                  <div className="flex items-center gap-1 text-neutral-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(listing.created_at)}</span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
