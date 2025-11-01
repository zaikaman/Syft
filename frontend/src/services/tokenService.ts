// Token information service
// Fetches token metadata from backend API

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  type?: string;
}

// Cache for token info to avoid repeated API calls
const tokenCache = new Map<string, TokenInfo>();

/**
 * Fetch token information from backend
 */
export async function getTokenInfo(address: string, network: string = 'testnet'): Promise<TokenInfo | null> {
  const cacheKey = `${network}:${address}`;
  
  // Check cache first
  if (tokenCache.has(cacheKey)) {
    return tokenCache.get(cacheKey)!;
  }

  try {
    const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/tokens/validate/${address}?network=${network}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.valid && data.token) {
      const tokenInfo: TokenInfo = {
        symbol: data.token.symbol,
        name: data.token.name,
        address: data.token.address,
        decimals: data.token.decimals,
      };
      
      // Cache the result
      tokenCache.set(cacheKey, tokenInfo);
      return tokenInfo;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching token info:', error);
    return null;
  }
}

/**
 * Get token display name (symbol or truncated address)
 */
export function getTokenDisplayName(asset: any): string {
  // Handle string format
  if (typeof asset === 'string') {
    // If it's a known short name, return it
    if (asset.length <= 10 && !asset.startsWith('C')) {
      return asset;
    }
    // If it's a long address, it will be resolved later
    return asset;
  }
  
  // Handle object format
  if (asset.code || asset.assetCode) {
    return asset.code || asset.assetCode;
  }
  
  return asset.address || 'Unknown';
}

/**
 * Resolve asset display names (with caching)
 * Returns a promise that resolves to the display name
 */
export async function resolveAssetName(asset: any, network: string = 'testnet'): Promise<string> {
  const displayName = getTokenDisplayName(asset);
  
  // If it's already a short name, return it
  if (displayName.length <= 10 && !displayName.startsWith('C')) {
    return displayName;
  }
  
  // If it's a contract address, try to fetch metadata
  if (displayName.startsWith('C') && displayName.length === 56) {
    const tokenInfo = await getTokenInfo(displayName, network);
    if (tokenInfo?.symbol) {
      return tokenInfo.symbol;
    }
    // If we can't get the symbol, return truncated address
    return `${displayName.slice(0, 8)}...`;
  }
  
  return displayName;
}

/**
 * Batch resolve multiple assets
 */
export async function resolveAssetNames(assets: any[], network: string = 'testnet'): Promise<string[]> {
  const promises = assets.map(asset => resolveAssetName(asset, network));
  return Promise.all(promises);
}
