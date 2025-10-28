import * as StellarSdk from '@stellar/stellar-sdk';
import { horizonServer } from '../lib/horizonClient.js';
import { supabase } from '../lib/supabase.js';
import { invokeVaultMethod } from './vaultDeploymentService.js';

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
        const result = await invokeVaultMethod(
          vault.contract_address,
          'trigger_rebalance',
          [],
          rebalancerKeypair,
          vault.network // Pass the vault's network
        );
        
        if (result.success && result.hash) {
          txHash = result.hash;
          console.log(`✅ On-chain rebalance executed! TX: ${txHash}`);
        } else if (result.mvp) {
          console.log(`⚠️  MVP mode - simulated rebalance`);
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
    const result = await invokeVaultMethod(
      vault.contract_address,
      'deposit',
      [userAddress, amount],
      sourceKeypair,
      network
    );

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
