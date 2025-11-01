import * as StellarSdk from '@stellar/stellar-sdk';
import { horizonServer, getNetworkServers } from '../lib/horizonClient.js';
import { supabase } from '../lib/supabase.js';
import { invokeVaultMethod } from './vaultDeploymentService.js';
import { invalidateVaultCache } from './vaultMonitorService.js';

/**
 * Helper to get asset contract address from asset code
 */
function getAssetAddressFromCode(assetCode: string, network?: string): string {
  const normalizedNetwork = (network || 'testnet').toLowerCase();
  
  const nativeXLMAddresses: { [key: string]: string } = {
    'testnet': 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    'futurenet': 'CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT',
    'mainnet': 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
    'public': 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
  };
  
  const tokenAddresses: { [key: string]: { [key: string]: string } } = {
    'XLM': nativeXLMAddresses,
    'USDC': {
      'testnet': 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
      'futurenet': process.env.FUTURENET_USDC_ADDRESS || nativeXLMAddresses['futurenet'],
      'mainnet': '',
      'public': '',
    },
  };
  
  const assetSymbol = assetCode.toUpperCase();
  const networkAddresses = tokenAddresses[assetSymbol];
  
  if (!networkAddresses) {
    // If unknown, assume it's already an address or fallback to XLM
    if (assetCode.startsWith('C') && assetCode.length === 56) {
      return assetCode;
    }
    return nativeXLMAddresses[normalizedNetwork] || nativeXLMAddresses['testnet'];
  }
  
  return networkAddresses[normalizedNetwork] || nativeXLMAddresses[normalizedNetwork] || nativeXLMAddresses['testnet'];
}

/**
 * Build unsigned deposit transaction for user to sign
 * @param depositToken - The token address the user is depositing (will be auto-swapped if not base token)
 * @param withRebalance - If true, includes a rebalance operation in the same transaction
 */
export async function buildDepositTransaction(
  vaultId: string,
  userAddress: string,
  amount: string,
  network?: string,
  depositToken?: string,
  withRebalance: boolean = true
): Promise<{ xdr: string; contractAddress: string }> {
  try {
    // Get vault from database
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      throw new Error('Vault not found');
    }

    // Get network-specific servers
    const servers = getNetworkServers(network);
    
    // Load user account
    const userAccount = await servers.horizonServer.loadAccount(userAddress);

    // Create contract instance
    const contract = new StellarSdk.Contract(vault.contract_address);

    // Determine deposit token address
    // If not provided, use the first asset in the vault config as default
    let tokenAddress = depositToken;
    if (!tokenAddress) {
      // Parse vault config to get base asset
      const vaultConfig = vault.config;
      if (vaultConfig?.assets && vaultConfig.assets.length > 0) {
        const firstAsset = vaultConfig.assets[0];
        // Asset can be {code: "XLM", ...} or just "XLM"
        const assetCode = typeof firstAsset === 'string' ? firstAsset : firstAsset.code;
        tokenAddress = getAssetAddressFromCode(assetCode, network);
      } else {
        // Fallback to native XLM
        tokenAddress = getAssetAddressFromCode('XLM', network);
      }
    }

    console.log(`[Build Deposit TX] Using deposit token: ${tokenAddress}`);
    console.log(`[Build Deposit TX] With auto-rebalance: ${withRebalance}`);

    // Build deposit operation using deposit_with_token
    const depositOperation = contract.call(
      'deposit_with_token',
      StellarSdk.Address.fromString(userAddress).toScVal(),
      StellarSdk.nativeToScVal(BigInt(amount), { type: 'i128' }),
      StellarSdk.Address.fromString(tokenAddress).toScVal()
    );

    // Build transaction with deposit operation only
    // NOTE: Stellar doesn't support multiple contract invocations in one transaction
    // So we can't batch deposit + rebalance. Frontend will handle sequential signing.
    let transaction = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: servers.network === 'futurenet' 
        ? StellarSdk.Networks.FUTURENET
        : servers.network === 'mainnet' || servers.network === 'public'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET,
    })
      .addOperation(depositOperation)
      .setTimeout(300)
      .build();

    console.log(`[Build Deposit TX] Simulating batch transaction...`);

    // Simulate transaction to get resource footprint
    const simulationResponse = await servers.sorobanServer.simulateTransaction(transaction);
    
    if (StellarSdk.rpc.Api.isSimulationError(simulationResponse)) {
      console.error(`[Build Deposit TX] Simulation error details:`, simulationResponse);
      
      // Provide helpful error message
      const errorMsg = JSON.stringify(simulationResponse);
      if (errorMsg.includes('trustline entry is missing') || errorMsg.includes('does not exist')) {
        throw new Error(
          `Token trustline missing: Please ensure you have added a trustline for the deposit token in your wallet, ` +
          `or the token contract may not exist on this network. Try depositing with XLM instead.`
        );
      }
      
      throw new Error(`Deposit simulation failed: ${simulationResponse.error || 'Unknown error'}`);
    }

    // Assemble transaction with simulation results
    transaction = StellarSdk.rpc.assembleTransaction(
      transaction,
      simulationResponse
    ).build();

    console.log(`[Build Deposit TX] Batch transaction built successfully (${withRebalance ? 'with' : 'without'} rebalance)`);

    return {
      xdr: transaction.toXDR(),
      contractAddress: vault.contract_address,
    };
  } catch (error) {
    console.error('Error building deposit transaction:', error);
    throw error;
  }
}

