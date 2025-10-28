import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import ConnectAccount from '../ConnectAccount';

export const LandingHeader = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How It Works' },
    { href: '/app/vaults', label: 'Vaults' },
    { href: '#docs', label: 'Docs' },
  ];

  const handleNavClick = (href: string, e: React.MouseEvent) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const element = document.getElementById(href.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
    setMobileMenuOpen(false);
  };

  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 pt-6 px-6"
    >
      <div 
        className="max-w-7xl mx-auto rounded-full px-6 py-3"
        style={{
          background: 'linear-gradient(180deg, rgba(9,10,10,0.75), rgba(9,10,10,0.45)) padding-box, linear-gradient(120deg, rgba(220,232,93,0.25), rgba(255,255,255,0.08)) border-box',
          border: '1px solid transparent',
          backdropFilter: 'blur(16px) saturate(120%)',
          WebkitBackdropFilter: 'blur(16px) saturate(120%)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)'
        }}
      >
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Syft logo" className="w-8 h-8 rounded" />
            <span className="text-white text-lg font-semibold">Syft</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-white/60">
            {navItems.map((item) => {
              if (item.href.startsWith('/')) {
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="hover:text-white transition-colors duration-300 px-4 py-2 rounded-full hover:bg-white/5"
                  >
                    {item.label}
                  </Link>
                );
              }
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(item.href, e)}
                  className="hover:text-white transition-colors duration-300 px-4 py-2 rounded-full hover:bg-white/5"
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            <ConnectAccount />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-white/60 hover:text-white transition-colors"
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
            className="md:hidden py-4 mt-2 border-t border-white/10"
          >
            <div className="flex flex-col gap-1 mb-4">
              {navItems.map((item) => {
                if (item.href.startsWith('/')) {
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-2.5 rounded-full text-sm font-medium transition-all text-white/60 hover:bg-white/5 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  );
                }
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(e) => handleNavClick(item.href, e)}
                    className="px-4 py-2.5 rounded-full text-sm font-medium transition-all text-white/60 hover:bg-white/5 hover:text-white"
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
            <div className="px-4">
              <ConnectAccount />
            </div>
          </motion.div>
        )}
      </div>
    </motion.header>
  );
};
