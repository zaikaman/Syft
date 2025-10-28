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
  getUserPosition,
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
    const { config, network } = req.body as {
      config: VaultDeploymentConfig;
      network?: string;
    };

    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: config',
      });
    }

    // Validate config
    if (!config.owner || !config.name || !config.assets || !config.rules) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vault configuration',
      });
    }

    // Use service deployer account from environment
    const deployerSecret = process.env.DEPLOYER_SECRET_KEY;
    if (!deployerSecret) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Deployer account not configured',
      });
    }

    const keypair = StellarSdk.Keypair.fromSecret(deployerSecret);
    
    // Normalize network
    const userNetwork = network || process.env.STELLAR_NETWORK || 'testnet';
    console.log(`[Vault Creation] Using network: ${userNetwork}`);

    // Deploy vault on the user's network
    const result = await deployVault(config, keypair, userNetwork);

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
    const state = await monitorVaultState(vault.contract_address, vault.network);

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
 * GET /api/vaults/:vaultId/position/:userAddress
 * Get user's position in a vault (shares and balance)
 */
router.get('/:vaultId/position/:userAddress', async (req: Request, res: Response) => {
  try {
    const { vaultId, userAddress } = req.params;

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

    // Get user position from contract
    const position = await getUserPosition(
      vault.contract_address,
      userAddress,
      vault.network
    );

    if (!position) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user position',
      });
    }

    return res.json({
      success: true,
      data: {
        vaultId,
        userAddress,
        shares: position.shares,
        lastDeposit: position.lastDeposit,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/vaults/:vaultId/position/:userAddress:', error);
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
    const { userAddress, amount, network } = req.body;

    if (!userAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userAddress, amount',
      });
    }

    // Validate and use the user's network
    const userNetwork = network || process.env.STELLAR_NETWORK || 'testnet';
    console.log(`[Deposit] Using network: ${userNetwork} for user ${userAddress}`);

    // Use service account for transaction submission
    const deployerSecret = process.env.DEPLOYER_SECRET_KEY;
    if (!deployerSecret) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Deployer account not configured',
      });
    }

    const keypair = StellarSdk.Keypair.fromSecret(deployerSecret);
    const result = await executeDeposit(vaultId, userAddress, amount, keypair, userNetwork);

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
    const { userAddress, shares, network } = req.body;

    if (!userAddress || !shares) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userAddress, shares',
      });
    }

    // Normalize network
    const userNetwork = network || process.env.STELLAR_NETWORK || 'testnet';
    console.log(`[Withdraw] Using network: ${userNetwork} for user ${userAddress}`);

    // Get vault from database to check contract address
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (vaultError || !vault) {
      return res.status(404).json({
        success: false,
        error: 'Vault not found',
      });
    }

    // Check user's position before withdrawal
    console.log(`[Withdraw] Checking user position for ${userAddress}`);
    const userPosition = await getUserPosition(
      vault.contract_address,
      userAddress,
      userNetwork
    );

    if (!userPosition) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user position',
      });
    }

    const userShares = BigInt(userPosition.shares);
    const requestedShares = BigInt(shares);

    console.log(`[Withdraw] User has ${userShares} shares, requesting ${requestedShares} shares`);

    if (userShares < requestedShares) {
      const userSharesInXLM = (Number(userShares) / 10_000_000).toFixed(7);
      const requestedInXLM = (Number(requestedShares) / 10_000_000).toFixed(7);
      
      return res.status(400).json({
        success: false,
        error: `Insufficient shares. You have ${userSharesInXLM} shares but tried to withdraw ${requestedInXLM} shares.`,
      });
    }

    // Use service account for transaction submission
    const deployerSecret = process.env.DEPLOYER_SECRET_KEY;
    if (!deployerSecret) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Deployer account not configured',
      });
    }

    const keypair = StellarSdk.Keypair.fromSecret(deployerSecret);
    const result = await executeWithdrawal(vaultId, userAddress, shares, keypair, userNetwork);

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
 * GET /api/vaults/:vaultId/nfts
 * Get all NFTs for a vault
 */
router.get('/:vaultId/nfts', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;

    // Get vault to verify it exists
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (vaultError || !vault) {
      return res.status(404).json({
        success: false,
        error: 'Vault not found',
      });
    }

    // Get all NFTs for this vault using the UUID
    const { data: nfts, error } = await supabase
      .from('vault_nfts')
      .select('*')
      .eq('vault_id', vault.id)
      .order('minted_at', { ascending: false });

    if (error) {
      console.error('Error fetching NFTs:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch NFTs',
      });
    }

    // Transform the data to match frontend expectations
    const transformedNfts = (nfts || []).map(nft => ({
      nft_id: nft.nft_id,
      holder_address: nft.current_holder,
      ownership_pct: nft.ownership_percentage,
      metadata: nft.metadata,
      token_id: nft.token_id,
      contract_address: nft.contract_address,
      minted_at: nft.minted_at,
    }));

    return res.json({
      success: true,
      data: transformedNfts,
    });
  } catch (error) {
    console.error('Error in GET /api/vaults/:vaultId/nfts:', error);
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
    const { owner, config, name, network } = req.body;

    if (!owner || !config) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: owner and config',
      });
    }

    // Normalize network
    const vaultNetwork = network || 'testnet';
    console.log(`[Save Draft] Saving draft for network: ${vaultNetwork}`);

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
        network: vaultNetwork, // Store network
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
    const { status, network } = req.query; // Optional filter by status and network

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

    // Apply network filter if provided
    if (network) {
      query = query.eq('network', network);
      console.log(`[Get User Vaults] Filtering by network: ${network}`);
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
