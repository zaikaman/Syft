// T027: Base API router structure
// Purpose: Central routing configuration for all API endpoints

import { Router } from 'express';
import walletRoutes from './wallet';

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

// TODO: Import and mount route modules as they are implemented
// T041: Wallet routes integrated
router.use('/wallet', walletRoutes);

// Example for future routes:
// import vaultRoutes from './vaults';
// router.use('/vaults', vaultRoutes);

export default router;
