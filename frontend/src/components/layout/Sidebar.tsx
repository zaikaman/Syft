import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Box, Home, X, ShoppingBag, BarChart3, TestTube, Package, Lightbulb, Code } from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
  const location = useLocation();

  const navItems = [
    { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/app/builder', label: 'Vault Builder', icon: Box },
    { path: '/app/marketplace', label: 'Marketplace', icon: ShoppingBag },
    { path: '/app/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/app/backtests', label: 'Backtests', icon: TestTube },
    { path: '/app/nfts', label: 'My NFTs', icon: Package },
    { path: '/app/suggestions', label: 'AI Suggestions', icon: Lightbulb },
    { path: '/app/debugger', label: 'Debugger', icon: Code },
  ];

  const isActive = (path: string) => location.pathname === path;

  const sidebarContent = (
    <div className="w-64 h-full flex-shrink-0 border-r border-default bg-secondary flex flex-col">
      {/* Logo Area */}
      <div className="p-4 border-b border-default flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <img
            src="/logo.png"
            alt="Syft Logo"
            className="w-8 h-8 object-contain"
          />
          <span className="text-xl font-semibold text-neutral-50">
            Syft
          </span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-neutral-900 rounded-md transition-colors text-neutral-400"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive(item.path)
                    ? 'bg-primary-500/10 text-primary-500'
                    : 'text-neutral-400 hover:text-neutral-50 hover:bg-neutral-900'
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Back to Home Link */}
      <div className="p-3 border-t border-default">
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:text-neutral-50 hover:bg-neutral-900 transition-all"
        >
          <Home className="w-5 h-5" />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );

  // Desktop: Always visible
  // Mobile: Show as overlay when isOpen is true
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isOpen && onClose && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 z-50 lg:hidden"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