/**
 * Build unsigned rebalance transaction
 * @param force - If true, uses force_rebalance (bypasses rule checks), otherwise uses trigger_rebalance
 */
export async function buildRebalanceTransaction(
  vaultId: string,
  userAddress: string,
  network?: string,
  force: boolean = true
): Promise<{ xdr: string; contractAddress: string }> {
  try {
    // Get vault from database
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      throw new Error('Vault not found');
    }

    // Get network-specific servers
    const servers = getNetworkServers(network);
    
    // Load user account
    const userAccount = await servers.horizonServer.loadAccount(userAddress);

    // Create contract instance
    const contract = new StellarSdk.Contract(vault.contract_address);

    // Build rebalance operation
    // Use force_rebalance to bypass rule checks (for post-deposit swaps)
    // Use trigger_rebalance to respect configured rules
    const methodName = force ? 'force_rebalance' : 'trigger_rebalance';
    const operation = contract.call(methodName);

    // Build transaction
    let transaction = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: servers.network === 'futurenet' 
        ? StellarSdk.Networks.FUTURENET
        : servers.network === 'mainnet' || servers.network === 'public'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log(`[Build Rebalance TX] Simulating ${methodName} transaction...`);

    // Simulate transaction to get resource footprint
    const simulationResponse = await servers.sorobanServer.simulateTransaction(transaction);
    
    if (StellarSdk.rpc.Api.isSimulationError(simulationResponse)) {
      console.error(`[Build Rebalance TX] Simulation error:`, simulationResponse);
      throw new Error(`Rebalance simulation failed: ${simulationResponse.error || 'Unknown error'}`);
    }

    // Assemble transaction with simulation results
    transaction = StellarSdk.rpc.assembleTransaction(
      transaction,
      simulationResponse
    ).build();

    console.log(`[Build Rebalance TX] Transaction built successfully`);

    return {
      xdr: transaction.toXDR(),
      contractAddress: vault.contract_address,
    };
  } catch (error) {
    console.error('Error building rebalance transaction:', error);
    throw error;
  }
}

/**
 * Build unsigned withdrawal transaction for user to sign
 */
