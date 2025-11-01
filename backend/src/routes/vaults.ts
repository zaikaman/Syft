import { Router, Request, Response } from 'express';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Keypair } from '@stellar/stellar-sdk';
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
import { naturalLanguageVaultGenerator } from '../services/naturalLanguageVaultGenerator.js';

const router = Router();

// Helper function to initialize a vault contract after deployment
async function initializeVaultContract(
  contractAddress: string,
  config: any,
  network?: string
): Promise<void> {
  const servers = getNetworkServers(network);
  
  // Use deployer keypair to initialize
  const deployerSecret = process.env.DEPLOYER_SECRET_KEY;
  if (!deployerSecret) {
    throw new Error('DEPLOYER_SECRET_KEY not set');
  }
  
  const deployerKeypair = Keypair.fromSecret(deployerSecret);
  const deployerAccount = await servers.horizonServer.loadAccount(deployerKeypair.publicKey());
  
  // Build VaultConfig with all 5 fields for initialization
  const vaultContract = new StellarSdk.Contract(contractAddress);
  
  // Convert assets to addresses
  const assetAddresses = (config.assets || []).map((asset: string) => {
    // This is a simplified version - reuse getAssetAddress logic from vaultDeploymentService
    if (asset === 'XLM') {
      return network === 'futurenet' 
        ? 'CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT'
        : 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
    } else if (asset === 'USDC') {
      return 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
    }
    return asset; // Assume it's already an address
  }).map((addr: string) => StellarSdk.Address.fromString(addr).toScVal());
  
  // Convert rules to Soroban ScVal format
  const rulesScVal = (config.rules || []).map((rule: any) => {
    // Build RebalanceRule struct (fields must be alphabetically ordered!)
    return StellarSdk.xdr.ScVal.scvMap([
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('action')),
        val: StellarSdk.nativeToScVal(rule.action, { type: 'string' }),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('condition_type')),
        val: StellarSdk.nativeToScVal(rule.condition_type, { type: 'string' }),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('target_allocation')),
        val: StellarSdk.xdr.ScVal.scvVec(
          rule.target_allocation.map((alloc: number) => StellarSdk.nativeToScVal(alloc, { type: 'i128' }))
        ),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('threshold')),
        val: StellarSdk.nativeToScVal(rule.threshold, { type: 'i128' }),
      }),
    ]);
  });
  
  console.log(`[initializeVaultContract] Converting ${config.rules?.length || 0} rules to ScVal format`);
  if (config.rules && config.rules.length > 0) {
    console.log(`[initializeVaultContract] Rules:`, config.rules.map((r: any, i: number) => 
      `Rule ${i}: ${r.action} with allocation ${r.target_allocation?.join(', ')}`
    ).join('; '));
  }
  
  // Build full VaultConfig struct (alphabetical order: assets, factory_address, name, owner, router_address, rules, staking_pool_address)
  const vaultConfigStruct = StellarSdk.xdr.ScVal.scvMap([
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('assets')),
      val: StellarSdk.xdr.ScVal.scvVec(assetAddresses),
    }),
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('factory_address')),
      val: StellarSdk.xdr.ScVal.scvVoid(), // Option::None
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
      val: StellarSdk.xdr.ScVal.scvVoid(), // Option::None
    }),
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('rules')),
      val: StellarSdk.xdr.ScVal.scvVec(rulesScVal), // Pass the actual rules!
    }),
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('staking_pool_address')),
      val: (() => {
        // Set staking pool address for testnet if any stake rules exist
        const hasStakeRules = config.rules?.some((r: any) => r.action === 'stake');
        if (hasStakeRules && network === 'testnet') {
          const stakingPoolAddress = 'CDLZVYS4GWBUKQAJYX5DFXUH4N2NVPW6QQZNSG6GJUMU4LQYPVCQLKFK';
          return StellarSdk.xdr.ScVal.scvVec([
            StellarSdk.Address.fromString(stakingPoolAddress).toScVal()
          ]); // Option::Some(Address)
        }
        return StellarSdk.xdr.ScVal.scvVoid(); // Option::None
      })(),
    }),
  ]);
  
  const operation = vaultContract.call('initialize', vaultConfigStruct);
  
  let transaction = new StellarSdk.TransactionBuilder(deployerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: servers.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();
  
  // Simulate and prepare transaction
  const simulationResponse = await servers.sorobanServer.simulateTransaction(transaction);
  
  if (StellarSdk.rpc.Api.isSimulationError(simulationResponse)) {
    throw new Error(`Initialize simulation failed: ${simulationResponse.error}`);
  }
  
  transaction = StellarSdk.rpc.assembleTransaction(transaction, simulationResponse).build();
  transaction.sign(deployerKeypair);
  
  // Submit transaction
  const submitResult = await servers.horizonServer.submitTransaction(transaction);
  console.log(`[Initialize] Transaction hash: ${submitResult.hash}`);
}

