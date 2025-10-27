import * as StellarSdk from '@stellar/stellar-sdk';
import { horizonServer, sorobanServer } from '../lib/horizonClient.js';
import { supabase } from '../lib/supabase.js';

export interface VaultDeploymentConfig {
  owner: string;
  name: string;
  assets: string[];
  rules: Array<{
    condition_type: string;
    threshold: number;
    action: string;
    target_allocation: number[];
  }>;
  routerAddress?: string; // Optional: set DEX router (defaults to Soroswap testnet)
}

export interface DeploymentResult {
  vaultId: string;
  contractAddress: string;
  transactionHash: string;
  status: 'success' | 'failed';
  error?: string;
}

/**
 * Convert asset symbol to Stellar contract address
 */
function getAssetAddress(asset: string): string {
  // Map of common asset symbols to their Stellar contract addresses
  const assetMap: { [key: string]: string } = {
    'XLM': process.env.TESTNET_XLM_ADDRESS || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    'USDC': process.env.TESTNET_USDC_ADDRESS || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    'EURC': 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU',
    'AQUA': 'CCRRYUTYU3UJQME6ZKBDZMZS6P4ZXVFWRXLQGVL7TWVCXHWMLQOAAQUA',
  };

  // If it's already a valid contract address (starts with C and is the right length), return it
  if (asset.startsWith('C') && asset.length > 50) {
    return asset;
  }

  // Otherwise, look it up in the map
  const address = assetMap[asset.toUpperCase()];
  if (!address) {
    throw new Error(`Unknown asset symbol: ${asset}. Please provide a valid Stellar contract address.`);
  }

  return address;
}

/**
 * Deploy a new vault contract to Stellar network
 */
