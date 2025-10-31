// Asset service for fetching and validating tokens across networks
import type { Network } from '../types/network';

export interface TokenInfo {
  symbol: string;
  name: string;
  address?: string;
  issuer?: string;
  decimals: number;
  type: 'native' | 'stablecoin' | 'token' | 'custom';
  network: string;
  icon?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  token?: TokenInfo;
  error?: string;
}

/**
 * Fetch popular/known tokens for a given network
 */
export async function fetchPopularTokens(network: Network = 'testnet'): Promise<TokenInfo[]> {
  try {
    const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/tokens/popular?network=${network}`);
    const data = await response.json();

    if (data.success) {
      return data.tokens;
    }

    throw new Error(data.error || 'Failed to fetch popular tokens');
  } catch (error) {
    console.error('Error fetching popular tokens:', error);
    // Return fallback list
    return getFallbackTokens(network);
  }
}

/**
 * Validate a custom token contract address
 */
export async function validateTokenContract(
  address: string,
  network: Network = 'testnet'
): Promise<TokenValidationResult> {
  try {
    // Basic validation
    if (!address.startsWith('C') || address.length !== 56) {
      return {
        valid: false,
        error: 'Invalid contract address format. Must start with C and be 56 characters.',
      };
    }

    const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(
      `${backendUrl}/api/tokens/validate/${address}?network=${network}`
    );
    const data = await response.json();

    if (data.valid) {
      return {
        valid: true,
        token: {
          symbol: data.token.symbol,
          name: data.token.name,
          address: data.token.address,
          decimals: data.token.decimals,
          type: 'custom',
          network: data.token.network,
        },
      };
    }

    return {
      valid: false,
      error: data.error || 'Token validation failed',
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Token validation failed',
    };
  }
}

/**
 * Search tokens by symbol or name
 */
export async function searchTokens(
  query: string,
  network: Network = 'testnet'
): Promise<TokenInfo[]> {
  try {
    // First try server-side search (will query Horizon API by asset_code)
    const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/tokens/popular?network=${network}&search=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (data.success && data.tokens && data.tokens.length > 0) {
      return data.tokens;
    }
  } catch (error) {
    console.warn('Server-side search failed, falling back to client-side filter:', error);
  }
  
  // Fallback to client-side filtering of cached popular tokens
  const popularTokens = await fetchPopularTokens(network);
  const queryLower = query.toLowerCase();
  return popularTokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(queryLower) ||
      token.name.toLowerCase().includes(queryLower)
  );
}

/**
 * Get token info by symbol
 */
export async function getTokenBySymbol(
  symbol: string,
  network: Network = 'testnet'
): Promise<TokenInfo | null> {
  const popularTokens = await fetchPopularTokens(network);
  return popularTokens.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase()) || null;
}

/**
 * Fallback token list if backend is unavailable
 */
function getFallbackTokens(network: Network): TokenInfo[] {
  const tokens: Record<Network, TokenInfo[]> = {
    testnet: [
      {
        symbol: 'XLM',
        name: 'Stellar Lumens',
        address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        decimals: 7,
        type: 'native',
        network: 'testnet',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
        decimals: 6,
        type: 'stablecoin',
        network: 'testnet',
      },
    ],
    futurenet: [
      {
        symbol: 'XLM',
        name: 'Stellar Lumens',
        address: 'CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT',
        decimals: 7,
        type: 'native',
        network: 'futurenet',
      },
    ],
    mainnet: [
      {
        symbol: 'XLM',
        name: 'Stellar Lumens',
        address: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
        decimals: 7,
        type: 'native',
        network: 'mainnet',
      },
    ],
  };

  return tokens[network] || tokens.testnet;
}
