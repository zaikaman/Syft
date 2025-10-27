// T027: Base API router structure
// Purpose: Central routing configuration for all API endpoints

import { Router } from 'express';
import walletRoutes from './wallet.js';
import vaultRoutes from './vaults.js';
import backtestRoutes from './backtests.js';

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
      wallet: '/api/wallet',
      vaults: '/api/vaults',
      backtests: '/api/backtests',
      suggestions: '/api/suggestions',
      nfts: '/api/nfts',
      marketplace: '/api/marketplace',
    },
  });
});

// Mount route modules
router.use('/wallet', walletRoutes);
router.use('/vaults', vaultRoutes);
router.use('/backtests', backtestRoutes);

// TODO: Import and mount additional routes as they are implemented
// Example for future routes:
// import suggestionRoutes from './suggestions';
// import nftRoutes from './nfts';
// import marketplaceRoutes from './marketplace';
// router.use('/suggestions', suggestionRoutes);
// router.use('/nfts', nftRoutes);
// router.use('/marketplace', marketplaceRoutes);

export default router;
