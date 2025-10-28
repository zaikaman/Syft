import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import ConnectAccount from '../ConnectAccount';
import { clsx } from 'clsx';

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: '/#features', label: 'Features', scrollTo: 'features' },
    { path: '/#how-it-works', label: 'How It Works', scrollTo: 'how-it-works' },
    { path: '/app/vaults', label: 'Vaults' },
    { path: '/docs', label: 'Docs' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleNavClick = (item: typeof navItems[0], e: React.MouseEvent) => {
    if (item.scrollTo) {
      e.preventDefault();
      const element = document.getElementById(item.scrollTo);
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
      <div className="max-w-7xl mx-auto rounded-full px-6 py-3" 
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
            <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-[#dce85d]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[#090a0a]">
                <path d="M12 2l3.8 3.8a1 1 0 0 1-1.4 1.4L13 5.2V12h-2V5.2L9.6 7.2a1 1 0 0 1-1.4-1.4L12 2zm0 9.5 7 7-1.4 1.4L12 14.3l-5.6 5.6L5 18.6l7-7z"></path>
              </svg>
            </span>
            <span className="text-white text-lg font-semibold">Syft</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-white/60">
            {navItems.map((item) => {
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={(e) => handleNavClick(item, e)}
                  className="hover:text-white transition-colors duration-300 px-4 py-2 rounded-full hover:bg-white/5"
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            <button className="hidden sm:inline-flex text-sm text-white/60 hover:text-white px-3 py-2 rounded-full transition hover:bg-white/5">
              Login
            </button>
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
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => handleNavClick(item, e)}
                    className={clsx(
                      'px-4 py-2.5 rounded-full text-sm font-medium transition-all',
                      isActive(item.path)
                        ? 'bg-white/10 text-white'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
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
      </div>
    </motion.header>
  );
};
