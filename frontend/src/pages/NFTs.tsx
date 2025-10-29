import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, Button } from '../components/ui';
import { MintNFT } from '../components/nft/MintNFT';
import { CreateListing } from '../components/marketplace/CreateListing';
import { Package, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { useWallet } from '../providers/WalletProvider';

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
        throw new Error('Failed to fetch NFTs');
      }

      const data = await response.json();
      if (data.success) {
        setNfts(data.data || []);
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
  };

  if (!address) {
    return (
      <div className="h-full bg-app flex items-center justify-center p-4">
        <Card className="p-8 text-center bg-card max-w-md">
          <Package className="w-12 h-12 text-primary-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-neutral-50">Connect Your Wallet</h2>
          <p className="text-neutral-400">
            Connect your wallet to view and manage your vault NFTs
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
          <p className="text-neutral-400">Loading your NFTs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-app flex items-center justify-center p-4">
        <Card className="p-8 text-center bg-card max-w-md">
          <AlertCircle className="w-12 h-12 text-error-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-neutral-50">Error Loading NFTs</h2>
          <p className="text-neutral-400 mb-4">{error}</p>
          <Button onClick={fetchNFTs} variant="primary">Try Again</Button>
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
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-neutral-50 mb-2">My Vault NFTs</h1>
              <p className="text-neutral-400">
                Manage your vault ownership NFTs and list them on the marketplace
              </p>
            </div>
          </div>

          {/* NFT Grid */}
          {nfts.length === 0 ? (
            <Card className="p-12 text-center bg-card">
              <Package className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-neutral-50 mb-2">No NFTs Yet</h3>
              <p className="text-neutral-400 mb-6">
                Mint NFTs to represent your vault ownership shares and trade them on the marketplace
              </p>
              <p className="text-sm text-neutral-500">
                Visit your vaults in the Dashboard to mint NFTs
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nfts.map((nft, index) => (
                <motion.div
                  key={nft.nft_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-0 bg-card border border-default hover:border-primary-500 transition-all overflow-hidden group">
                    {/* NFT Image */}
                    {nft.metadata?.imageUrl ? (
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={nft.metadata.imageUrl}
                          alt={nft.metadata.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-full">
                          <span className="text-xs font-semibold text-primary-500">
                            {(nft.ownership_pct / 100).toFixed(2)}% Ownership
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
                      <h3 className="text-lg font-bold text-neutral-50 mb-2">
                        {nft.metadata?.name || 'Unnamed NFT'}
                      </h3>
                      
                      {nft.vaults && (
                        <>
                          <p className="text-sm text-neutral-400 mb-4">
                            {nft.vaults.name}
                          </p>

                          {/* Stats */}
                          <div className="space-y-3 mb-4">
                            <div className="flex items-center justify-between p-2 bg-neutral-900 rounded-lg">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-success-400" />
                                <span className="text-xs text-neutral-400">Performance</span>
                              </div>
                              <span className={`text-sm font-semibold ${
                                nft.vaults.performance >= 0 ? 'text-success-400' : 'text-error-400'
                              }`}>
                                {nft.vaults.performance >= 0 ? '+' : ''}
                                {nft.vaults.performance.toFixed(2)}%
                              </span>
                            </div>

                            <div className="flex items-center justify-between p-2 bg-neutral-900 rounded-lg">
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-primary-500" />
                                <span className="text-xs text-neutral-400">Vault Value</span>
                              </div>
                              <span className="text-sm font-semibold text-neutral-50">
                                ${nft.vaults.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedNft(nft);
                            setShowListModal(true);
                          }}
                        >
                          List for Sale
                        </Button>
                      </div>

                      {/* Metadata */}
                      <div className="mt-4 pt-4 border-t border-default">
                        <div className="text-xs text-neutral-500">
                          Minted {new Date(nft.minted_at).toLocaleDateString()}
                        </div>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-default rounded-lg max-w-lg w-full p-6"
          >
            <MintNFT
              vaultId="placeholder"
              vaultName="Placeholder Vault"
              vaultPerformance={0}
              onMintSuccess={handleMintSuccess}
            />
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => setShowMintModal(false)}
            >
              Cancel
            </Button>
          </motion.div>
        </div>
      )}

      {/* List Modal */}
      {showListModal && selectedNft && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-default rounded-lg max-w-lg w-full p-6"
          >
            <CreateListing
              nftId={selectedNft.nft_id}
              onListingCreated={handleListSuccess}
            />
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => {
                setShowListModal(false);
                setSelectedNft(null);
              }}
            >
              Cancel
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default NFTs;
