import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export const LandingHeader = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

          {/* Desktop Navigation - Empty for landing page */}
          <div className="hidden md:flex items-center gap-3">
            {/* Future: Add links like About, Docs, etc. */}
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
            {/* Future: Add mobile menu items */}
          </motion.div>
        )}
      </nav>
    </motion.header>
  );
};
