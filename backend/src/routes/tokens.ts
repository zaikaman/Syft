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
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const { network } = req.query;
    const userNetwork = (network as string) || 'testnet';
    
    // Define popular tokens per network
    const popularTokens: { [key: string]: any[] } = {
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
          name: 'USD Coin',
          address: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
          decimals: 6,
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
        {
          symbol: 'USDC',
          name: 'USD Coin (Custom)',
          address: process.env.FUTURENET_USDC_ADDRESS || 'Not deployed',
          decimals: 6,
          type: 'stablecoin',
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
    
    const tokens = popularTokens[userNetwork.toLowerCase()] || popularTokens.testnet;
    
    return res.json({
      success: true,
      network: userNetwork,
      tokens,
      note: 'For custom tokens, use the contract address directly when creating a vault',
    });
  } catch (error) {
    console.error('Error in GET /api/tokens/popular:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;


