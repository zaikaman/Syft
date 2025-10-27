import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import corsMiddleware from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger, requestId } from './middleware/logger.js';
import apiRoutes from './routes/index.js';
import { startRuleMonitoring } from './services/ruleTriggerService.js';
import { startVaultSync } from './services/vaultSyncService.js';
import { executeRebalance } from './services/vaultActionService.js';

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

// Mount API routes
app.use('/api', apiRoutes);

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
  console.log('🏥 Health check: http://localhost:' + port + '/health');
  
  // Start background services
  console.log('\n🔄 Starting background services...');
  
  // Start vault sync service (syncs vault state every 5 minutes)
  const syncInterval = startVaultSync();
  console.log('✅ Vault sync service started');
  
  // Start rule monitoring service (checks rules every 60 seconds)
  const ruleInterval = startRuleMonitoring((trigger) => {
    console.log(`🎯 Rule triggered for vault ${trigger.vaultId}, executing rebalance...`);
    executeRebalance(trigger.vaultId, trigger.ruleIndex).then((result) => {
      if (result.success) {
        console.log(`✅ Rebalance executed successfully for vault ${trigger.vaultId}`);
      } else {
        console.error(`❌ Rebalance failed for vault ${trigger.vaultId}:`, result.error);
      }
    });
  });
  console.log('✅ Rule monitoring service started');
  
  console.log('\n🎉 All services operational!\n');
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    clearInterval(syncInterval);
    clearInterval(ruleInterval);
    process.exit(0);
  });
});

