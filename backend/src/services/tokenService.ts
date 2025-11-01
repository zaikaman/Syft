/**
 * Token Service - Fetch token metadata from Soroban contracts
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { getNetworkServers } from '../lib/horizonClient.js';

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

// Cache for token info to avoid repeated contract calls
const CACHE_TTL = 3600000; // 1 hour cache

interface CachedToken {
  info: TokenInfo;
  timestamp: number;
}

const cachedTokens = new Map<string, CachedToken>();

/**
 * Get token information from a Soroban contract
 * This is the same logic used by the /api/tokens/validate endpoint
 */
export async function getTokenInfo(
  contractAddress: string,
  network: string = 'mainnet'
): Promise<TokenInfo | null> {
  try {
    const cacheKey = `${network}:${contractAddress}`;
    
    // Check cache first
    const cached = cachedTokens.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[TokenService] Using cached info for ${contractAddress.slice(0, 12)}...`);
      return cached.info;
    }

    console.log(`[TokenService] Fetching token info for ${contractAddress.slice(0, 12)}...`);

    // Validate address format
    if (!contractAddress.startsWith('C') || contractAddress.length !== 56) {
      console.error('[TokenService] Invalid contract address format');
      return null;
    }

    const servers = getNetworkServers(network);
    const contract = new StellarSdk.Contract(contractAddress);
    const dummyKeypair = StellarSdk.Keypair.random();
    const account = new StellarSdk.Account(dummyKeypair.publicKey(), '0');

    // Build transactions to get token metadata
    const nameOp = contract.call('name');
    const symbolOp = contract.call('symbol');
    const decimalsOp = contract.call('decimals');

    const nameTx = new StellarSdk.TransactionBuilder(account, {
      fee: '1000',
      networkPassphrase: servers.networkPassphrase,
    })
      .addOperation(nameOp)
      .setTimeout(30)
      .build();

    const symbolTx = new StellarSdk.TransactionBuilder(account, {
      fee: '1000',
      networkPassphrase: servers.networkPassphrase,
    })
      .addOperation(symbolOp)
      .setTimeout(30)
      .build();

    const decimalsTx = new StellarSdk.TransactionBuilder(account, {
      fee: '1000',
      networkPassphrase: servers.networkPassphrase,
    })
      .addOperation(decimalsOp)
      .setTimeout(30)
      .build();

    // Add timeout wrapper
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.warn(`[TokenService] Token info fetch timeout for ${contractAddress.slice(0, 12)}...`);
        resolve(null);
      }, 5000); // 5 second timeout
    });

    const fetchPromise = (async () => {
      // Simulate all transactions
      const [nameResult, symbolResult, decimalsResult] = await Promise.all([
        servers.sorobanServer.simulateTransaction(nameTx),
        servers.sorobanServer.simulateTransaction(symbolTx),
        servers.sorobanServer.simulateTransaction(decimalsTx),
      ]);

      // Check if all simulations succeeded
      const nameSuccess = StellarSdk.rpc.Api.isSimulationSuccess(nameResult);
      const symbolSuccess = StellarSdk.rpc.Api.isSimulationSuccess(symbolResult);
      const decimalsSuccess = StellarSdk.rpc.Api.isSimulationSuccess(decimalsResult);

      if (!nameSuccess || !symbolSuccess || !decimalsSuccess) {
        console.warn(`[TokenService] Token contract does not implement SEP-41 standard`);
        return null;
      }

      // Decode the results
      let name = 'Unknown';
      let symbol = 'UNKNOWN';
      let decimals = 7;

      if (nameSuccess && nameResult.result) {
        name = StellarSdk.scValToNative(nameResult.result.retval);
      }
      if (symbolSuccess && symbolResult.result) {
        symbol = StellarSdk.scValToNative(symbolResult.result.retval);
      }
      if (decimalsSuccess && decimalsResult.result) {
        decimals = StellarSdk.scValToNative(decimalsResult.result.retval);
      }

      const tokenInfo: TokenInfo = {
        address: contractAddress,
        symbol,
        name,
        decimals,
      };

      // Cache the result
      cachedTokens.set(cacheKey, {
        info: tokenInfo,
        timestamp: Date.now(),
      });

      console.log(`[TokenService] ✓ Resolved ${contractAddress.slice(0, 12)}... to: ${symbol} (${name})`);

      return tokenInfo;
    })();

    // Race between fetch and timeout
    const result = await Promise.race([fetchPromise, timeoutPromise]);

    return result;
  } catch (error) {
    console.error(
      `[TokenService] Error fetching token info:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Get just the token symbol (lighter than full info)
 */
export async function getTokenSymbol(
  contractAddress: string,
  network: string = 'mainnet'
): Promise<string | null> {
  const info = await getTokenInfo(contractAddress, network);
  return info?.symbol || null;
}

/**
 * Clear token cache
 */
export function clearTokenCache(): void {
  cachedTokens.clear();
  console.log('[TokenService] Token cache cleared');
}
