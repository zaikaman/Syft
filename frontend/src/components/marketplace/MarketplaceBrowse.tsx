// T135: Marketplace browse interface with filters
// Purpose: Display and filter available NFT listings

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface Listing {
  listing_id: string;
  nft_id: string;
  vault_id: string;
  seller_address: string;
  price: number;
  currency: string;
  status: string;
  listed_at: string;
  vault_nfts: {
    nft_id: string;
    ownership_pct: number;
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
  const [error, setError] = useState('');

  // Filters
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('listed_at');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    loadListings();
  }, [minPrice, maxPrice, sortBy, sortOrder]);

  const loadListings = async () => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        status: 'active',
        sortBy,
        sortOrder,
      });

      if (minPrice) params.append('minPrice', minPrice);
      if (maxPrice) params.append('maxPrice', maxPrice);

      const response = await fetch(`/api/marketplace/listings?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load listings');
      }

      setListings(data.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load marketplace listings');
    } finally {
      setIsLoading(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">NFT Marketplace</h2>
          <p className="text-gray-600 mt-1">
            Discover and invest in high-performing vault strategies
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Min Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Price (XLM)
            </label>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Max Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Price (XLM)
            </label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="∞"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="listed_at">Date Listed</option>
              <option value="price">Price</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">High to Low</option>
              <option value="asc">Low to High</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Listings Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-red-600">{error}</p>
          <Button onClick={loadListings} className="mt-4" variant="outline">
            Try Again
          </Button>
        </Card>
      ) : listings.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600">No listings found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <Card
              key={listing.listing_id}
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onSelectListing?.(listing)}
            >
              {/* NFT Image */}
              {listing.vault_nfts.metadata.imageUrl && (
                <img
                  src={listing.vault_nfts.metadata.imageUrl}
                  alt={listing.vault_nfts.metadata.name}
                  className="w-full h-48 object-cover rounded-md mb-4"
                />
              )}

              {/* NFT Name */}
              <h3 className="font-bold text-lg mb-2">
                {listing.vault_nfts.metadata.name}
              </h3>

              {/* Vault Info */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Vault:</span>
                  <span className="font-medium">{listing.vault_nfts.vaults.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ownership:</span>
                  <span className="font-medium text-blue-600">
                    {listing.vault_nfts.ownership_pct / 100}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Performance:</span>
                  <span
                    className={`font-medium ${
                      listing.vault_nfts.vaults.performance >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {listing.vault_nfts.vaults.performance >= 0 ? '+' : ''}
                    {listing.vault_nfts.vaults.performance.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Price */}
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600">Price</p>
                    <p className="text-2xl font-bold">
                      {listing.price} {listing.currency}
                    </p>
                  </div>
                  <Button variant="primary" size="sm">
                    Buy Now
                  </Button>
                </div>
              </div>

              {/* Listing Info */}
              <div className="mt-4 pt-4 border-t text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Seller: {truncateAddress(listing.seller_address)}</span>
                  <span>Listed {formatDate(listing.listed_at)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
