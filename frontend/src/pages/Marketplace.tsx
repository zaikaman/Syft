import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketplaceBrowse } from '../components/marketplace/MarketplaceBrowse';
import { motion } from 'framer-motion';
import { ShoppingBag, TrendingUp, Package, Percent } from 'lucide-react';
import { Card } from '../components/ui';

const Marketplace = () => {
  const navigate = useNavigate();
  const [marketStats, setMarketStats] = useState({
    totalListings: 0,
    avgPrice: 0,
    bestPerformance: 0,
  });

  useEffect(() => {
    fetchMarketStats();
  }, []);

  const fetchMarketStats = async () => {
    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/marketplace/listings?status=active`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const listings = data.data;
          
          // Calculate stats from listings
          const totalListings = listings.length;
          const avgProfitShare = listings.length > 0 
            ? listings.reduce((sum: number, l: any) => sum + (l.profit_share_percentage || 0), 0) / listings.length 
            : 0;
          const bestPerformance = listings.length > 0
            ? Math.max(...listings.map((l: any) => l.vault_nfts?.vaults?.performance || 0))
            : 0;

          setMarketStats({
            totalListings,
            avgPrice: avgProfitShare,
            bestPerformance,
          });
        }
      }
    } catch (err) {
      console.error('[Marketplace] Failed to fetch market stats:', err);
    }
  };

  const handleSelectListing = (listing: any) => {
    // Navigate to vault detail page with listing context
    navigate(`/app/vaults/${listing.vault_id}`);
  };

  const stats = [
    {
      label: 'Total Listings',
      value: marketStats.totalListings.toString(),
      icon: Package,
      color: 'primary',
    },
    {
      label: 'Avg. Profit Share',
      value: `${marketStats.avgPrice.toFixed(1)}%`,
      icon: Percent,
      color: 'success',
    },
    {
      label: 'Best Performance',
      value: `+${marketStats.bestPerformance.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'warning',
    },
  ];

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
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <ShoppingBag className="w-8 h-8 text-primary-500" />
              <h1 className="text-3xl md:text-4xl font-bold text-neutral-50">NFT Marketplace</h1>
            </div>
            <p className="text-neutral-400">
              Discover and purchase vault NFTs representing ownership shares in high-performing DeFi strategies
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-4 bg-card border border-default">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-${stat.color}-500/10 flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 text-${stat.color}-500`} />
                      </div>
                      <div>
                        <div className="text-sm text-neutral-400">{stat.label}</div>
                        <div className="text-xl font-bold text-neutral-50">{stat.value}</div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Marketplace Browse Component */}
          <MarketplaceBrowse onSelectListing={handleSelectListing} />
        </motion.div>
      </div>
    </div>
  );
};

export default Marketplace;
