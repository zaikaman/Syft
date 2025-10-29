import { supabase } from '../lib/supabase.js';
import { getXLMPrice, stroopsToUSD } from './priceService.js';

/**
 * Record a vault transaction (deposit or withdrawal) in the database
 * This enables accurate earnings calculation for analytics
 */
export async function recordVaultTransaction(params: {
  vaultId: string;
  userAddress: string;
  type: 'deposit' | 'withdrawal';
  amountStroops: string | number;
  shares: string | number;
  transactionHash?: string;
  network?: string;
}): Promise<void> {
  try {
    const { vaultId, userAddress, type, amountStroops, shares, transactionHash, network } = params;

    // Get vault UUID from vault_id
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (vaultError || !vault) {
      console.error(`[recordVaultTransaction] Vault not found: ${vaultId}`);
      throw new Error('Vault not found');
    }

    // Convert amounts
    const amountInStroops = typeof amountStroops === 'string' 
      ? parseFloat(amountStroops) 
      : amountStroops;
    const amountInXLM = amountInStroops / 10_000_000;
    const sharesNum = typeof shares === 'string' ? parseFloat(shares) : shares;

    // Get current XLM price and calculate USD value
    const xlmPrice = await getXLMPrice();
    const amountUSD = await stroopsToUSD(amountInStroops);

    // Calculate share price (USD per share)
    const sharePrice = sharesNum > 0 ? amountUSD / sharesNum : 0;

    // Insert transaction record
    const { error: insertError } = await supabase
      .from('vault_transactions')
      .insert({
        vault_id: vault.id,
        user_address: userAddress,
        type,
        amount_xlm: amountInXLM,
        amount_usd: amountUSD,
        shares: sharesNum,
        xlm_price: xlmPrice,
        share_price: sharePrice,
        transaction_hash: transactionHash || null,
        timestamp: new Date().toISOString(),
        metadata: { 
          network: network || 'testnet',
          recorded_at: new Date().toISOString()
        },
      });

    if (insertError) {
      console.error(`[recordVaultTransaction] Failed to insert transaction:`, insertError);
      throw insertError;
    }

    console.log(
      `✅ Recorded ${type} transaction: ${amountInXLM.toFixed(7)} XLM = $${amountUSD.toFixed(2)} → ${sharesNum} shares`
    );
  } catch (error) {
    console.error('[recordVaultTransaction] Error recording transaction:', error);
    // Don't throw - transaction recording should not fail the main operation
    // The calling code can decide how to handle this
  }
}

/**
 * Get all transactions for a vault
 */
export async function getVaultTransactions(vaultId: string): Promise<any[]> {
  try {
    // Get vault UUID
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (vaultError || !vault) {
      console.error(`[getVaultTransactions] Vault not found: ${vaultId}`);
      return [];
    }

    // Get all transactions
    const { data: transactions, error } = await supabase
      .from('vault_transactions')
      .select('*')
      .eq('vault_id', vault.id)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('[getVaultTransactions] Error fetching transactions:', error);
      return [];
    }

    return transactions || [];
  } catch (error) {
    console.error('[getVaultTransactions] Error:', error);
    return [];
  }
}

/**
 * Get transactions for a specific user in a vault
 */
export async function getUserVaultTransactions(
  vaultId: string,
  userAddress: string
): Promise<any[]> {
  try {
    // Get vault UUID
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (vaultError || !vault) {
      console.error(`[getUserVaultTransactions] Vault not found: ${vaultId}`);
      return [];
    }

    // Get user's transactions
    const { data: transactions, error } = await supabase
      .from('vault_transactions')
      .select('*')
      .eq('vault_id', vault.id)
      .eq('user_address', userAddress)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('[getUserVaultTransactions] Error fetching transactions:', error);
      return [];
    }

    return transactions || [];
  } catch (error) {
    console.error('[getUserVaultTransactions] Error:', error);
    return [];
  }
}
