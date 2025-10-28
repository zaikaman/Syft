import * as StellarSdk from '@stellar/stellar-sdk';
import { horizonServer, getNetworkServers } from '../lib/horizonClient.js';
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
function getAssetAddress(asset: string, network?: string): string {
  const normalizedNetwork = (network || 'testnet').toLowerCase();
  
  // Network-specific Native XLM SAC addresses
  const nativeXLMAddresses: { [key: string]: string } = {
    'testnet': 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    'futurenet': 'CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT',
    'mainnet': 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA', // Mainnet Native XLM
    'public': 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
  };
  
  // Map of common asset symbols to their Stellar contract addresses
  const assetMap: { [key: string]: string } = {
    'XLM': nativeXLMAddresses[normalizedNetwork] || nativeXLMAddresses['testnet'],
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
  sourceKeypair: StellarSdk.Keypair,
  network?: string
): Promise<DeploymentResult> {
  try {
    const vaultId = generateVaultId();
    const routerAddress = config.routerAddress || process.env.SOROSWAP_ROUTER_ADDRESS || 
      'CCMAPXWVZD4USEKDWRYS7DA4Y3D7E2SDMGBFJUCEXTC7VN6CUBGWPFUS';

    console.log(`[Vault Deployment] Starting deployment for ${config.name}`);
    console.log(`[Vault Deployment] Owner: ${config.owner}`);
    console.log(`[Vault Deployment] Assets: ${config.assets.join(', ')}`);

    // Convert asset symbols to contract addresses (network-aware)
    const assetAddressStrings = config.assets.map(asset => {
      const address = getAssetAddress(asset, network);
      console.log(`[Vault Deployment] ${asset} -> ${address}`);
      return address;
    });

    // Get network-specific servers
    const servers = getNetworkServers(network);
    
    // Load source account
    const sourceAccount = await servers.horizonServer.loadAccount(sourceKeypair.publicKey());

    // Get vault factory contract address based on network
    let factoryAddress: string;
    const normalizedNetwork = (network || 'testnet').toLowerCase();
    
    if (normalizedNetwork === 'futurenet') {
      factoryAddress = process.env.VAULT_FACTORY_CONTRACT_ID_FUTURENET || '';
    } else if (normalizedNetwork === 'mainnet' || normalizedNetwork === 'public') {
      factoryAddress = process.env.VAULT_FACTORY_CONTRACT_ID_MAINNET || '';
    } else {
      factoryAddress = process.env.VAULT_FACTORY_CONTRACT_ID || '';
    }
    
    if (!factoryAddress) {
      throw new Error(`VAULT_FACTORY_CONTRACT_ID not set for network: ${normalizedNetwork}. Please deploy the factory contract to ${normalizedNetwork} first.`);
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
      networkPassphrase: servers.network === 'futurenet' 
        ? StellarSdk.Networks.FUTURENET
        : servers.network === 'mainnet' || servers.network === 'public'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log(`[Vault Deployment] Simulating transaction...`);

    // Simulate transaction to get resource footprint and auth
    const simulationResponse = await servers.sorobanServer.simulateTransaction(transaction);
    
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
    const result = await servers.horizonServer.submitTransaction(transaction);
    
    console.log(`[Vault Deployment] ✓ Transaction successful: ${result.hash}`);

    // Extract vault address from simulation result
    // The simulation returns the address that would be returned by create_vault
    let contractAddress = '';
    
    if (result.successful && simulationResponse.result) {
      try {
        console.log(`[Vault Deployment] 🔍 Extracting contract address from simulation result...`);
        
        // Check if simulation has a return value
        if ('retval' in simulationResponse.result) {
          const returnVal = simulationResponse.result.retval;
          console.log(`[Vault Deployment] Found return value in simulation`);
          
          // Parse the Address from the ScVal
          const addressScVal = StellarSdk.Address.fromScVal(returnVal);
          contractAddress = addressScVal.toString();
          console.log(`[Vault Deployment] ✅ Extracted vault contract address: ${contractAddress}`);
        } else {
          console.log(`[Vault Deployment] No return value in simulation result`);
          console.log(`[Vault Deployment] Simulation result keys:`, Object.keys(simulationResponse.result));
        }
      } catch (extractError) {
        console.error(`[Vault Deployment] Error extracting from simulation:`, extractError);
      }
    }
    
    // If we couldn't get it from simulation, the contract address would need to be
    // queried from the factory contract or extracted from events
    if (!contractAddress) {
      console.warn(`[Vault Deployment] ⚠️  Could not extract contract address from simulation`);
      console.warn(`[Vault Deployment] The vault was deployed successfully (TX: ${result.hash})`);
      console.warn(`[Vault Deployment] But we need to query the factory contract to get the address`);
      
      // For now, we'll use an error placeholder to indicate manual intervention needed
      contractAddress = `ERROR_${vaultId}_${result.hash.substring(0, 8)}`;
    }
    
    console.log(`[Vault Deployment] New vault address: ${contractAddress}`);

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

    // Validate contract address before storing
    if (!contractAddress || contractAddress.startsWith('VAULT_') || contractAddress.startsWith('PENDING_') || contractAddress.startsWith('ERROR_')) {
      console.error(`[Vault Deployment] ❌ Invalid contract address: ${contractAddress}`);
      throw new Error(`Failed to extract valid contract address. Got: ${contractAddress}`);
    }

    // Verify it's a valid Stellar contract address (C... format, 56 characters)
    if (!contractAddress.startsWith('C') || contractAddress.length !== 56) {
      console.error(`[Vault Deployment] ❌ Contract address validation failed: ${contractAddress}`);
      console.error(`[Vault Deployment] Expected: C followed by 55 characters (total 56)`);
      throw new Error(`Invalid contract address format: ${contractAddress}`);
    }

    console.log(`[Vault Deployment] ✅ Contract address validated: ${contractAddress}`);

    // STEP 2: Initialize the vault contract
    console.log(`[Vault Initialization] Initializing vault contract...`);
    
    try {
      // Build VaultConfig struct for initialization
      // IMPORTANT: ScMap entries MUST be sorted alphabetically by key!
      const vaultConfigStruct = StellarSdk.xdr.ScVal.scvMap([
        new StellarSdk.xdr.ScMapEntry({
          key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('assets')), // 'a' comes first
          val: StellarSdk.xdr.ScVal.scvVec(assetAddresses),
        }),
        new StellarSdk.xdr.ScMapEntry({
          key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('name')), // 'n' comes second
          val: StellarSdk.nativeToScVal(config.name, { type: 'string' }),
        }),
        new StellarSdk.xdr.ScMapEntry({
          key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('owner')), // 'o' comes third
          val: StellarSdk.Address.fromString(config.owner).toScVal(),
        }),
        new StellarSdk.xdr.ScMapEntry({
          key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('router_address')), // 'r' comes fourth
          val: StellarSdk.nativeToScVal(null, { type: 'option' }), // No router initially
        }),
        new StellarSdk.xdr.ScMapEntry({
          key: StellarSdk.xdr.ScVal.scvSymbol(Buffer.from('rules')), // 'r' comes last (rules)
          val: StellarSdk.xdr.ScVal.scvVec([]), // Empty rules for now
        }),
      ]);
      
      const initResult = await invokeVaultMethod(
        contractAddress,
        'initialize',
        [vaultConfigStruct],
        sourceKeypair,
        network // Pass network to initialization
      );
      
      if (initResult.success) {
        console.log(`[Vault Initialization] ✅ Vault initialized successfully`);
        console.log(`[Vault Initialization] TX: ${initResult.hash}`);
      }
    } catch (initError) {
      console.error(`[Vault Initialization] ⚠️  Failed to initialize vault:`, initError);
      console.warn(`[Vault Initialization] Vault deployed but not initialized - manual initialization required`);
    }

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
      network: network || 'testnet', // Store the network
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
 * Helper function to retry async operations with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry if it's a 4xx error (client error)
      if (error.status && error.status >= 400 && error.status < 500 && error.status !== 504) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries - 1) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Invoke a vault contract method
 */
