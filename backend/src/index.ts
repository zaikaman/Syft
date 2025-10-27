import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import corsMiddleware from './middleware/cors';
import { errorHandler } from './middleware/errorHandler';
import { logger, requestId } from './middleware/logger';

// Load environment variables
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

// Apply middleware
app.use(requestId);
app.use(logger);
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    },
  });
});

// API info endpoint
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: 'Syft Backend API',
      version: '0.1.0',
      description: 'DeFi Yield Vault Platform API',
      endpoints: {
        health: 'GET /health',
        vaults: 'POST /api/vaults, GET /api/vaults/:id',
        wallet: 'GET /api/wallet/:address/assets',
        backtests: 'POST /api/backtests, GET /api/backtests/:id',
        suggestions: 'POST /api/vaults/:id/suggestions',
        nfts: 'POST /api/vaults/:id/nft',
        marketplace: 'GET /api/marketplace/listings',
      },
    },
  });
});

// API routes will be mounted here in Phase 2
// app.use('/api/vaults', vaultsRouter);
// app.use('/api/wallet', walletRouter);
// app.use('/api/backtests', backtestsRouter);
// app.use('/api/suggestions', suggestionsRouter);
// app.use('/api/nfts', nftsRouter);
// app.use('/api/marketplace', marketplaceRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
    },
    timestamp: new Date().toISOString(),
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   🚀 Syft Backend API Server         ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(21)}║
║   Port: ${String(port).padEnd(29)}║
║   URL: http://localhost:${port.toString().padEnd(14)}║
╚═══════════════════════════════════════╝
  `);
  console.log('📡 Server is ready to accept connections');
  console.log('🏥 Health check: http://localhost:' + port + '/health\n');
});