// Mount suggestions routes at /vaults/:vaultId/suggestions
router.use('/', suggestionsRoutes);

/**
 * POST /api/vaults/generate-from-prompt
 * Generate vault configuration from natural language
 */
router.post('/generate-from-prompt', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userPrompt, conversationHistory, currentVault, network, sessionId } = req.body;

    if (!userPrompt || typeof userPrompt !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Missing or invalid userPrompt',
      });
      return;
    }

    console.log('[Generate From Prompt] User prompt:', userPrompt);
    console.log('[Generate From Prompt] Conversation history length:', conversationHistory?.length || 0);
    console.log('[Generate From Prompt] Has current vault:', !!currentVault);
    console.log('[Generate From Prompt] Session ID:', sessionId);

    // Save user message to chat history if session exists
    if (sessionId) {
      try {
        const { chatHistoryService } = await import('../services/chatHistoryService.js');
        await chatHistoryService.addMessage({
          sessionId,
          role: 'user',
          content: userPrompt,
        });
      } catch (error) {
        console.warn('[Generate From Prompt] Failed to save user message:', error);
      }
    }

    // Generate vault using AI
    const result = await naturalLanguageVaultGenerator.generateVault({
      userPrompt,
      conversationHistory: conversationHistory || [],
      currentVault: currentVault || undefined,
      network: network || 'testnet',
    });

    console.log('[Generate From Prompt] Generated vault:', {
      nodeCount: result.nodes.length,
      edgeCount: result.edges.length,
      responseType: result.responseType,
    });

    // Save assistant response to chat history if session exists
    if (sessionId) {
      try {
        const { chatHistoryService } = await import('../services/chatHistoryService.js');
        await chatHistoryService.addMessage({
          sessionId,
          role: 'assistant',
          content: result.explanation,
          responseType: result.responseType,
          vaultSnapshot: result.responseType === 'build' ? { nodes: result.nodes, edges: result.edges } : undefined,
          marketContext: result.marketContext,
        });

        // Mark vault as generated if built
        if (result.responseType === 'build' && result.nodes.length > 0) {
          await chatHistoryService.markVaultGenerated(sessionId);
        }
      } catch (error) {
        console.warn('[Generate From Prompt] Failed to save assistant message:', error);
      }
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error generating vault from prompt:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate vault',
    });
  }
});

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
      assets: vault.config?.assets?.map((a: any) => {
        // Handle both string assets ("XLM") and object assets ({ code: "XLM" })
        if (typeof a === 'string') {
          return a;
        }
        return a.code || a.assetCode || a;
      }) || [],
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

    console.log(`[Submit Deploy] Received signedXDR length:`, signedXDR?.length);
    console.log(`[Submit Deploy] Network:`, network);
    console.log(`[Submit Deploy] Network passphrase:`, servers.networkPassphrase);

    // Parse the signed transaction
    let transaction;
    try {
      transaction = StellarSdk.TransactionBuilder.fromXDR(
        signedXDR,
        servers.networkPassphrase
      );
      console.log(`[Submit Deploy] ✓ Transaction parsed successfully`);
    } catch (parseError) {
      console.error(`[Submit Deploy] ✗ Failed to parse XDR:`, parseError);
      return res.status(400).json({
        success: false,
        error: 'Failed to parse signed transaction',
        details: parseError instanceof Error ? parseError.message : String(parseError),
      });
    }

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

    console.log(`[Submit Deploy] Vault deployed successfully at ${contractAddress}, now initializing...`);

    // Initialize the vault with the full config
    try {
      console.log(`[Submit Deploy] Calling initializeVaultContract with config:`, JSON.stringify(config));
      await initializeVaultContract(contractAddress, config, network);
      console.log(`[Submit Deploy] ✅ Vault initialized successfully`);
    } catch (initError) {
      console.error(`[Submit Deploy] ❌ Failed to initialize vault:`, initError);
      console.error(`[Submit Deploy] Error stack:`, initError instanceof Error ? initError.stack : 'No stack trace');
      // Continue anyway - we'll store the vault but mark it as needing initialization
    }

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

    // NOTE: Router setup is now handled by the frontend after deployment
    // The owner must sign the set_router transaction for proper authorization
    console.log(`[Vault Deployed] Vault deployed and initialized successfully`);
    console.log(`[Vault Deployed] Frontend will handle router setup with owner authorization`);

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
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('factory_address')),
        val: StellarSdk.xdr.ScVal.scvVoid(), // Option::None
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
        val: StellarSdk.xdr.ScVal.scvVoid(), // Option::None
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('rules')),
        val: StellarSdk.xdr.ScVal.scvVec([]),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('staking_pool_address')),
        val: StellarSdk.xdr.ScVal.scvVoid(), // Option::None
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
 * POST /api/vaults/build-set-router
 * Build unsigned set_router transaction for vault owner to sign
 */