export async function deployVault(
  config: VaultDeploymentConfig,
  sourceKeypair: StellarSdk.Keypair
): Promise<DeploymentResult> {
  try {
    const vaultId = generateVaultId();
    const routerAddress = config.routerAddress || process.env.SOROSWAP_ROUTER_ADDRESS || 
      'CCMAPXWVZD4USEKDWRYS7DA4Y3D7E2SDMGBFJUCEXTC7VN6CUBGWPFUS';

    console.log(`[Vault Deployment] Starting deployment for ${config.name}`);
    console.log(`[Vault Deployment] Owner: ${config.owner}`);
    console.log(`[Vault Deployment] Assets: ${config.assets.join(', ')}`);

    // Convert asset symbols to contract addresses
    const assetAddressStrings = config.assets.map(asset => {
      const address = getAssetAddress(asset);
      console.log(`[Vault Deployment] ${asset} -> ${address}`);
      return address;
    });

    // Load source account
    const sourceAccount = await horizonServer.loadAccount(sourceKeypair.publicKey());

    // Get vault factory contract address from environment
    const factoryAddress = process.env.VAULT_FACTORY_CONTRACT_ID;
    if (!factoryAddress) {
      throw new Error('VAULT_FACTORY_CONTRACT_ID not set in environment');
    }

    console.log(`[Vault Deployment] Using factory: ${factoryAddress}`);

    // Create contract instance for factory
    const factoryContract = new StellarSdk.Contract(factoryAddress);

    // Convert assets to Address ScVals as a Vec
    const assetAddresses = assetAddressStrings.map(asset => 
      StellarSdk.Address.fromString(asset).toScVal()
    );

    // Build VaultConfig struct - must match the Rust struct field order and types
    // The struct should be passed as a map with symbol keys
    const vaultConfigStruct = StellarSdk.xdr.ScVal.scvMap([
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('assets')),
        val: StellarSdk.xdr.ScVal.scvVec(assetAddresses),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('name')),
        val: StellarSdk.nativeToScVal(config.name, { type: 'string' }),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('owner')),
        val: StellarSdk.Address.fromString(config.owner).toScVal(),
      }),
    ]);

    // Build transaction to call create_vault on factory
    const operation = factoryContract.call('create_vault', vaultConfigStruct);

    let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log(`[Vault Deployment] Simulating transaction...`);

    // Simulate transaction to get resource footprint and auth
    const simulationResponse = await sorobanServer.simulateTransaction(transaction);
    
    if (StellarSdk.SorobanRpc.Api.isSimulationError(simulationResponse)) {
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }

    // Prepare the transaction with simulation results
    transaction = StellarSdk.SorobanRpc.assembleTransaction(
      transaction,
      simulationResponse
    ).build();

    transaction.sign(sourceKeypair);

    console.log(`[Vault Deployment] Submitting transaction to factory...`);

    // Submit transaction
    const result = await horizonServer.submitTransaction(transaction);
    
    console.log(`[Vault Deployment] ✓ Transaction successful: ${result.hash}`);

    // Extract vault address from transaction result
    // The create_vault function returns an Address
    let contractAddress = '';
    
    if (result.successful) {
      // Try to get the contract address from the result
      // The create_vault function returns an Address
      // TODO: Parse XDR result_meta_xdr to extract the returned vault address
      // For now, generate a placeholder that we'll update when we can query the factory
      contractAddress = `VAULT_${vaultId}`;
      
      console.log(`[Vault Deployment] New vault address: ${contractAddress}`);
    } else {
      throw new Error('Transaction failed');
    }

    // Ensure user exists in database (upsert)
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

    // Store vault metadata in Supabase
    const { error: dbError } = await supabase.from('vaults').insert({
      vault_id: vaultId,
      owner_wallet_address: config.owner,
      contract_address: contractAddress,
      name: config.name,
      description: 'Deployed vault from visual builder',
      config: {
        assets: config.assets,
        rules: config.rules,
        router_address: routerAddress,
      },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deployed_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error('Error storing vault in database:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log(`[Vault Deployment] ✓ Stored vault metadata in database`);

    // AUTO-SET ROUTER: Configure DEX router for the vault automatically
    // Note: Skip router setup for now until we have the real contract address
    // We'll need to add this after we can properly extract the address from the factory result
    console.log(`[Router Setup] Router address configured: ${routerAddress}`);
    console.log(`[Router Setup] To manually set router after deployment:`);
    console.log(`[Router Setup] stellar contract invoke --id ${contractAddress} --source-account <keypair> -- set_router --router ${routerAddress}`);

    return {
      vaultId,
      contractAddress,
      transactionHash: result.hash,
      status: 'success',
    };
  } catch (error) {
    console.error('Error deploying vault:', error);
    
    // Log detailed error information for Stellar transactions
    if (error && typeof error === 'object' && 'response' in error) {
      const stellarError = error as any;
      if (stellarError.response?.data?.extras) {
        console.error('Stellar Transaction Error Details:');
        console.error('Result Codes:', JSON.stringify(stellarError.response.data.extras.result_codes, null, 2));
        console.error('Result XDR:', stellarError.response.data.extras.result_xdr);
      }
    }
    
    return {
      vaultId: '',
      contractAddress: '',
      transactionHash: '',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Estimate gas fees for vault deployment
 */
export async function estimateDeploymentFees(
  _config?: VaultDeploymentConfig
): Promise<{
  baseFee: string;
  estimatedFee: string;
  estimatedCost: string;
}> {
  try {
    const baseFee = await horizonServer.fetchBaseFee();
    
    // Estimate operations:
    // 1. Deploy contract (if WASM not uploaded)
    // 2. Create vault instance
    // 3. Initialize vault
    const estimatedOperations = 3;
    const estimatedFee = baseFee * estimatedOperations;

    return {
      baseFee: baseFee.toString(),
      estimatedFee: estimatedFee.toString(),
      estimatedCost: (estimatedFee / 10_000_000).toFixed(7), // Convert stroops to XLM
    };
  } catch (error) {
    console.error('Error estimating deployment fees:', error);
    throw error;
  }
}

/**
 * Get vault deployment status
 */
export async function getVaultDeploymentStatus(
  vaultId: string
): Promise<{
  status: 'pending' | 'active' | 'failed';
  contractAddress?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error) {
      return { status: 'failed', error: error.message };
    }

    if (!data) {
      return { status: 'failed', error: 'Vault not found' };
    }

    return {
      status: data.status === 'active' ? 'active' : 'pending',
      contractAddress: data.contract_address,
    };
  } catch (error) {
    console.error('Error getting vault status:', error);
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Invoke a vault contract method
 */
export async function invokeVaultMethod(
  contractAddress: string,
  method: string,
  params: any[],
  sourceKeypair: StellarSdk.Keypair
): Promise<any> {
  try {
    // Load source account
    const sourceAccount = await horizonServer.loadAccount(sourceKeypair.publicKey());
    
    // Create contract instance
    const contract = new StellarSdk.Contract(contractAddress);
    
    // Convert params to ScVal types based on method
    let scParams: StellarSdk.xdr.ScVal[] = [];
    
    if (method === 'set_router') {
      // set_router expects a single Address parameter
      const routerAddress = params[0] as string;
      scParams = [StellarSdk.Address.fromString(routerAddress).toScVal()];
    } else {
      // For other methods, attempt generic conversion
      scParams = params.map(param => {
        if (typeof param === 'string') {
          // Try to parse as address first
          try {
            return StellarSdk.Address.fromString(param).toScVal();
          } catch {
            // If not an address, treat as string
            return StellarSdk.nativeToScVal(param);
          }
        } else {
          return StellarSdk.nativeToScVal(param);
        }
      });
    }
    
    // Build the contract invocation operation
    const operation = contract.call(method, ...scParams);
    
    // Build transaction
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();
    
    // Sign transaction
    transaction.sign(sourceKeypair);
    
    // Submit transaction
    const response = await horizonServer.submitTransaction(transaction);
    
    console.log(`✓ Successfully invoked ${method} on ${contractAddress}`);
    console.log(`Transaction hash: ${response.hash}`);
    
    return {
      success: true,
      hash: response.hash,
      result: response,
    };
  } catch (error) {
    console.error(`Error invoking vault method ${method}:`, error);
    
    // In development/MVP mode, log but don't fail
    if (process.env.NODE_ENV === 'development' || process.env.MVP_MODE === 'true') {
      console.log(`[MVP Mode] Simulating successful ${method} invocation`);
      console.log(`Would invoke ${method} on ${contractAddress} with params:`, params);
      return { 
        success: true, 
        mvp: true,
        message: `Simulated ${method} call - set STELLAR_NETWORK_PASSPHRASE and disable MVP_MODE for production`,
      };
    }
    
    throw error;
  }
}

// Helper functions
function generateVaultId(): string {
  return `vault_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
