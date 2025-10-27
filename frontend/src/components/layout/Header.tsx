import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Wallet, Home, Box, BarChart3, Menu, X } from 'lucide-react';
import { useState } from 'react';
import ConnectAccount from '../ConnectAccount';
import { GradientText } from '../ui';
import { clsx } from 'clsx';

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/builder', label: 'Vault Builder', icon: Box },
    { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/debug', label: 'Debugger', icon: Box },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-40 border-b border-white/10 bg-[var(--color-bg-secondary)]/80 backdrop-blur-xl"
    >
      <nav className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg group-hover:shadow-purple-500/50 transition-all">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">
              <GradientText>Syft</GradientText>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium',
                    isActive(item.path)
                      ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Connect Wallet */}
          <div className="hidden md:block">
            <ConnectAccount />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-300 hover:text-white transition-colors"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden py-4 border-t border-white/10"
          >
            <div className="flex flex-col gap-2 mb-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={clsx(
                      'px-4 py-3 rounded-lg flex items-center gap-3 transition-all',
                      isActive(item.path)
                        ? 'bg-purple-600/20 text-purple-400'
                        : 'text-gray-300 hover:bg-white/5'
                    )}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <ConnectAccount />
          </motion.div>
        )}
      </nav>
    </motion.header>
  );
};
