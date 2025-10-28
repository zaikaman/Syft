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

// Add BigInt serialization support for JSON
// This allows BigInt values to be serialized as strings in JSON responses
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

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
  
  // Display transaction mode
  const mvpMode = process.env.MVP_MODE === 'true';
  const hasDeployerKey = !!process.env.DEPLOYER_SECRET_KEY;
  console.log('\n⚙️  Configuration:');
  console.log(`   Network: ${process.env.STELLAR_NETWORK || 'testnet'}`);
  console.log(`   MVP Mode: ${mvpMode ? '⚠️  ENABLED (simulated txs)' : '✅ DISABLED (real txs)'}`);
  console.log(`   Rebalancer Key: ${hasDeployerKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   Transaction Mode: ${!mvpMode && hasDeployerKey ? '🔴 LIVE ON-CHAIN' : '🟡 SIMULATION'}`);
  
  // Start background services
  console.log('\n🔄 Starting background services...');
  
  // Start vault sync service (syncs vault state every 2 minutes)
  const syncInterval = startVaultSync();
  console.log('✅ Vault sync service started (every 2 minutes)');
  
  // Start rule monitoring service (checks rules every 2 minutes)
  const ruleInterval = startRuleMonitoring((trigger) => {
    console.log(`🎯 Rule triggered for vault ${trigger.vaultId}, executing rebalance...`);
    executeRebalance(trigger.vaultId, trigger.ruleIndex).then((result) => {
      if (result.success) {
        console.log(`✅ Rebalance executed successfully for vault ${trigger.vaultId}`);
        if (result.transactionHash && !result.transactionHash.startsWith('mock_') && !result.transactionHash.startsWith('simulated_')) {
          console.log(`🔗 TX Hash: ${result.transactionHash}`);
        }
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

