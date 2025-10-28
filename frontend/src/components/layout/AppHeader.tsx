import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import ConnectAccount from '../ConnectAccount';

interface AppHeaderProps {
  onMenuClick?: () => void;
}

export const AppHeader = ({ onMenuClick }: AppHeaderProps) => {
  return (
    <motion.header
      initial={{ y: -10 }}
      animate={{ y: 0 }}
      className="h-16 flex-shrink-0 border-b border-default bg-secondary/95 backdrop-blur-sm"
    >
      <div className="h-full px-6 flex items-center justify-between">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-neutral-900 rounded-md transition-colors text-neutral-400"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Spacer for desktop */}
        <div className="hidden lg:block flex-1" />

        {/* Wallet Connection */}
        <ConnectAccount />
      </div>
    </motion.header>
  );
};