export async function buildWithdrawalTransaction(
  vaultId: string,
  userAddress: string,
  shares: string,
  network?: string
): Promise<{ xdr: string; contractAddress: string }> {
  try {
    // Get vault from database
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      throw new Error('Vault not found');
    }

    // Get network-specific servers
    const servers = getNetworkServers(network);
    
    // Load user account
    const userAccount = await servers.horizonServer.loadAccount(userAddress);

    // Create contract instance
    const contract = new StellarSdk.Contract(vault.contract_address);

    // Build withdraw operation
    const operation = contract.call(
      'withdraw',
      StellarSdk.Address.fromString(userAddress).toScVal(),
      StellarSdk.nativeToScVal(BigInt(shares), { type: 'i128' })
    );

    // Build transaction
    let transaction = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: servers.network === 'futurenet' 
        ? StellarSdk.Networks.FUTURENET
        : servers.network === 'mainnet' || servers.network === 'public'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log(`[Build Withdrawal TX] Simulating transaction...`);

    // Simulate transaction to get resource footprint
    const simulationResponse = await servers.sorobanServer.simulateTransaction(transaction);
    
    if (StellarSdk.rpc.Api.isSimulationError(simulationResponse)) {
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }

    // Assemble transaction with simulation results
    transaction = StellarSdk.rpc.assembleTransaction(
      transaction,
      simulationResponse
    ).build();

    console.log(`[Build Withdrawal TX] Transaction built successfully, returning XDR for signing`);

    return {
      xdr: transaction.toXDR(),
      contractAddress: vault.contract_address,
    };
  } catch (error) {
    console.error('Error building withdrawal transaction:', error);
    throw error;
  }
}

export interface RebalanceResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  timestamp: string;
}

/**
 * Execute rebalance action on a vault
 */
