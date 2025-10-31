import { Router, Request, Response } from 'express';
import * as StellarSdk from '@stellar/stellar-sdk';
import { getNetworkServers } from '../lib/horizonClient.js';

const router = Router();

/**
 * GET /api/tokens/validate/:address
 * Validate if a token contract exists and implements SEP-41 standard
 */
router.get('/validate/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { network } = req.query;

    // Validate address format
    if (!address.startsWith('C') || address.length !== 56) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contract address format. Must start with C and be 56 characters.',
      });
    }

    const userNetwork = (network as string) || 'testnet';
    const servers = getNetworkServers(userNetwork);

    // Try to get token metadata
    const contract = new StellarSdk.Contract(address);
    const dummyKeypair = StellarSdk.Keypair.random();
    
    try {
      // Create a temporary account for simulation
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
        return res.json({
          success: false,
          valid: false,
          error: 'Token contract does not implement SEP-41 standard (missing name, symbol, or decimals)',
          network: userNetwork,
          address,
        });
      }
      
      // Decode the results
      let name = 'Unknown';
      let symbol = 'UNKNOWN';
      let decimals = 0;
      
      try {
        if (nameSuccess && nameResult.result) {
          name = StellarSdk.scValToNative(nameResult.result.retval);
        }
        if (symbolSuccess && symbolResult.result) {
          symbol = StellarSdk.scValToNative(symbolResult.result.retval);
        }
        if (decimalsSuccess && decimalsResult.result) {
          decimals = StellarSdk.scValToNative(decimalsResult.result.retval);
        }
      } catch (decodeError) {
        console.warn('Error decoding token metadata:', decodeError);
      }
      
      return res.json({
        success: true,
        valid: true,
        token: {
          address,
          name,
          symbol,
          decimals,
          network: userNetwork,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('MissingValue') || errorMsg.includes('not found')) {
        return res.json({
          success: false,
          valid: false,
          error: `Token contract not found or not initialized on ${userNetwork}`,
          network: userNetwork,
          address,
        });
      }
      
      return res.status(500).json({
        success: false,
        error: `Failed to validate token: ${errorMsg}`,
        network: userNetwork,
        address,
      });
    }
  } catch (error) {
    console.error('Error in GET /api/tokens/validate/:address:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/tokens/popular
 * Get list of popular/known tokens for the specified network
 * Fetches from multiple sources: Soroswap curated list + Stellar Horizon API
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const { network, limit, search } = req.query;
    const userNetwork = (network as string) || 'testnet';
    const resultLimit = parseInt(limit as string) || 100; // Default to 100 tokens
    const searchQuery = (search as string)?.toUpperCase() || '';
    
    try {
      // Strategy: Fetch from both Soroswap (curated, high-quality) and Horizon (comprehensive)
      const tokens: any[] = [];
      
      // 1. First get curated tokens from Soroswap
      try {
        const soroswapUrl = 'https://api.soroswap.finance/api/tokens';
        const soroswapResponse = await fetch(soroswapUrl);
        
        if (soroswapResponse.ok) {
          const soroswapData = await soroswapResponse.json() as any;
          const networkData = soroswapData.find((n: any) => n.network === userNetwork.toLowerCase());
          
          if (networkData && networkData.assets) {
            networkData.assets.forEach((asset: any) => {
              let type = 'token';
              if (asset.code === 'XLM') {
                type = 'native';
              } else if (['USDC', 'EURC', 'ARST', 'BRL'].includes(asset.code)) {
                type = 'stablecoin';
              }
              
              tokens.push({
                symbol: asset.code,
                name: asset.name,
                address: asset.contract,
                issuer: asset.issuer,
                decimals: asset.decimals,
                type,
                icon: asset.icon || undefined,
                source: 'soroswap',
                verified: true, // Soroswap tokens are curated
              });
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch from Soroswap, continuing with Horizon...', err);
      }
      
      // 2. Then get comprehensive list from Stellar Horizon (Classic assets)
      try {
        const horizonUrls: { [key: string]: string } = {
          testnet: 'https://horizon-testnet.stellar.org',
          futurenet: 'https://horizon-futurenet.stellar.org',
          mainnet: 'https://horizon.stellar.org',
        };
        
        const horizonUrl = horizonUrls[userNetwork.toLowerCase()] || horizonUrls.testnet;
        
        // If searching, query by asset_code; otherwise get popular assets
        const horizonQueryUrl = searchQuery 
          ? `${horizonUrl}/assets?asset_code=${searchQuery}&limit=20`
          : `${horizonUrl}/assets?limit=${resultLimit}&order=desc`;
        
        const horizonResponse = await fetch(horizonQueryUrl);
        
        if (horizonResponse.ok) {
          const horizonData = await horizonResponse.json() as any;
          
          if (horizonData._embedded && horizonData._embedded.records) {
            horizonData._embedded.records.forEach((asset: any) => {
              // Skip if already in Soroswap list
              const existingToken = tokens.find(t => 
                t.symbol === asset.asset_code && t.issuer === asset.asset_issuer
              );
              
              if (!existingToken) {
                let type = 'token';
                if (['USDC', 'USDT', 'EURC', 'ARST', 'BRL', 'CETES'].includes(asset.asset_code)) {
                  type = 'stablecoin';
                }
                
                tokens.push({
                  symbol: asset.asset_code,
                  name: asset.asset_code, // Horizon doesn't provide full names
                  address: undefined, // Classic assets don't have contract addresses until wrapped
                  issuer: asset.asset_issuer,
                  decimals: 7, // Stellar classic assets use 7 decimals
                  type,
                  source: 'horizon',
                  verified: false,
                  accounts: asset.accounts?.authorized || 0, // Number of accounts holding this asset
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch from Horizon:', err);
      }
      
      // Sort: Verified (Soroswap) first, then by number of accounts
      tokens.sort((a, b) => {
        if (a.verified && !b.verified) return -1;
        if (!a.verified && b.verified) return 1;
        return (b.accounts || 0) - (a.accounts || 0);
      });
      
      return res.json({
        success: true,
        network: userNetwork,
        tokens: tokens.slice(0, resultLimit),
        total: tokens.length,
        sources: ['soroswap', 'horizon'],
        note: 'Token list includes both Soroban (Soroswap) and Stellar Classic assets (Horizon)',
      });
    } catch (fetchError) {
      // Fallback to hardcoded minimal list if API fails
      console.warn('Failed to fetch from Soroswap API, using fallback:', fetchError);
      
      const fallbackTokens: { [key: string]: any[] } = {
        testnet: [
          {
            symbol: 'XLM',
            name: 'Stellar Lumens',
            address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
            decimals: 7,
            type: 'native',
          },
          {
            symbol: 'USDC',
            name: 'USDCoin',
            address: 'CDWEFYYHMGEZEFC5TBUDXM3IJJ7K7W5BDGE765UIYQEV4JFWDOLSTOEK',
            decimals: 7,
            type: 'stablecoin',
          },
        ],
        futurenet: [
          {
            symbol: 'XLM',
            name: 'Stellar Lumens',
            address: 'CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT',
            decimals: 7,
            type: 'native',
          },
        ],
        mainnet: [
          {
            symbol: 'XLM',
            name: 'Stellar Lumens',
            address: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
            decimals: 7,
            type: 'native',
          },
        ],
      };
      
      const tokens = fallbackTokens[userNetwork.toLowerCase()] || fallbackTokens.testnet;
      
      return res.json({
        success: true,
        network: userNetwork,
        tokens,
        source: 'fallback',
        note: 'Using fallback token list. Soroswap API unavailable.',
      });
    }
  } catch (error) {
    console.error('Error in GET /api/tokens/popular:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;


