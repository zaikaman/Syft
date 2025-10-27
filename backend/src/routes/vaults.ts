import { Router, Request, Response } from 'express';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  deployVault,
  estimateDeploymentFees,
  getVaultDeploymentStatus,
  VaultDeploymentConfig,
} from '../services/vaultDeploymentService.js';
import {
  monitorVaultState,
  getVaultPerformance,
  getPerformanceHistory,
  getVaultTransactionHistory,
} from '../services/vaultMonitorService.js';
import {
  executeDeposit,
  executeWithdrawal,
} from '../services/vaultActionService.js';
import { supabase } from '../lib/supabase.js';
import { syncVaultState } from '../services/vaultSyncService.js';

const router = Router();

/**
 * POST /api/vaults
 * Deploy a new vault
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { config, privateKey } = req.body as {
      config: VaultDeploymentConfig;
      privateKey: string;
    };

    if (!config || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: config and privateKey',
      });
    }

    // Validate config
    if (!config.owner || !config.name || !config.assets || !config.rules) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vault configuration',
      });
    }

    // Create keypair from private key
    const keypair = StellarSdk.Keypair.fromSecret(privateKey);

    // Deploy vault
    const result = await deployVault(config, keypair);

    if (result.status === 'failed') {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to deploy vault',
      });
    }

    return res.json({
      success: true,
      data: {
        vaultId: result.vaultId,
        contractAddress: result.contractAddress,
        transactionHash: result.transactionHash,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/vaults/:vaultId
 * Get vault state and configuration
 */
router.get('/:vaultId', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;

    // Get vault from database
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      return res.status(404).json({
        success: false,
        error: 'Vault not found',
      });
    }

    // Get current state from blockchain
    const state = await monitorVaultState(vault.contract_address);

    // Get performance metrics
    const performance = await getVaultPerformance(vaultId);

    return res.json({
      success: true,
      data: {
        vaultId: vault.vault_id,
        owner: vault.owner_wallet_address,
        contractAddress: vault.contract_address,
        config: vault.config,
        status: vault.status,
        state,
        performance,
        createdAt: vault.created_at,
        updatedAt: vault.updated_at,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/vaults/:vaultId:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/:vaultId/deposit
 * Deposit assets into vault
 */
router.post('/:vaultId/deposit', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { userAddress, amount, privateKey } = req.body;

    if (!userAddress || !amount || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userAddress, amount, privateKey',
      });
    }

    const keypair = StellarSdk.Keypair.fromSecret(privateKey);
    const result = await executeDeposit(vaultId, userAddress, amount, keypair);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Deposit failed',
      });
    }

    // Sync vault state after deposit
    await syncVaultState(vaultId);

    return res.json({
      success: true,
      data: {
        shares: result.shares,
        amount,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/:vaultId/deposit:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/:vaultId/withdraw
 * Withdraw assets from vault
 */
router.post('/:vaultId/withdraw', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { userAddress, shares, privateKey } = req.body;

    if (!userAddress || !shares || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userAddress, shares, privateKey',
      });
    }

    const keypair = StellarSdk.Keypair.fromSecret(privateKey);
    const result = await executeWithdrawal(vaultId, userAddress, shares, keypair);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Withdrawal failed',
      });
    }

    // Sync vault state after withdrawal
    await syncVaultState(vaultId);

    return res.json({
      success: true,
      data: {
        amount: result.amount,
        shares,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/:vaultId/withdraw:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/vaults/:vaultId/history
 * Get transaction history for a vault
 */
router.get('/:vaultId/history', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Get vault from database
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('contract_address')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      return res.status(404).json({
        success: false,
        error: 'Vault not found',
      });
    }

    // Get transaction history
    const transactions = await getVaultTransactionHistory(
      vault.contract_address,
      limit
    );

    return res.json({
      success: true,
      data: {
        vaultId,
        transactions,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/vaults/:vaultId/history:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/vaults/:vaultId/performance
 * Get performance history for charting
 */
router.get('/:vaultId/performance', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const history = await getPerformanceHistory(vaultId, startDate, endDate);

    return res.json({
      success: true,
      data: {
        vaultId,
        history,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/vaults/:vaultId/performance:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/vaults/:vaultId/status
 * Get deployment status
 */
router.get('/:vaultId/status', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;

    const status = await getVaultDeploymentStatus(vaultId);

    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error in GET /api/vaults/:vaultId/status:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/estimate-fees
 * Estimate deployment fees
 */
router.post('/estimate-fees', async (_req: Request, res: Response) => {
  try {
    const fees = await estimateDeploymentFees();

    res.json({
      success: true,
      data: fees,
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/estimate-fees:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/vaults
 * List all vaults (optionally filter by owner)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { owner } = req.query;

    let query = supabase.from('vaults').select('*');

    if (owner) {
      query = query.eq('owner', owner);
    }

    const { data: vaults, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      data: {
        vaults: vaults || [],
        count: vaults?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/vaults:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/drafts
 * Save a vault draft (incomplete configuration)
 */
router.post('/drafts', async (req: Request, res: Response) => {
  try {
    const { owner, config, name } = req.body;

    if (!owner || !config) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: owner and config',
      });
    }

    // Ensure user exists in database (upsert)
    const { error: userError } = await supabase
      .from('users')
      .upsert(
        {
          wallet_address: owner,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'wallet_address',
          ignoreDuplicates: true,
        }
      );

    if (userError) {
      console.error('Error upserting user:', userError);
      // Continue anyway - user might already exist
    }

    // Generate draft ID
    const draftId = `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Generate a default name if not provided
    const vaultName = name || `Vault Draft ${new Date().toLocaleDateString()}`;

    // Save draft to database with status 'draft'
    const { data, error } = await supabase
      .from('vaults')
      .insert({
        vault_id: draftId,
        owner_wallet_address: owner,
        contract_address: null, // No contract yet
        name: vaultName,
        description: 'Vault draft created from visual builder',
        config,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      data: {
        draftId: data.vault_id,
        message: 'Draft saved successfully',
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/drafts:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/vaults/user/:walletAddress
 * Get all vaults (including drafts) for a user
 */
router.get('/user/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const { status } = req.query; // Optional filter by status

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
    }

    // Build query
    let query = supabase
      .from('vaults')
      .select('*')
      .eq('owner_wallet_address', walletAddress)
      .order('created_at', { ascending: false });

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data: vaults, error } = await query;

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      data: vaults || [],
    });
  } catch (error) {
    console.error('Error in GET /api/vaults/user/:walletAddress:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