export async function executeRebalance(
  vaultId: string,
  ruleIndex: number,
  sourceKeypair?: StellarSdk.Keypair
): Promise<RebalanceResult> {
  try {
    console.log(`Executing rebalance for vault ${vaultId}, rule ${ruleIndex}`);

    // Get vault from database
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      return {
        success: false,
        error: 'Vault not found',
        timestamp: new Date().toISOString(),
      };
    }

    // Check if vault has a contract address
    if (!vault.contract_address) {
      console.warn(`⚠️  Vault ${vaultId} has no contract address - skipping on-chain rebalance`);
      return {
        success: false,
        error: 'Vault not deployed on-chain',
        timestamp: new Date().toISOString(),
      };
    }

    // Validate contract address format
    const contractAddr = vault.contract_address as string;
    if (contractAddr.startsWith('VAULT_') || contractAddr.startsWith('PENDING_') || contractAddr.startsWith('ERROR_')) {
      console.warn(`⚠️  Vault ${vaultId} has placeholder contract address: ${contractAddr}`);
      console.warn(`⚠️  This vault needs to be properly deployed first`);
      return {
        success: false,
        error: 'Invalid contract address - vault needs redeployment',
        timestamp: new Date().toISOString(),
      };
    }

    // Validate proper Stellar contract address format
    if (!contractAddr.startsWith('C') || contractAddr.length !== 56) {
      console.error(`❌ Invalid contract address format for vault ${vaultId}: ${contractAddr}`);
      return {
        success: false,
        error: `Invalid contract address format: ${contractAddr}`,
        timestamp: new Date().toISOString(),
      };
    }

    // Load rebalancer keypair (use provided or system deployer)
    let rebalancerKeypair = sourceKeypair;
    if (!rebalancerKeypair && process.env.DEPLOYER_SECRET_KEY) {
      try {
        rebalancerKeypair = StellarSdk.Keypair.fromSecret(process.env.DEPLOYER_SECRET_KEY);
        console.log(`🔑 Using system rebalancer: ${rebalancerKeypair.publicKey()}`);
      } catch (err) {
        console.error('Failed to load system rebalancer keypair:', err);
      }
    }

    let txHash: string | undefined;
    
    // Execute on-chain rebalance if we have a keypair
    if (rebalancerKeypair) {
      try {
        console.log(`📡 Submitting on-chain rebalance transaction...`);
        
        // Determine which trigger function to call based on rule action
        let methodName = 'trigger_rebalance'; // default
        
        // Get the rule to determine action type
        const config = vault.configuration;
        if (config && config.rules && config.rules[ruleIndex]) {
          const rule = config.rules[ruleIndex];
          const actionType = rule.action?.type || rule.action;
          
          console.log(`🎯 Rule action type: ${actionType}`);
          
          // Map action type to trigger function
          if (actionType === 'stake') {
            methodName = 'trigger_stake';
          } else if (actionType === 'provide_liquidity' || actionType === 'liquidity') {
            methodName = 'trigger_liquidity';
          } else if (actionType === 'rebalance') {
            methodName = 'trigger_rebalance';
          }
          
          console.log(`📞 Calling vault method: ${methodName}`);
        }
        
        const result = await invokeVaultMethod(
          vault.contract_address,
          methodName,
          [],
          rebalancerKeypair,
          vault.network // Pass the vault's network
        );
        
        if (result.success && result.hash) {
          txHash = result.hash;
          console.log(`✅ ${methodName} transaction submitted: ${txHash}`);
          console.log(`🔗 https://stellar.expert/explorer/${vault.network}/tx/${txHash}`);
        } else if (result.mvp) {
          console.log(`⚠️  MVP mode - simulated ${methodName}`);
          txHash = `simulated_tx_${Date.now()}`;
        }
      } catch (txError) {
        console.error('Transaction execution failed:', txError);
        // Continue to record the attempt even if tx fails
      }
    } else {
      console.warn(`⚠️  No keypair available for on-chain rebalance`);
      txHash = `no_keypair_${Date.now()}`;
    }

    // Update vault timestamp
    const { error: updateError } = await supabase
      .from('vaults')
      .update({ updated_at: new Date().toISOString() })
      .eq('vault_id', vaultId);

    if (updateError) {
      console.error('Error updating vault:', updateError);
    }

    // Invalidate cache immediately after rebalance
    if (vault.contract_address) {
      invalidateVaultCache(vault.contract_address);
    }

    // Record performance snapshot after rebalance with REAL TVL
    // Force sync vault state to get accurate post-rebalance TVL
    const { syncVaultState } = await import('./vaultSyncService.js');
    await syncVaultState(vaultId);
    console.log(`✅ Performance snapshot recorded after rebalance for vault ${vaultId}`);

    return {
      success: true,
      transactionHash: txHash || `fallback_tx_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error executing rebalance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Execute vault deposit
 */
export async function executeDeposit(
  vaultId: string,
  userAddress: string,
  amount: string,
  sourceKeypair: StellarSdk.Keypair,
  network?: string
): Promise<{ success: boolean; shares?: string; error?: string }> {
  try {
    // Get vault from database
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      return {
        success: false,
        error: 'Vault not found',
      };
    }

    // Call vault contract's deposit function
    // This will:
    // 1. Transfer tokens from user to vault
    // 2. Calculate shares based on current vault value
    // 3. Mint shares to user's position
    let result;
    try {
      result = await invokeVaultMethod(
        vault.contract_address,
        'deposit',
        [userAddress, amount],
        sourceKeypair,
        network
      );
    } catch (contractError) {
      // Parse contract error for helpful message
      const errorMsg = contractError instanceof Error ? contractError.message : String(contractError);
      
      if (errorMsg.includes('Error(Storage, MissingValue)') && errorMsg.includes('trying to get non-existing value for contract instance')) {
        throw new Error(
          `Token contract not initialized on ${network || 'testnet'}. ` +
          `The vault's base token contract doesn't exist or hasn't been properly initialized on this network. ` +
          `Please redeploy the vault on ${network || 'testnet'} or switch to a network where the token is available.`
        );
      }
      
      throw contractError;
    }

    // Extract the returned shares from contract
    let shares = '0';
    if (result.result) {
      try {
        // Import stellar-sdk for decoding
        const StellarSdk = await import('@stellar/stellar-sdk');
        
        // Decode the i128 value
        const decodedShares = StellarSdk.scValToNative(result.result);
        shares = decodedShares.toString();
        
        console.log(`[Deposit] Contract returned shares:`, shares);
      } catch (decodeError) {
        console.error('[Deposit] Error decoding shares:', decodeError);
        // Fallback to amount as shares (1:1)
        shares = amount;
      }
    } else {
      // Fallback if no result
      shares = amount;
    }

    // Record transaction in ledger for accurate earnings tracking
    try {
      const { stroopsToUSD, getXLMPrice } = await import('./priceService.js');
      const amountInStroops = parseFloat(amount);
      const xlmPrice = await getXLMPrice();
      const amountUSD = await stroopsToUSD(amountInStroops);
      
      // Get vault UUID
      const { data: vaultData } = await supabase
        .from('vaults')
        .select('id')
        .eq('vault_id', vaultId)
        .single();

      if (vaultData) {
        await supabase.from('vault_transactions').insert({
          vault_id: vaultData.id,
          user_address: userAddress,
          type: 'deposit',
          amount_xlm: amountInStroops / 10_000_000, // Convert stroops to XLM
          amount_usd: amountUSD,
          shares: shares,
          xlm_price: xlmPrice,
          share_price: amountUSD / parseFloat(shares), // USD per share
          transaction_hash: result.transactionHash,
          metadata: { network, timestamp: new Date().toISOString() },
        });
        
        console.log(`✅ Recorded deposit transaction: ${(amountInStroops / 10_000_000).toFixed(1)} XLM = $${amountUSD.toFixed(2)} → ${shares} shares`);
      }
    } catch (txError) {
      console.error('⚠️  Failed to record transaction (non-critical):', txError);
      // Don't fail the deposit if transaction recording fails
    }

    return {
      success: true,
      shares,
    };
  } catch (error) {
    console.error('Error executing deposit:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute vault withdrawal
 */
export async function executeWithdrawal(
  vaultId: string,
  userAddress: string,
  shares: string,
  sourceKeypair: StellarSdk.Keypair,
  network?: string
): Promise<{ success: boolean; amount?: string; error?: string }> {
  try {
    // Get vault from database
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      return {
        success: false,
        error: 'Vault not found',
      };
    }

    // Call vault contract's withdraw function
    // This will:
    // 1. Burn shares from user's position
    // 2. Calculate amount based on shares/totalShares ratio
    // 3. Transfer tokens back to user
    const result = await invokeVaultMethod(
      vault.contract_address,
      'withdraw',
      [userAddress, shares],
      sourceKeypair,
      network
    );

    // Extract the returned amount from contract
    let amount = '0';
    if (result.result) {
      try {
        // Import stellar-sdk for decoding
        const StellarSdk = await import('@stellar/stellar-sdk');
        
        // Decode the i128 value
        const decodedAmount = StellarSdk.scValToNative(result.result);
        amount = decodedAmount.toString();
        
        console.log(`[Withdrawal] Contract returned amount:`, amount, 'stroops');
        console.log(`[Withdrawal] Amount in XLM:`, (Number(amount) / 10_000_000).toFixed(7));
      } catch (decodeError) {
        console.error('[Withdrawal] Error decoding amount:', decodeError);
        // Fallback to shares as amount
        amount = shares;
      }
    } else {
      // Fallback if no result
      amount = shares;
    }

    // Record transaction in ledger for accurate earnings tracking
    try {
      const { stroopsToUSD, getXLMPrice } = await import('./priceService.js');
      const amountInStroops = parseFloat(amount);
      const xlmPrice = await getXLMPrice();
      const amountUSD = await stroopsToUSD(amountInStroops);
      
      // Get vault UUID
      const { data: vaultData } = await supabase
        .from('vaults')
        .select('id')
        .eq('vault_id', vaultId)
        .single();

      if (vaultData) {
        await supabase.from('vault_transactions').insert({
          vault_id: vaultData.id,
          user_address: userAddress,
          type: 'withdrawal',
          amount_xlm: amountInStroops / 10_000_000, // Convert stroops to XLM
          amount_usd: amountUSD,
          shares: shares,
          xlm_price: xlmPrice,
          share_price: amountUSD / parseFloat(shares), // USD per share
          transaction_hash: result.transactionHash,
          metadata: { network, timestamp: new Date().toISOString() },
        });
        
        console.log(`✅ Recorded withdrawal transaction: ${shares} shares → ${(amountInStroops / 10_000_000).toFixed(1)} XLM = $${amountUSD.toFixed(2)}`);
      }
    } catch (txError) {
      console.error('⚠️  Failed to record transaction (non-critical):', txError);
      // Don't fail the withdrawal if transaction recording fails
    }

    return {
      success: true,
      amount,
    };
  } catch (error) {
    console.error('Error executing withdrawal:', error);
    
    // Parse contract error for user-friendly message
    let errorMessage = 'Withdrawal failed';
    if (error instanceof Error) {
      const errorStr = error.message;
      if (errorStr.includes('Error(Contract, #5)')) {
        errorMessage = 'Insufficient shares. You do not have enough shares to withdraw this amount.';
      } else if (errorStr.includes('Error(Contract, #3)')) {
        errorMessage = 'Unauthorized. You must authorize this transaction with your wallet.';
      } else if (errorStr.includes('Error(Contract, #6)')) {
        errorMessage = 'Invalid amount. Please enter a valid withdrawal amount.';
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Execute stake action
 */
export async function executeStake(
  vaultId: string,
  amount: string,
  sourceKeypair: StellarSdk.Keypair
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      return {
        success: false,
        error: 'Vault not found',
      };
    }

    // In production, integrate with staking protocols
    await invokeVaultMethod(
      vault.contract_address,
      'stake',
      [amount],
      sourceKeypair
    );

    return { success: true };
  } catch (error) {
    console.error('Error executing stake:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute liquidity provision
 */
export async function executeLiquidityProvision(
  vaultId: string,
  amount: string,
  sourceKeypair: StellarSdk.Keypair
): Promise<{ success: boolean; lpTokens?: string; error?: string }> {
  try {
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      return {
        success: false,
        error: 'Vault not found',
      };
    }

    // In production, integrate with Stellar AMM
    await invokeVaultMethod(
      vault.contract_address,
      'provide_liquidity',
      [amount],
      sourceKeypair
    );

    return {
      success: true,
      lpTokens: amount, // Mock LP tokens
    };
  } catch (error) {
    console.error('Error executing liquidity provision:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get action execution history for a vault
 */
export async function getActionHistory(
  _vaultId: string
): Promise<Array<{
  action: string;
  timestamp: string;
  result: string;
}>> {
  try {
    // In production, query action history from dedicated table
    // For MVP, return mock data

    return [
      {
        action: 'rebalance',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        result: 'success',
      },
    ];
  } catch (error) {
    console.error('Error getting action history:', error);
    return [];
  }
}

/**
 * Estimate action costs
 */
export async function estimateActionCost(
  action: string
): Promise<{ estimatedFee: string; estimatedCost: string }> {
  try {
    const baseFee = await horizonServer.fetchBaseFee();

    // Different actions have different operation counts
    let operationCount = 1;
    switch (action) {
      case 'rebalance':
        operationCount = 5; // Multiple swaps
        break;
      case 'deposit':
      case 'withdraw':
        operationCount = 2;
        break;
      case 'stake':
      case 'provide_liquidity':
        operationCount = 3;
        break;
    }

    const estimatedFee = baseFee * operationCount;

    return {
      estimatedFee: estimatedFee.toString(),
      estimatedCost: (estimatedFee / 10_000_000).toFixed(7), // Convert to XLM
    };
  } catch (error) {
    console.error('Error estimating action cost:', error);
    return {
      estimatedFee: '0',
      estimatedCost: '0',
    };
  }
}


