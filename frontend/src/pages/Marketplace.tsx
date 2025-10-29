import { useNavigate } from 'react-router-dom';
import { MarketplaceBrowse } from '../components/marketplace/MarketplaceBrowse';
import { motion } from 'framer-motion';

const Marketplace = () => {
  const navigate = useNavigate();

  const handleSelectListing = (listing: any) => {
    // Navigate to vault detail page with listing context
    navigate(`/app/vaults/${listing.vault_id}`);
  };

  return (
    <div className="h-full bg-app overflow-auto">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-neutral-50 mb-2">NFT Marketplace</h1>
            <p className="text-neutral-400">
              Discover and purchase vault NFTs representing ownership shares in high-performing DeFi strategies
            </p>
          </div>
          
          <MarketplaceBrowse onSelectListing={handleSelectListing} />
        </motion.div>
      </div>
    </div>
  );
};

export default Marketplace;