router.post('/build-set-router', async (req: Request, res: Response) => {
  try {
    const { contractAddress, ownerAddress, network } = req.body;

    if (!contractAddress || !ownerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: contractAddress, ownerAddress',
      });
    }

    console.log(`[Build Set Router] Building set_router transaction for ${contractAddress}`);
    
    const servers = getNetworkServers(network);
    
    // Load owner account
    const ownerAccount = await servers.horizonServer.loadAccount(ownerAddress);
    
    // Router address (Soroswap testnet)
    const routerAddress = 'CCMAPXWVZD4USEKDWRYS7DA4Y3D7E2SDMGBFJUCEXTC7VN6CUBGWPFUS';
    
    // Create contract instance
    const vaultContract = new StellarSdk.Contract(contractAddress);
    
    // Build set_router operation
    const operation = vaultContract.call(
      'set_router',
      StellarSdk.Address.fromString(routerAddress).toScVal()
    );
    
    // Build transaction
    let transaction = new StellarSdk.TransactionBuilder(ownerAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: servers.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();
    
    console.log(`[Build Set Router] Simulating transaction...`);
    
    // Simulate transaction
    const simulationResponse = await servers.sorobanServer.simulateTransaction(transaction);
    
    if (StellarSdk.rpc.Api.isSimulationError(simulationResponse)) {
      console.error(`[Build Set Router] Simulation failed:`, simulationResponse);
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }
    
    // Assemble transaction with simulation results
    transaction = StellarSdk.rpc.assembleTransaction(transaction, simulationResponse).build();
    
    console.log(`[Build Set Router] Transaction built successfully`);
    
    return res.json({
      success: true,
      data: {
        xdr: transaction.toXDR(),
        routerAddress,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/build-set-router:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/submit-set-router
 * Submit signed set_router transaction
 */
router.post('/submit-set-router', async (req: Request, res: Response) => {
  try {
    const { signedXDR, contractAddress, network } = req.body;

    if (!signedXDR || !contractAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: signedXDR, contractAddress',
      });
    }

    console.log(`[Submit Set Router] Submitting set_router transaction for ${contractAddress}`);
    
    const servers = getNetworkServers(network);
    
    // Parse signed transaction
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      signedXDR,
      servers.networkPassphrase
    );
    
    console.log(`[Submit Set Router] Submitting to network...`);
    
    // Submit transaction
    const submitResult = await servers.horizonServer.submitTransaction(transaction);
    const txHash = submitResult.hash;
    
    console.log(`[Submit Set Router] ✅ Router configured successfully! TX: ${txHash}`);
    
    return res.json({
      success: true,
      data: {
        transactionHash: txHash,
        contractAddress,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/submit-set-router:', error);
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
    const { userAddress, amount, network, depositToken } = req.body;

    if (!userAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userAddress, amount',
      });
    }

    // Build unsigned transaction with optional depositToken for auto-swap
    const { xdr, contractAddress } = await buildDepositTransaction(
      vaultId,
      userAddress,
      amount,
      network,
      depositToken
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
    let receivedShares: string = amount; // fallback to amount if parsing fails
    try {
      const submitResult = await servers.horizonServer.submitTransaction(transaction);
      txHash = submitResult.hash;
      console.log(`[Submit Deposit] ✅ Transaction submitted successfully: ${txHash}`);
      
      // Try to extract the actual shares received from the transaction result
      try {
        // The contract returns the shares amount as the result
        // Parse it from the transaction metadata
        if ((submitResult as any).returnValue) {
          const returnValue = StellarSdk.scValToNative((submitResult as any).returnValue);
          if (returnValue && typeof returnValue === 'bigint') {
            receivedShares = returnValue.toString();
            console.log(`[Submit Deposit] Extracted received shares: ${receivedShares}`);
          }
        }
      } catch (parseError) {
        console.warn('[Submit Deposit] Could not parse shares from transaction result, using amount as fallback');
      }
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
        
        // Use the actual shares received from the contract
        await recordVaultTransaction({
          vaultId,
          userAddress,
          type: 'deposit',
          amountStroops: amount,
          shares: receivedShares,
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

    // IMPORTANT: Automatically trigger rebalance after successful deposit
    // This is done in a SEPARATE transaction because Soroban requires explicit user authorization
    // The deposit transaction transfers tokens, the rebalance transaction swaps to target allocation
    let rebalanceTxHash: string | undefined;
    try {
      console.log(`[Submit Deposit] Triggering auto-rebalance after deposit...`);
      
      // Import the rebalance helper
      const { buildRebalanceTransaction } = await import('../services/vaultActionService.js');
      
      // Get vault info to check if it has rules requiring rebalance
      const { data: vault } = await supabase
        .from('vaults')
        .select('config')
        .eq('vault_id', vaultId)
        .single();
      
      // Only auto-rebalance if:
      // 1. Vault has rebalance rules configured
      // 2. Vault has multiple assets (single-asset vaults don't need rebalancing)
      const hasMultipleAssets = vault?.config?.assets && vault.config.assets.length > 1;
      const hasRebalanceRules = vault?.config?.rules && vault.config.rules.length > 0;
      
      if (hasRebalanceRules && hasMultipleAssets) {
        // Build rebalance transaction (force_rebalance, not trigger_rebalance)
        const { xdr: rebalanceXDR } = await buildRebalanceTransaction(
          vaultId,
          userAddress,
          network,
          true // force = true to skip rule checks
        );
        
        // Parse transaction
        const rebalanceTx = StellarSdk.TransactionBuilder.fromXDR(
          rebalanceXDR,
          servers.networkPassphrase
        );
        
        // Submit rebalance transaction
        const rebalanceResult = await servers.horizonServer.submitTransaction(rebalanceTx);
        rebalanceTxHash = rebalanceResult.hash;
        
        console.log(`[Submit Deposit] ✅ Auto-rebalance completed: ${rebalanceTxHash}`);
        
        // Sync vault state again after rebalance
        await syncVaultState(vaultId);
      } else if (!hasMultipleAssets) {
        console.log(`[Submit Deposit] Single-asset vault, skipping auto-rebalance`);
      } else {
        console.log(`[Submit Deposit] No rebalance rules configured, skipping auto-rebalance`);
      }
    } catch (rebalanceError) {
      console.error('[Submit Deposit] Auto-rebalance failed (non-critical):', rebalanceError);
      // Don't fail the deposit if rebalance fails - just log it
      // The user can manually trigger rebalance later
    }

    return res.json({
      success: true,
      data: {
        transactionHash: txHash,
        rebalanceTransactionHash: rebalanceTxHash,
        autoRebalanced: !!rebalanceTxHash,
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
 * POST /api/vaults/:vaultId/build-rebalance
 * Build unsigned rebalance transaction for user to sign
 */
router.post('/:vaultId/build-rebalance', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { userAddress, network } = req.body;

    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userAddress',
      });
    }

    // Get vault from database
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

    const servers = getNetworkServers(network);
    const userAccount = await servers.horizonServer.loadAccount(userAddress);

    // Build transaction to call force_rebalance (bypasses rule checks for post-deposit swaps)
    const contract = new StellarSdk.Contract(vault.contract_address);
    const operation = contract.call('force_rebalance');

    let transaction = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: servers.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    // Simulate transaction
    const simulationResponse = await servers.sorobanServer.simulateTransaction(transaction);
    
    if (StellarSdk.rpc.Api.isSimulationError(simulationResponse)) {
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }

    // Assemble transaction
    transaction = StellarSdk.rpc.assembleTransaction(transaction, simulationResponse).build();

    return res.json({
      success: true,
      data: {
        xdr: transaction.toXDR(),
        contractAddress: vault.contract_address,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/:vaultId/build-rebalance:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/:vaultId/submit-rebalance
 * Submit signed rebalance transaction
 */
router.post('/:vaultId/submit-rebalance', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { signedXDR, network } = req.body;

    if (!signedXDR) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: signedXDR',
      });
    }

    console.log(`[Submit Rebalance] Submitting signed rebalance transaction...`);

    const servers = getNetworkServers(network);
    const transaction = StellarSdk.TransactionBuilder.fromXDR(signedXDR, servers.networkPassphrase);
    
    const txResponse = await servers.horizonServer.submitTransaction(transaction);
    const txHash = txResponse.hash;

    console.log(`[Submit Rebalance] ✅ Transaction submitted successfully: ${txHash}`);

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
    console.error('Error in POST /api/vaults/:vaultId/submit-rebalance:', error);
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
    let withdrawnAmount: string = shares; // fallback to shares if parsing fails
    try {
      const submitResult = await servers.horizonServer.submitTransaction(transaction);
      txHash = submitResult.hash;
      console.log(`[Submit Withdrawal] ✅ Transaction submitted successfully: ${txHash}`);
      
      // Try to extract the actual withdrawn amount from the transaction result
      try {
        // The contract returns the withdrawn amount as the result
        // Parse it from the transaction metadata
        if ((submitResult as any).returnValue) {
          const returnValue = StellarSdk.scValToNative((submitResult as any).returnValue);
          if (returnValue && typeof returnValue === 'bigint') {
            withdrawnAmount = returnValue.toString();
            console.log(`[Submit Withdrawal] Extracted withdrawn amount: ${withdrawnAmount} stroops`);
          }
        }
      } catch (parseError) {
        console.warn('[Submit Withdrawal] Could not parse withdrawn amount from transaction result, using shares as fallback');
      }
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
        
        // Use the actual withdrawn amount (in stroops)
        await recordVaultTransaction({
          vaultId,
          userAddress,
          type: 'withdrawal',
          amountStroops: withdrawnAmount,
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

/**
 * GET /api/vaults/subscriptions/:walletAddress
 * Get all vault subscriptions for a user
 */
router.get('/subscriptions/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const { network } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
    }

    // Get all subscriptions for this user
    const { data: subscriptions, error: subsError } = await supabase
      .from('vault_subscriptions')
      .select(`
        *,
        original_vault:vaults!vault_subscriptions_original_vault_id_fkey(*),
        subscribed_vault:vaults!vault_subscriptions_subscribed_vault_id_fkey(*)
      `)
      .eq('subscriber_wallet_address', walletAddress)
      .order('subscribed_at', { ascending: false });

    if (subsError) {
      throw subsError;
    }

    // Filter by network if provided
    let filteredSubscriptions = subscriptions || [];
    if (network) {
      filteredSubscriptions = filteredSubscriptions.filter(
        (sub: any) => sub.subscribed_vault?.network === network
      );
      console.log(`[Get User Subscriptions] Filtering by network: ${network}`);
    }

    // Enrich with current position data for each subscribed vault
    const enrichedSubscriptions = await Promise.all(
      filteredSubscriptions.map(async (subscription: any) => {
        const subscribedVault = subscription.subscribed_vault;
        
        if (!subscribedVault) {
          return subscription;
        }

        // Get user's position in the subscribed vault
        const { data: position } = await supabase
          .from('vault_positions')
          .select('shares, initial_deposit, current_value')
          .eq('vault_id', subscribedVault.id)
          .eq('user_address', walletAddress)
          .single();

        // Get latest performance data
        const { data: latestSnapshot } = await supabase
          .from('vault_performance')
          .select('total_value, returns_24h, returns_7d, returns_30d, returns_all_time, apy_current')
          .eq('vault_id', subscribedVault.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        return {
          subscription_id: subscription.id,
          vault_id: subscribedVault.vault_id,
          subscriber_address: subscription.subscriber_wallet_address,
          shares: position?.shares || '0',
          initial_deposit: position?.initial_deposit || '0',
          current_value: position?.current_value || '0',
          subscribed_at: subscription.subscribed_at,
          profit_share_percentage: subscription.profit_share_percentage,
          vault: {
            ...subscribedVault,
            performance: {
              tvl: latestSnapshot?.total_value || 0,
              returns24h: latestSnapshot?.returns_24h || null,
              returns7d: latestSnapshot?.returns_7d || null,
              returns30d: latestSnapshot?.returns_30d || null,
              returnsAllTime: latestSnapshot?.returns_all_time || null,
              apyCurrent: latestSnapshot?.apy_current || null,
            },
          },
        };
      })
    );

    return res.json({
      success: true,
      data: enrichedSubscriptions,
    });
  } catch (error) {
    console.error('Error in GET /api/vaults/subscriptions/:walletAddress:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Get staking positions for a vault
router.get('/:id/positions/staking', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: positions, error } = await supabase
      .from('vault_staking_positions')
      .select('*')
      .eq('vault_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      data: positions || [],
    });
  } catch (error) {
    console.error('Error fetching staking positions:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Get liquidity positions for a vault
router.get('/:id/positions/liquidity', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: positions, error } = await supabase
      .from('vault_liquidity_positions')
      .select('*')
      .eq('vault_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      data: positions || [],
    });
  } catch (error) {
    console.error('Error fetching liquidity positions:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Get all positions (staking + liquidity) for a vault
router.get('/:id/positions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [stakingResult, liquidityResult] = await Promise.all([
      supabase
        .from('vault_staking_positions')
        .select('*')
        .eq('vault_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('vault_liquidity_positions')
        .select('*')
        .eq('vault_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (stakingResult.error) throw stakingResult.error;
    if (liquidityResult.error) throw liquidityResult.error;

    return res.json({
      success: true,
      data: {
        staking: stakingResult.data || [],
        liquidity: liquidityResult.data || [],
      },
    });
  } catch (error) {
    console.error('Error fetching vault positions:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;