export async function invokeVaultMethod(
  contractAddress: string,
  method: string,
  params: any[],
  sourceKeypair: StellarSdk.Keypair,
  network?: string
): Promise<any> {
  try {
    console.log(`[Contract Invocation] Invoking ${method} on ${contractAddress}`);
    
    // Get network-specific servers
    const servers = getNetworkServers(network);
    console.log(`[Contract Invocation] Using network: ${servers.network}`);
    
    // Load source account
    const sourceAccount = await servers.horizonServer.loadAccount(sourceKeypair.publicKey());
    
    // Create contract instance
    const contract = new StellarSdk.Contract(contractAddress);
    
    // Convert params to ScVal types based on method
    let scParams: StellarSdk.xdr.ScVal[] = [];
    
    if (method === 'set_router') {
      // set_router expects a single Address parameter
      const routerAddress = params[0] as string;
      scParams = [StellarSdk.Address.fromString(routerAddress).toScVal()];
    } else if (method === 'trigger_rebalance') {
      // trigger_rebalance takes no parameters
      scParams = [];
    } else if (method === 'initialize') {
      // initialize expects a VaultConfig struct (already converted)
      scParams = params as StellarSdk.xdr.ScVal[];
    } else if (method === 'deposit' || method === 'withdraw') {
      // deposit expects (user: Address, amount: i128)
      // withdraw expects (user: Address, shares: i128)
      const userAddress = params[0] as string;
      const amount = params[1] as string;
      scParams = [
        StellarSdk.Address.fromString(userAddress).toScVal(),
        StellarSdk.nativeToScVal(BigInt(amount), { type: 'i128' })
      ];
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
    
    // Build initial transaction
    // Build initial transaction
    const networkPassphrase = servers.network === 'futurenet' 
      ? StellarSdk.Networks.FUTURENET 
      : servers.network === 'mainnet' || servers.network === 'public'
      ? StellarSdk.Networks.PUBLIC
      : StellarSdk.Networks.TESTNET;
      
    let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();
    
    console.log(`[Contract Invocation] Simulating transaction...`);
    
    // Simulate transaction to get resource footprint and auth
    const simulationResponse = await servers.sorobanServer.simulateTransaction(transaction);
    
    if (StellarSdk.SorobanRpc.Api.isSimulationError(simulationResponse)) {
      console.error(`[Contract Invocation] Simulation failed:`, simulationResponse.error);
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }
    
    console.log(`[Contract Invocation] Simulation successful, preparing transaction...`);
    
    // Assemble the transaction with simulation results (adds footprint and auth)
    transaction = StellarSdk.SorobanRpc.assembleTransaction(
      transaction,
      simulationResponse
    ).build();
    
    // Sign transaction
    transaction.sign(sourceKeypair);
    
    console.log(`[Contract Invocation] Submitting transaction...`);
    
    // Submit transaction
    const response = await servers.horizonServer.submitTransaction(transaction);
    
    console.log(`✅ Successfully invoked ${method} on ${contractAddress}`);
    console.log(`📡 Transaction hash: ${response.hash}`);
    console.log(`🔗 View on explorer: https://stellar.expert/explorer/${servers.network}/tx/${response.hash}`);
    
    // Extract the actual contract return value from simulation
    let contractResult = null;
    if (simulationResponse.result && 'retval' in simulationResponse.result) {
      contractResult = simulationResponse.result.retval;
      console.log(`📦 Contract return value:`, contractResult);
    }
    
    return {
      success: true,
      hash: response.hash,
      result: contractResult,
      transactionResponse: response,
    };
  } catch (error) {
    console.error(`❌ Error invoking vault method ${method}:`, error);
    
    // Log detailed error information for Stellar transactions
    if (error && typeof error === 'object' && 'response' in error) {
      const stellarError = error as any;
      if (stellarError.response?.data) {
        console.error('📋 Stellar Transaction Error Details:');
        console.error('   Status:', stellarError.response.status);
        console.error('   Title:', stellarError.response.data.title);
        console.error('   Detail:', stellarError.response.data.detail);
        
        if (stellarError.response.data.extras) {
          console.error('   Result Codes:', JSON.stringify(stellarError.response.data.extras.result_codes, null, 2));
          
          if (stellarError.response.data.extras.result_xdr) {
            console.error('   Result XDR:', stellarError.response.data.extras.result_xdr);
          }
        }
      }
    }
    
    // In development/MVP mode, log but don't fail
    if (process.env.NODE_ENV === 'development' || process.env.MVP_MODE === 'true') {
      console.log(`⚠️  [MVP Mode] Simulating successful ${method} invocation`);
      console.log(`📝 Would invoke ${method} on ${contractAddress} with params:`, params);
      console.log(`💡 To enable real transactions:`);
      console.log(`   1. Set MVP_MODE=false in .env`);
      console.log(`   2. Ensure DEPLOYER_SECRET_KEY is set`);
      console.log(`   3. Deploy contracts to testnet/futurenet`);
      return { 
        success: true, 
        mvp: true,
        message: `Simulated ${method} call - MVP mode active`,
      };
    }
    
    throw error;
  }
}

// Helper functions
function generateVaultId(): string {
  return `vault_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
