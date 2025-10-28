import * as StellarSdk from '@stellar/stellar-sdk';
import dotenv from 'dotenv';

dotenv.config();

const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const sorobanRpcUrl = process.env.STELLAR_RPC_URL || process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

// Create Horizon server instance
export const horizonServer = new StellarSdk.Horizon.Server(horizonUrl);

// Create Soroban RPC server instance for contract interactions
export const sorobanServer = new StellarSdk.rpc.Server(sorobanRpcUrl);

/**
 * Get network-specific servers based on user's connected network
 * This allows deposits/withdrawals to work on the user's connected network
 */
export function getNetworkServers(network?: string) {
  const userNetwork = network || process.env.STELLAR_NETWORK || 'testnet';
  
  let horizonUrl: string;
  let sorobanUrl: string;
  let networkPassphrase: string;
  
  switch (userNetwork.toLowerCase()) {
    case 'futurenet':
      horizonUrl = 'https://horizon-futurenet.stellar.org';
      sorobanUrl = 'https://rpc-futurenet.stellar.org';
      networkPassphrase = 'Test SDF Future Network ; October 2022';
      break;
    case 'testnet':
      horizonUrl = 'https://horizon-testnet.stellar.org';
      sorobanUrl = 'https://soroban-testnet.stellar.org';
      networkPassphrase = 'Test SDF Network ; September 2015';
      break;
    case 'mainnet':
    case 'public':
      horizonUrl = 'https://horizon.stellar.org';
      sorobanUrl = 'https://soroban-rpc.stellar.org';
      networkPassphrase = 'Public Global Stellar Network ; September 2015';
      break;
    default:
      horizonUrl = 'https://horizon-testnet.stellar.org';
      sorobanUrl = 'https://soroban-testnet.stellar.org';
      networkPassphrase = 'Test SDF Network ; September 2015';
  }
  
  return {
    horizonServer: new StellarSdk.Horizon.Server(horizonUrl),
    sorobanServer: new StellarSdk.rpc.Server(sorobanUrl),
    network: userNetwork,
    networkPassphrase,
  };
}

// Helper to get account details
export async function getAccount(accountId: string) {
  try {
    return await horizonServer.loadAccount(accountId);
  } catch (error) {
    console.error(`Error loading account ${accountId}:`, error);
    throw error;
  }
}

// Helper to get account balances
export async function getAccountBalances(accountId: string) {
  try {
    const account = await getAccount(accountId);
    return account.balances;
  } catch (error) {
    console.error(`Error getting balances for ${accountId}:`, error);
    throw error;
  }
}

// Helper to get transaction history
export async function getTransactionHistory(
  accountId: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const transactions = await horizonServer
      .transactions()
      .forAccount(accountId)
      .limit(limit)
      .order('desc')
      .call();
    return transactions.records;
  } catch (error) {
    console.error(`Error getting transaction history for ${accountId}:`, error);
    throw error;
  }
}

// Helper to stream account payments
export function streamPayments(
  accountId: string,
  onPayment: (payment: any) => void
) {
  return horizonServer
    .payments()
    .forAccount(accountId)
    .cursor('now')
    .stream({
      onmessage: onPayment,
      onerror: (error: any) => console.error('Payment stream error:', error),
    });
}

export default horizonServer;


