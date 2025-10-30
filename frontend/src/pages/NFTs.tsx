import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, Button } from '../components/ui';
import { MintNFT } from '../components/nft/MintNFT';
import { CreateListing } from '../components/marketplace/CreateListing';
import {
  Package,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Search,
  RefreshCw,
  X,
  ExternalLink,
} from 'lucide-react';
import { useWallet } from '../providers/WalletProvider';
import { Link } from 'react-router-dom';

interface NFT {
  nft_id: string;
  vault_id: string;
  owner_address: string;
  ownership_pct: number;
  minted_at: string;
  metadata: {
    name: string;
    description: string;
    imageUrl?: string;
  };
  vaults?: {
    name: string;
    performance: number;
    total_value: number;
  };
}

const NFTs = () => {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [showMintModal, setShowMintModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'performance'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { address } = useWallet();

  useEffect(() => {
    if (address) {
      fetchNFTs();
    }
  }, [address]);

  const fetchNFTs = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/nfts/owner/${address}`);

      if (!response.ok) {
        const text = await response.text().catch(() => null);
        throw new Error(text || 'Failed to fetch NFTs');
      }

      const data = await response.json();
      if (data.success) {
        setNfts(Array.isArray(data.data) ? data.data : []);
      } else {
        throw new Error(data.error || 'Failed to load NFTs');
      }
    } catch (err: any) {
      console.error('Failed to fetch NFTs:', err);
      setError(err.message || 'Failed to load NFTs');
    } finally {
      setLoading(false);
    }
  };

  const handleMintSuccess = () => {
    setShowMintModal(false);
    fetchNFTs();
  };

  const handleListSuccess = () => {
    setShowListModal(false);
    setSelectedNft(null);
    // refresh to reflect listing status
    fetchNFTs();
  };

  const clearSearch = () => setSearch('');

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = nfts.slice();
    if (q) {
      arr = arr.filter((n) =>
        (n.metadata?.name || '').toLowerCase().includes(q) ||
        (n.nft_id || '').toLowerCase().includes(q) ||
        (n.vaults?.name || '').toLowerCase().includes(q)
      );
    }
    if (sortBy === 'date') {
      arr.sort((a, b) => {
        const ta = new Date(a.minted_at).getTime();
        const tb = new Date(b.minted_at).getTime();
        return sortOrder === 'asc' ? ta - tb : tb - ta;
      });
    } else if (sortBy === 'performance') {
      arr.sort((a, b) => {
        const pa = a.vaults?.performance ?? -Infinity;
        const pb = b.vaults?.performance ?? -Infinity;
        return sortOrder === 'asc' ? pa - pb : pb - pa;
      });
    }
    return arr;
  }, [nfts, search, sortBy, sortOrder]);

  if (!address) {
    return (
      <div className="h-full bg-app flex items-center justify-center p-4">
        <Card className="p-8 text-center bg-card max-w-md">
          <Package className="w-12 h-12 text-primary-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-neutral-50">Connect Your Wallet</h2>
          <p className="text-neutral-400">Connect your wallet to view and manage your vault NFTs</p>
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
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-neutral-50 mb-2 flex items-center gap-3">
                <Package className="w-8 h-8 text-primary-500" />
                My Vault NFTs
              </h1>
              <p className="text-neutral-400">Manage your vault ownership NFTs and list them on the marketplace</p>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="md" onClick={fetchNFTs} className="flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="primary" size="md" onClick={() => setShowMintModal(true)}>
                Mint NFT
              </Button>
            </div>
          </div>

          {/* Search + Sort */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex-1 relative max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                className="w-full pl-10 pr-10 py-3 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-50 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Search by NFT name, vault name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1" onClick={clearSearch}>
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [s, o] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
                  setSortBy(s);
                  setSortOrder(o);
                }}
                className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="date-desc">Newest</option>
                <option value="date-asc">Oldest</option>
                <option value="performance-desc">Best Performance</option>
                <option value="performance-asc">Worst Performance</option>
              </select>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-center py-24">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
              <p className="text-neutral-400">Loading your NFTs...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Card className="p-8 text-center bg-card max-w-lg mx-auto">
                <AlertCircle className="w-12 h-12 text-error-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-neutral-50 mb-2">Error Loading NFTs</h3>
                <p className="text-neutral-400 mb-4">{error}</p>
                <Button onClick={fetchNFTs} variant="primary">Try Again</Button>
              </Card>
            </div>
          ) : displayed.length === 0 ? (
            <Card className="p-12 text-center bg-card">
              <Package className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-neutral-50 mb-2">No NFTs Found</h3>
              <p className="text-neutral-400 mb-6">You don't have any vault NFTs yet. Mint one or visit your vaults to create NFTs.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayed.map((nft, idx) => (
                <motion.div key={nft.nft_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                  <Card className="p-0 bg-card border border-default hover:border-primary-500 transition-all overflow-hidden group">
                    {/* Image */}
                    {nft.metadata?.imageUrl ? (
                      <div className="relative h-48 overflow-hidden">
                        <img src={nft.metadata.imageUrl} alt={nft.metadata.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-primary-500/30">
                          <span className="text-xs font-bold text-primary-400">{(nft.ownership_pct / 100).toFixed(2)}% Ownership</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-48 bg-gradient-to-br from-primary-500/10 to-primary-600/10 flex items-center justify-center border-b border-neutral-800">
                        <Package className="w-16 h-16 text-primary-400/50" />
                      </div>
                    )}

                    {/* Body */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-neutral-50 mb-1 line-clamp-1">{nft.metadata?.name || 'Unnamed NFT'}</h3>
                          <div className="text-sm text-neutral-400 line-clamp-1">{nft.vaults?.name}</div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Link to={`/app/nfts/${nft.nft_id}`} className="text-neutral-400 hover:text-primary-400 p-2 rounded-md hover:bg-neutral-800 transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>

                      {nft.vaults && (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg border border-neutral-700">
                            <div className="flex items-center gap-2 text-xs text-neutral-300">
                              <TrendingUp className="w-4 h-4 text-success-400" />
                              Performance
                            </div>
                            <div className={`text-sm font-bold ${nft.vaults.performance >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                              {nft.vaults.performance >= 0 ? '+' : ''}{nft.vaults.performance.toFixed(2)}%
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg border border-neutral-700">
                            <div className="flex items-center gap-2 text-xs text-neutral-300">
                              <DollarSign className="w-4 h-4 text-primary-400" />
                              Vault Value
                            </div>
                            <div className="text-sm font-bold text-neutral-50">${nft.vaults.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-neutral-800 flex gap-2">
                        <Button variant="primary" size="sm" className="flex-1" onClick={() => { setSelectedNft(nft); setShowListModal(true); }}>
                          List on Marketplace
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { const data = JSON.stringify(nft, null, 2); const uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(data); const a = document.createElement('a'); a.href = uri; a.download = `nft-${nft.nft_id}.json`; a.click(); }}>
                          Export
                        </Button>
                      </div>

                      <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-between text-xs">
                        <span className="text-neutral-500">Minted</span>
                        <span className="text-neutral-400 font-medium">{new Date(nft.minted_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Mint Modal */}
      {showMintModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-neutral-900 border border-neutral-700 rounded-lg max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-neutral-50 mb-4">Mint Vault NFT</h3>
            <MintNFT vaultId="" vaultName="" vaultPerformance={0} onMintSuccess={handleMintSuccess} />
            <Button variant="outline" className="w-full mt-4" onClick={() => setShowMintModal(false)}>Cancel</Button>
          </motion.div>
        </div>
      )}

      {/* List Modal */}
      {showListModal && selectedNft && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowListModal(false); setSelectedNft(null); }}>
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-neutral-900 border border-neutral-700 rounded-lg max-w-lg w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-neutral-50 mb-4">Create Marketplace Listing</h3>
            <CreateListing nftId={selectedNft.nft_id} onListingCreated={handleListSuccess} />
            <Button variant="outline" className="w-full mt-4" onClick={() => { setShowListModal(false); setSelectedNft(null); }}>Cancel</Button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default NFTs;
