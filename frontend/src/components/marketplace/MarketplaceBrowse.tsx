// T135: Marketplace browse interface with filters
// Purpose: Display and filter available NFT listings

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Package, TrendingUp, DollarSign, Clock, AlertCircle, RefreshCw } from 'lucide-react';

interface Listing {
  listing_id: string;
  nft_id: string;
  vault_id: string;
  seller: string;
  price: number;
  currency: string;
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
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    loadListings(isInitialLoad);
    
    // Auto-refresh listings every 30 seconds
    const interval = setInterval(() => {
      loadListings(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [minPrice, maxPrice, sortBy, sortOrder]);

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

      if (minPrice) params.append('minPrice', minPrice);
      if (maxPrice) params.append('maxPrice', maxPrice);

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

  if (isLoading && isInitialLoad) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
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
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Min Price */}
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Min Price (XLM)
            </label>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-neutral-900 border border-default rounded-lg text-neutral-50 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Max Price */}
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Max Price (XLM)
            </label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="∞"
              className="w-full px-3 py-2 bg-neutral-900 border border-default rounded-lg text-neutral-50 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

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
              <option value="created_at">Date Listed</option>
              <option value="price">Price</option>
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

                  {listing.vault_nfts?.vaults?.performance && (
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

                  {listing.vault_nfts?.vaults?.total_value && (
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

                {/* Price Section */}
                <div className="pt-4 border-t border-default">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Price</p>
                      <p className="text-2xl font-bold text-neutral-50">
                        {listing.price} <span className="text-base text-neutral-400">{listing.currency}</span>
                      </p>
                    </div>
                    <Button variant="primary" size="sm">
                      Buy Now
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
