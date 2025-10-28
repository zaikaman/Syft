// T027: Base API router structure
// Purpose: Central routing configuration for all API endpoints

import { Router } from 'express';
import walletRoutes from './wallet.js';
import vaultRoutes from './vaults.js';
import backtestRoutes from './backtests.js';
import suggestionsRoutes from './suggestions.js';
import nftRoutes from './nfts.js';
import marketplaceRoutes from './marketplace.js';
import userRoutes from './users.js';
import priceRoutes from './price.js';
import analyticsRoutes from './analytics.js';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Syft API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API version info
router.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Syft DeFi Platform API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      users: '/api/users',
      wallet: '/api/wallet',
      vaults: '/api/vaults',
      backtests: '/api/backtests',
      suggestions: '/api/suggestions',
      nfts: '/api/nfts',
      marketplace: '/api/marketplace',
      price: '/api/price',
      analytics: '/api/analytics',
    },
  });
});

// Mount route modules
router.use('/users', userRoutes);
router.use('/wallet', walletRoutes);
router.use('/vaults', vaultRoutes);
router.use('/backtests', backtestRoutes);
router.use('/suggestions', suggestionsRoutes);
router.use('/nfts', nftRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/price', priceRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
