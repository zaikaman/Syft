import { Router, Request, Response } from 'express';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  deployVault,
  estimateDeploymentFees,
  getVaultDeploymentStatus,
  VaultDeploymentConfig,
  buildDeploymentTransaction,
} from '../services/vaultDeploymentService.js';
import {
  monitorVaultState,
  getVaultPerformance,
  getPerformanceHistory,
  getVaultTransactionHistory,
  getUserPosition,
  invalidateVaultCache,
} from '../services/vaultMonitorService.js';
import {
  executeDeposit,
  executeWithdrawal,
  buildDepositTransaction,
  buildWithdrawalTransaction,
} from '../services/vaultActionService.js';
import { supabase } from '../lib/supabase.js';
import { syncVaultState } from '../services/vaultSyncService.js';
import { getNetworkServers } from '../lib/horizonClient.js';
import suggestionsRoutes from './suggestions.js';

const router = Router();

// Mount suggestions routes at /vaults/:vaultId/suggestions
router.use('/', suggestionsRoutes);

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
 * Query params: includeStrategy (default: false) - only show to owner
 */
router.get('/:vaultId', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { requesterAddress, includeStrategy } = req.query;

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

    // Get latest performance snapshot for time-based returns
    const { data: latestSnapshot } = await supabase
      .from('vault_performance')
      .select('returns_24h, returns_7d, returns_30d, returns_all_time, apy_current')
      .eq('vault_id', vault.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    // Check if requester is the owner
    const isOwner = requesterAddress && requesterAddress === vault.owner_wallet_address;
    
    // Only include full config if requester is owner or includeStrategy is explicitly true
    const shouldIncludeStrategy = isOwner || (includeStrategy === 'true' && isOwner);
    
    // Return sanitized config for non-owners (hide visual builder strategy)
    const sanitizedConfig = shouldIncludeStrategy ? vault.config : {
      assets: vault.config?.assets?.map((a: any) => ({ code: a.code || a.assetCode })) || [],
      isPublic: vault.config?.isPublic,
      // Hide rules, nodes, edges, etc.
    };

    return res.json({
      success: true,
      data: {
        vaultId: vault.vault_id,
        name: vault.name,
        description: vault.description,
        owner: vault.owner_wallet_address,
        contractAddress: vault.contract_address,
        config: sanitizedConfig,
        status: vault.status,
        state,
        performance: {
          ...performance,
          returns24h: latestSnapshot?.returns_24h || null,
          returns7d: latestSnapshot?.returns_7d || null,
          returns30d: latestSnapshot?.returns_30d || null,
          returnsAllTime: latestSnapshot?.returns_all_time || null,
          apyCurrent: latestSnapshot?.apy_current || null,
        },
        createdAt: vault.created_at,
        updatedAt: vault.updated_at,
        isOwner,
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
 * Get user's position in a vault (shares, investment amount, and current value)
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

    // Get user's investment record from database
    const { data: userPosition } = await supabase
      .from('user_vault_positions')
      .select('shares, initial_deposit, current_value, deposited_at')
      .eq('user_wallet', userAddress)
      .eq('vault_id', vault.id)
      .single();

    // Get vault state to calculate share price
    const vaultState = await monitorVaultState(vault.contract_address, vault.network);
    
    // Calculate current value of user's shares
    let currentValue = 0;
    let sharePrice = 1;
    
    if (vaultState && vaultState.totalShares && vaultState.totalValue) {
      const totalSharesNum = parseFloat(vaultState.totalShares) / 10_000_000; // Convert from stroops
      const totalValueNum = parseFloat(vaultState.totalValue) / 10_000_000; // Convert from stroops
      
      if (totalSharesNum > 0) {
        sharePrice = totalValueNum / totalSharesNum;
        const userSharesNum = parseFloat(position.shares) / 10_000_000; // Convert from stroops
        currentValue = userSharesNum * sharePrice;
      }
    }

    return res.json({
      success: true,
      data: {
        vaultId,
        userAddress,
        shares: position.shares,
        lastDeposit: position.lastDeposit,
        investmentAmount: userPosition?.initial_deposit ? parseFloat(userPosition.initial_deposit.toString()) : 0,
        currentValue: currentValue,
        sharePrice: sharePrice,
        depositedAt: userPosition?.deposited_at,
        unrealizedGainLoss: currentValue - (userPosition?.initial_deposit ? parseFloat(userPosition.initial_deposit.toString()) : 0),
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
 * POST /api/vaults/build-deployment
 * Build unsigned deployment transaction for user to sign
 */
router.post('/build-deployment', async (req: Request, res: Response) => {
  try {
    const { config, userAddress, network } = req.body as {
      config: VaultDeploymentConfig;
      userAddress: string;
      network?: string;
    };

    if (!config || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: config, userAddress',
      });
    }

    // Build unsigned transaction
    const { xdr, vaultId } = await buildDeploymentTransaction(config, userAddress, network);

    return res.json({
      success: true,
      data: {
        xdr,
        vaultId,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/build-deployment:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/submit-deployment
 * Submit signed deployment transaction
 */
router.post('/submit-deployment', async (req: Request, res: Response) => {
  try {
    const { signedXDR, vaultId, config, network } = req.body;

    if (!signedXDR || !vaultId || !config) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: signedXDR, vaultId, config',
      });
    }

    // Get network-specific servers
    const servers = getNetworkServers(network);

    // Parse the signed transaction
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      signedXDR,
      servers.networkPassphrase
    );

    console.log(`[Submit Deploy] Simulating signed transaction to extract contract address...`);

    // Simulate the signed transaction to get the return value BEFORE submitting
    const simulationResult = await servers.sorobanServer.simulateTransaction(transaction);
    
    if (StellarSdk.rpc.Api.isSimulationError(simulationResult)) {
      console.error(`[Submit Deploy] Simulation failed:`, simulationResult);
      return res.status(500).json({
        success: false,
        error: 'Transaction simulation failed',
        details: simulationResult,
      });
    }

    // Extract contract address from simulation result
    let contractAddress = '';
    try {
      if (simulationResult.result?.retval) {
        const addressScVal = StellarSdk.Address.fromScVal(simulationResult.result.retval);
        contractAddress = addressScVal.toString();
        console.log(`[Submit Deploy] ✅ Extracted vault contract address from simulation: ${contractAddress}`);
      } else {
        console.error(`[Submit Deploy] No return value in simulation result`);
        return res.status(500).json({
          success: false,
          error: 'Could not extract contract address from simulation',
        });
      }
    } catch (extractError) {
      console.error(`[Submit Deploy] Error extracting contract address:`, extractError);
      return res.status(500).json({
        success: false,
        error: 'Failed to extract contract address from simulation',
        details: extractError,
      });
    }

    // Validate contract address before storing
    if (!contractAddress || !contractAddress.startsWith('C') || contractAddress.length !== 56) {
      console.error(`[Submit Deploy] ❌ Invalid contract address: ${contractAddress}`);
      return res.status(500).json({
        success: false,
        error: 'Failed to extract valid contract address from simulation',
      });
    }

    // Now submit the transaction via Horizon (fast, no polling needed)
    console.log(`[Submit Deploy] Submitting transaction to network...`);
    
    let txHash: string;
    try {
      const submitResult = await servers.horizonServer.submitTransaction(transaction);
      txHash = submitResult.hash;
      console.log(`[Submit Deploy] ✅ Transaction submitted successfully: ${txHash}`);
    } catch (submitError: any) {
      console.error(`[Submit Deploy] Error submitting transaction:`, submitError);
      
      // Check if it's a timeout error (504)
      if (submitError?.response?.status === 504 || submitError?.code === 'ERR_BAD_RESPONSE') {
        const txHashFromError = submitError?.response?.data?.extras?.hash;
        
        return res.status(202).json({
          success: false,
          timeout: true,
          transactionHash: txHashFromError,
          contractAddress,
          vaultId,
          error: 'Transaction submission timed out. The transaction may still be processing on the network. Please wait a moment and check your dashboard, or use the transaction hash below to verify on Stellar Expert.',
          message: 'This timeout does not mean the transaction failed. Stellar testnet can be slow during high load.',
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to submit transaction to network',
        details: submitError?.response?.data || submitError.message,
      });
    }

    // Store vault metadata
    await supabase
      .from('users')
      .upsert(
        {
          wallet_address: config.owner,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'wallet_address',
          ignoreDuplicates: true,
        }
      );

    await supabase.from('vaults').insert({
      vault_id: vaultId,
      owner_wallet_address: config.owner,
      contract_address: contractAddress,
      name: config.name || 'Untitled Vault',
      description: config.description || 'Deployed vault from visual builder',
      config: {
        assets: config.assets,
        rules: config.rules,
        isPublic: config.isPublic ?? true,
      },
      status: 'active',
      network: network || 'testnet',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deployed_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      data: {
        vaultId,
        contractAddress,
        transactionHash: txHash,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/submit-deployment:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/build-initialize
 * Build unsigned initialization transaction for a deployed vault
 */
router.post('/build-initialize', async (req: Request, res: Response) => {
  try {
    const { contractAddress, config, sourceAddress, network } = req.body;

    if (!contractAddress || !config || !sourceAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: contractAddress, config, sourceAddress',
      });
    }

    console.log(`[Build Initialize] Building initialization transaction for ${contractAddress}`);

    // Get network-specific servers
    const servers = getNetworkServers(network);

    // Load source account
    const sourceAccount = await servers.horizonServer.loadAccount(sourceAddress);

    // Create contract instance
    const vaultContract = new StellarSdk.Contract(contractAddress);

    // Helper function to convert asset symbol/address to contract address
    const getAssetAddress = (asset: string, network?: string): string => {
      const normalizedNetwork = (network || 'testnet').toLowerCase();
      
      // If already a valid contract address, return it
      if (asset.startsWith('C') && asset.length === 56) {
        return asset;
      }
      
      // Network-specific Native XLM SAC addresses
      const nativeXLMAddresses: { [key: string]: string } = {
        'testnet': 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        'futurenet': 'CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT',
        'mainnet': 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
        'public': 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
      };
      
      // Network-specific token addresses
      const tokenAddresses: { [key: string]: { [key: string]: string } } = {
        'XLM': nativeXLMAddresses,
        'USDC': {
          'testnet': 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
          'futurenet': process.env.FUTURENET_USDC_ADDRESS || nativeXLMAddresses['futurenet'],
          'mainnet': '',
          'public': '',
        },
      };

      const assetSymbol = asset.toUpperCase();
      const networkAddresses = tokenAddresses[assetSymbol];
      
      if (!networkAddresses) {
        throw new Error(`Unknown asset symbol: "${asset}"`);
      }

      const address = networkAddresses[normalizedNetwork];
      
      if (!address) {
        console.warn(`⚠️  ${asset} not available on ${network}, using Native XLM instead`);
        return nativeXLMAddresses[normalizedNetwork] || nativeXLMAddresses['testnet'];
      }

      return address;
    };

    // Convert assets to Address ScVals
    const assetAddresses = config.assets.map((asset: string) => {
      const address = getAssetAddress(asset, network);
      return StellarSdk.Address.fromString(address).toScVal();
    });

    // Build VaultConfig struct (must be sorted alphabetically by key!)
    const vaultConfigStruct = StellarSdk.xdr.ScVal.scvMap([
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('assets')),
        val: StellarSdk.xdr.ScVal.scvVec(assetAddresses),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('name')),
        val: StellarSdk.nativeToScVal(config.name, { type: 'string' }),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('owner')),
        val: StellarSdk.Address.fromString(config.owner).toScVal(),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('router_address')),
        val: StellarSdk.nativeToScVal(null, { type: 'option' }),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('rules')),
        val: StellarSdk.xdr.ScVal.scvVec([]),
      }),
    ]);

    // Build transaction
    const operation = vaultContract.call('initialize', vaultConfigStruct);

    let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: servers.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log(`[Build Initialize] Simulating transaction...`);

    // Simulate transaction
    const simulationResponse = await servers.sorobanServer.simulateTransaction(transaction);

    if (StellarSdk.rpc.Api.isSimulationError(simulationResponse)) {
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }

    // Prepare transaction with simulation results
    transaction = StellarSdk.rpc.assembleTransaction(
      transaction,
      simulationResponse
    ).build();

    console.log(`[Build Initialize] Transaction built successfully`);

    return res.json({
      success: true,
      data: {
        xdr: transaction.toXDR(),
        contractAddress,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/build-initialize:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/submit-initialize
 * Submit signed initialization transaction
 */
router.post('/submit-initialize', async (req: Request, res: Response) => {
  try {
    const { signedXDR, contractAddress, network } = req.body;

    if (!signedXDR || !contractAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: signedXDR, contractAddress',
      });
    }

    // Get network-specific servers
    const servers = getNetworkServers(network);

    // Parse signed transaction
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      signedXDR,
      servers.networkPassphrase
    );

    console.log(`[Submit Initialize] Submitting initialization transaction...`);

    // Submit via Horizon
    let txHash: string;
    try {
      const submitResult = await servers.horizonServer.submitTransaction(transaction);
      txHash = submitResult.hash;
      console.log(`[Submit Initialize] ✅ Transaction submitted successfully: ${txHash}`);
    } catch (submitError: any) {
      console.error(`[Submit Initialize] Error submitting transaction:`, submitError);
      return res.status(500).json({
        success: false,
        error: 'Failed to submit initialization transaction',
        details: submitError?.response?.data || submitError.message,
      });
    }

    console.log(`[Submit Initialize] ✅ Vault initialized successfully`);

    return res.json({
      success: true,
      data: {
        transactionHash: txHash,
        contractAddress,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/submit-initialize:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/:vaultId/build-deposit
 * Build unsigned deposit transaction for user to sign
 */
router.post('/:vaultId/build-deposit', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { userAddress, amount, network } = req.body;

    if (!userAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userAddress, amount',
      });
    }

    // Build unsigned transaction
    const { xdr, contractAddress } = await buildDepositTransaction(
      vaultId,
      userAddress,
      amount,
      network
    );

    return res.json({
      success: true,
      data: {
        xdr,
        contractAddress,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/:vaultId/build-deposit:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/:vaultId/submit-deposit
 * Submit signed deposit transaction
 */
router.post('/:vaultId/submit-deposit', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { signedXDR, network, userAddress, amount } = req.body;

    if (!signedXDR) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: signedXDR',
      });
    }

    // Get network-specific servers
    const servers = getNetworkServers(network);

    // Parse and submit the signed transaction
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      signedXDR,
      servers.networkPassphrase
    );

    console.log(`[Submit Deposit] Submitting signed deposit transaction...`);

    // Submit transaction via Horizon (fast, no polling needed)
    let txHash: string;
    try {
      const submitResult = await servers.horizonServer.submitTransaction(transaction);
      txHash = submitResult.hash;
      console.log(`[Submit Deposit] ✅ Transaction submitted successfully: ${txHash}`);
    } catch (submitError: any) {
      console.error(`[Submit Deposit] Error submitting transaction:`, submitError);
      return res.status(500).json({
        success: false,
        error: 'Failed to submit deposit transaction',
        details: submitError?.response?.data || submitError.message,
      });
    }

    // Record transaction for analytics
    if (userAddress && amount) {
      try {
        const { recordVaultTransaction } = await import('../services/transactionService.js');
        
        // We need to get the shares from the transaction result
        // For now, use amount as shares (1:1 ratio for initial deposit)
        // In production, should parse the transaction result to get actual shares
        await recordVaultTransaction({
          vaultId,
          userAddress,
          type: 'deposit',
          amountStroops: amount,
          shares: amount, // TODO: Extract actual shares from transaction result
          transactionHash: txHash,
          network,
        });
      } catch (recordError) {
        console.error('[Submit Deposit] Failed to record transaction (non-critical):', recordError);
        // Continue - don't fail the deposit if recording fails
      }
    }

    // Invalidate cache and sync state
    const { data: vault } = await supabase
      .from('vaults')
      .select('contract_address')
      .eq('vault_id', vaultId)
      .single();

    if (vault?.contract_address) {
      invalidateVaultCache(vault.contract_address);
    }

    await syncVaultState(vaultId);

    return res.json({
      success: true,
      data: {
        transactionHash: txHash,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/:vaultId/submit-deposit:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/:vaultId/build-withdraw
 * Build unsigned withdrawal transaction for user to sign
 */
router.post('/:vaultId/build-withdraw', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { userAddress, shares, network } = req.body;

    if (!userAddress || !shares) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userAddress, shares',
      });
    }

    // Build unsigned transaction
    const { xdr, contractAddress } = await buildWithdrawalTransaction(
      vaultId,
      userAddress,
      shares,
      network
    );

    return res.json({
      success: true,
      data: {
        xdr,
        contractAddress,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/:vaultId/build-withdraw:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/:vaultId/submit-withdraw
 * Submit signed withdrawal transaction
 */
router.post('/:vaultId/submit-withdraw', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { signedXDR, network, userAddress, shares } = req.body;

    if (!signedXDR) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: signedXDR',
      });
    }

    // Get network-specific servers
    const servers = getNetworkServers(network);

    // Parse and submit the signed transaction
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      signedXDR,
      servers.networkPassphrase
    );

    console.log(`[Submit Withdrawal] Submitting signed withdrawal transaction...`);

    // Submit transaction via Horizon (fast, no polling needed)
    let txHash: string;
    try {
      const submitResult = await servers.horizonServer.submitTransaction(transaction);
      txHash = submitResult.hash;
      console.log(`[Submit Withdrawal] ✅ Transaction submitted successfully: ${txHash}`);
    } catch (submitError: any) {
      console.error(`[Submit Withdrawal] Error submitting transaction:`, submitError);
      return res.status(500).json({
        success: false,
        error: 'Failed to submit withdrawal transaction',
        details: submitError?.response?.data || submitError.message,
      });
    }

    // Record transaction for analytics
    if (userAddress && shares) {
      try {
        const { recordVaultTransaction } = await import('../services/transactionService.js');
        
        // For withdrawals, shares are provided, amount needs to be calculated
        // For now, use shares as amount (will be calculated based on share price)
        await recordVaultTransaction({
          vaultId,
          userAddress,
          type: 'withdrawal',
          amountStroops: shares, // Will be converted based on share price
          shares: shares,
          transactionHash: txHash,
          network,
        });
      } catch (recordError) {
        console.error('[Submit Withdrawal] Failed to record transaction (non-critical):', recordError);
        // Continue - don't fail the withdrawal if recording fails
      }
    }

    // Invalidate cache and sync state
    const { data: vault } = await supabase
      .from('vaults')
      .select('contract_address')
      .eq('vault_id', vaultId)
      .single();

    if (vault?.contract_address) {
      invalidateVaultCache(vault.contract_address);
    }

    await syncVaultState(vaultId);

    return res.json({
      success: true,
      data: {
        transactionHash: txHash,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/:vaultId/submit-withdraw:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/:vaultId/deposit
 * Deposit assets into vault (legacy endpoint - uses server-side signing)
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

    // Get vault contract address to invalidate cache
    const { data: vault } = await supabase
      .from('vaults')
      .select('contract_address')
      .eq('vault_id', vaultId)
      .single();

    if (vault?.contract_address) {
      // Invalidate cache immediately after deposit
      invalidateVaultCache(vault.contract_address);
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

    // Invalidate cache immediately after withdrawal
    if (vault.contract_address) {
      invalidateVaultCache(vault.contract_address);
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

    // Enrich vaults with latest performance data
    const enrichedVaults = await Promise.all(
      (vaults || []).map(async (vault) => {
        const { data: latestSnapshot } = await supabase
          .from('vault_performance')
          .select('total_value, returns_24h, returns_7d, returns_30d, returns_all_time, apy_current')
          .eq('vault_id', vault.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        return {
          ...vault,
          performance: {
            tvl: latestSnapshot?.total_value || 0,
            returns24h: latestSnapshot?.returns_24h || null,
            returns7d: latestSnapshot?.returns_7d || null,
            returns30d: latestSnapshot?.returns_30d || null,
            returnsAllTime: latestSnapshot?.returns_all_time || null,
            apyCurrent: latestSnapshot?.apy_current || null,
          },
        };
      })
    );

    return res.json({
      success: true,
      data: {
        vaults: enrichedVaults,
        count: enrichedVaults.length,
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
    const { owner, config, name, description, network } = req.body;

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
        description: description || 'Vault draft created from visual builder',
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

    // Enrich vaults with latest performance data
    const enrichedVaults = await Promise.all(
      (vaults || []).map(async (vault) => {
        const { data: latestSnapshot } = await supabase
          .from('vault_performance')
          .select('total_value, returns_24h, returns_7d, returns_30d, returns_all_time, apy_current')
          .eq('vault_id', vault.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        return {
          ...vault,
          performance: {
            tvl: latestSnapshot?.total_value || 0,
            returns24h: latestSnapshot?.returns_24h || null,
            returns7d: latestSnapshot?.returns_7d || null,
            returns30d: latestSnapshot?.returns_30d || null,
            returnsAllTime: latestSnapshot?.returns_all_time || null,
            apyCurrent: latestSnapshot?.apy_current || null,
          },
        };
      })
    );

    return res.json({
      success: true,
      data: enrichedVaults,
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


