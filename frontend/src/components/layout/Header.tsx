import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Home, Box, BarChart3, Menu, X } from 'lucide-react';
import { useState } from 'react';
import ConnectAccount from '../ConnectAccount';
import { clsx } from 'clsx';

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/builder', label: 'Vault Builder', icon: Box },
    { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <motion.header
      initial={{ y: -10 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-40 border-b border-default bg-secondary/95 backdrop-blur-sm"
    >
      <nav className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
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

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'px-4 py-2 rounded-md text-sm font-medium transition-all',
                    isActive(item.path)
                      ? 'text-neutral-50'
                      : 'text-neutral-400 hover:text-neutral-50'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-3">
            <ConnectAccount />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-neutral-400 hover:text-neutral-50 transition-colors"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden py-4 border-t border-default"
          >
            <div className="flex flex-col gap-1 mb-4">
              {navItems.map((item) => {
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={clsx(
                      'px-4 py-2.5 rounded-md text-sm font-medium transition-all',
                      isActive(item.path)
                        ? 'bg-neutral-900 text-neutral-50'
                        : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-50'
                    )}
                  >
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
