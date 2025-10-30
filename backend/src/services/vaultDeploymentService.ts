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
 * Validate if a token contract exists and is properly initialized on the network
 */
async function validateTokenContract(
  contractAddress: string,
  network?: string
): Promise<{ valid: boolean; error?: string; metadata?: { name?: string; symbol?: string; decimals?: number } }> {
  try {
    const servers = getNetworkServers(network);
    
    // Try to call the token contract's metadata functions
    // We'll use a dummy account for simulation (read-only operations don't need auth)
    const dummyKeypair = StellarSdk.Keypair.random();
    
    try {
      // Load the contract to check if it exists
      const contract = new StellarSdk.Contract(contractAddress);
      const account = await servers.horizonServer.loadAccount(dummyKeypair.publicKey()).catch(() => {
        // If account doesn't exist, create a temporary one for simulation
        return new StellarSdk.Account(dummyKeypair.publicKey(), '0');
      });
      
      // Try to call name() function - all SEP-41 tokens should have this
      const nameOp = contract.call('name');
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: '1000',
        networkPassphrase: servers.networkPassphrase,
      })
        .addOperation(nameOp)
        .setTimeout(30)
        .build();
      
      // Simulate the transaction (read-only, no submission)
      const simResult = await servers.sorobanServer.simulateTransaction(tx);
      
      if (StellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
        // Token exists and is callable
        console.log(`✅ Token contract ${contractAddress} validated on ${network}`);
        return { valid: true };
      } else {
        return { 
          valid: false, 
          error: `Token contract exists but doesn't implement standard token interface (SEP-41)`
        };
      }
    } catch (contractError) {
      const errorMsg = contractError instanceof Error ? contractError.message : String(contractError);
      
      if (errorMsg.includes('MissingValue') || errorMsg.includes('not found')) {
        return {
          valid: false,
          error: `Token contract not found or not initialized on ${network || 'testnet'}`
        };
      }
      
      // Other errors - might still be valid, just can't verify
      console.warn(`⚠️  Could not validate token contract: ${errorMsg}`);
      return { valid: true }; // Assume valid, let deployment try
    }
  } catch (error) {
    console.warn(`⚠️  Token validation skipped:`, error);
    return { valid: true }; // Assume valid, let deployment try
  }
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
  
  // Network-specific token addresses
  const tokenAddresses: { [key: string]: { [key: string]: string } } = {
    'XLM': nativeXLMAddresses,
    'USDC': {
      'testnet': 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
      'futurenet': process.env.FUTURENET_USDC_ADDRESS || nativeXLMAddresses['futurenet'], // Use env var if set, otherwise fallback to XLM
      'mainnet': '', // TODO: Add mainnet USDC address when available
      'public': '',
    },
    'EURC': {
      'testnet': 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU',
      'futurenet': nativeXLMAddresses['futurenet'], // Fallback to XLM
      'mainnet': '',
      'public': '',
    },
    'AQUA': {
      'testnet': 'CCRRYUTYU3UJQME6ZKBDZMZS6P4ZXVFWRXLQGVL7TWVCXHWMLQOAAQUA',
      'futurenet': nativeXLMAddresses['futurenet'], // Fallback to XLM
      'mainnet': '',
      'public': '',
    },
  };

  // If it's already a valid contract address (starts with C and is 56 characters), return it directly
  // This allows users to use ANY token on the Stellar network by providing the contract address
  if (asset.startsWith('C') && asset.length === 56) {
    console.log(`[Asset Resolution] Using custom token contract: ${asset}`);
    return asset;
  }
  
  // Also support 'G' addresses (Stellar account format) - these need to be wrapped as SAC
  if (asset.startsWith('G') && asset.length === 56) {
    console.warn(`⚠️  Classic Stellar asset (${asset}) provided. Make sure this is a wrapped SAC token.`);
    // For now, we can't automatically convert Classic assets to SAC addresses
    // User must provide the SAC wrapper address
    throw new Error(
      `Classic Stellar asset address detected. Please provide the Stellar Asset Contract (SAC) wrapper address instead. ` +
      `Learn more: https://developers.stellar.org/docs/tokens/stellar-asset-contract`
    );
  }

  // Look up asset in network-specific map
  const assetSymbol = asset.toUpperCase();
  const networkAddresses = tokenAddresses[assetSymbol];
  
  if (!networkAddresses) {
    throw new Error(
      `Unknown asset symbol: "${asset}". ` +
      `Please use a known symbol (XLM, USDC, EURC, AQUA) or provide a Stellar contract address (starts with 'C', 56 characters). ` +
      `Find token addresses at: https://github.com/soroswap/token-list`
    );
  }

  const address = networkAddresses[normalizedNetwork];
  
  if (!address) {
    // Fallback to XLM for unsupported network/asset combinations
    console.warn(`⚠️  ${asset} not available on ${network}, using Native XLM instead`);
    return nativeXLMAddresses[normalizedNetwork] || nativeXLMAddresses['testnet'];
  }

  return address;
}

/**
 * Build unsigned deployment transaction for user to sign
 */
export async function buildDeploymentTransaction(
  config: VaultDeploymentConfig,
  sourceAddress: string,
  network?: string
): Promise<{ 
  xdr: string; 
  vaultId: string;
  requiresClientSimulation?: boolean;
  simulationData?: {
    minResourceFee: string;
    transactionData: string;
    results?: any[];
    events?: any[];
  };
}> {
  try {
    const vaultId = generateVaultId();

    console.log(`[Build Deploy TX] Building deployment transaction for ${config.name}`);
    console.log(`[Build Deploy TX] Network requested: ${network || 'testnet'}`);
    console.log(`[Build Deploy TX] Owner: ${config.owner}`);
    console.log(`[Build Deploy TX] Source address to load: ${sourceAddress}`);

    // Convert asset symbols to contract addresses
    const assetAddressStrings = config.assets.map(asset => {
      const address = getAssetAddress(asset, network);
      console.log(`[Build Deploy TX] ${asset} -> ${address}`);
      return address;
    });

    // Get network-specific servers
    const servers = getNetworkServers(network);
    console.log(`[Build Deploy TX] Network parameter received: "${network}"`);
    console.log(`[Build Deploy TX] Resolved network: "${servers.network}"`);
    console.log(`[Build Deploy TX] Network passphrase: "${servers.networkPassphrase}"`);
    console.log(`[Build Deploy TX] Using Horizon URL: ${servers.horizonServer.serverURL.toString()}`);
    console.log(`[Build Deploy TX] Using Soroban URL: ${servers.sorobanServer.serverURL.toString()}`);
    
    // Load source account - check if account exists first
    let sourceAccount;
    try {
      console.log(`[Build Deploy TX] Loading account ${sourceAddress} from ${servers.network}...`);
      sourceAccount = await servers.horizonServer.loadAccount(sourceAddress);
      console.log(`[Build Deploy TX] ✓ Account loaded successfully`);
    } catch (accountError: any) {
      console.error(`[Build Deploy TX] ✗ Failed to load account:`, accountError.message);
      // Check if it's a 'not found' error
      if (accountError.response?.status === 404 || accountError.message?.includes('Not Found')) {
        throw new Error(
          `Wallet account ${sourceAddress} not found on ${servers.network}. ` +
          `Your wallet may be funded on a different network. ` +
          `Please ensure you're connected to ${servers.network} and your wallet is funded. ` +
          `For testnet: https://laboratory.stellar.org/#account-creator?network=test ` +
          `For futurenet: https://laboratory.stellar.org/#account-creator?network=futurenet`
        );
      }
      // Other errors
      throw new Error(`Failed to load account: ${accountError.message || 'Unknown error'}`);
    }

    // Get vault factory contract address
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
      throw new Error(`VAULT_FACTORY_CONTRACT_ID not set for network: ${normalizedNetwork}`);
    }

    console.log(`[Build Deploy TX] Using factory: ${factoryAddress}`);

    // Create contract instance for factory
    const factoryContract = new StellarSdk.Contract(factoryAddress);

    // Convert assets to Address ScVals
    const assetAddresses = assetAddressStrings.map(asset => 
      StellarSdk.Address.fromString(asset).toScVal()
    );

    // Build VaultConfig struct (simplified - only 3 fields needed for factory)
    // Map keys MUST be in alphabetical order for Soroban!
    // Alphabetical order: assets, name, owner
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

    // Determine network passphrase
    const buildNetworkPassphrase = servers.network === 'futurenet' 
      ? StellarSdk.Networks.FUTURENET
      : servers.network === 'mainnet' || servers.network === 'public'
      ? StellarSdk.Networks.PUBLIC
      : StellarSdk.Networks.TESTNET;
    
    console.log(`[Build Deploy TX] TransactionBuilder passphrase selected: "${buildNetworkPassphrase}"`);
    console.log(`[Build Deploy TX] SDK TESTNET constant: "${StellarSdk.Networks.TESTNET}"`);
    console.log(`[Build Deploy TX] SDK FUTURENET constant: "${StellarSdk.Networks.FUTURENET}"`);

    let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: buildNetworkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log(`[Build Deploy TX] Built transaction network passphrase: "${transaction.networkPassphrase}"`);
    console.log(`[Build Deploy TX] Simulating transaction...`);

    // Simulate transaction to get resource footprint
    // WORKAROUND: The SDK's simulateTransaction has XDR parsing bugs in v11.2.0
    // We'll make the raw RPC call and manually parse only what we need
    let simulationResponse;
    try {
      // Try the normal SDK method first
      simulationResponse = await servers.sorobanServer.simulateTransaction(transaction);
    } catch (simError) {
      const errorMsg = simError instanceof Error ? simError.message : String(simError);
      
      // Check if it's the XDR parsing error
      if (errorMsg.includes('Bad union switch') || errorMsg.includes('XDR')) {
        console.warn(`[Build Deploy TX] SDK XDR parsing failed, attempting raw RPC call...`);
        
        try {
          // Make raw RPC call to bypass SDK's XDR parsing
          const rawResponse = await fetch(servers.sorobanServer.serverURL.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: Date.now(),
              method: 'simulateTransaction',
              params: {
                transaction: transaction.toXDR(),
              },
            }),
          });
          
          const rawResult: any = await rawResponse.json();
          
          if (rawResult.error) {
            throw new Error(`RPC error: ${rawResult.error.message || JSON.stringify(rawResult.error)}`);
          }
          
          const result: any = rawResult.result;
          console.log(`[Build Deploy TX] Raw RPC simulation result:`, JSON.stringify(result, null, 2));
          
          // Check if simulation failed
          if (result.error) {
            throw new Error(`Simulation failed: ${result.error}`);
          }
          
          // Check if we have the necessary data
          if (!result.transactionData) {
            throw new Error('Simulation response missing transactionData');
          }
          
          // Manually construct the minimum response needed for assembleTransaction
          // We'll build the transaction manually since the SDK can't parse the response
          const minResourceFee = result.minResourceFee || result.cost?.cpuInsns || '100000';
          const transactionDataXdr = result.transactionData;
          
          console.log(`[Build Deploy TX] ✅ Raw RPC call successful`);
          console.log(`[Build Deploy TX] Min resource fee: ${minResourceFee}`);
          
          try {
            // Try to parse transactionData XDR to get the SorobanTransactionData
            const sorobanData = StellarSdk.xdr.SorobanTransactionData.fromXDR(transactionDataXdr, 'base64');
            
            // Rebuild transaction with the soroban data
            const ops = transaction.operations;
            const sourceOp = ops[0] as StellarSdk.Operation.InvokeHostFunction;
            
            transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
              fee: (Number(minResourceFee) + Number(StellarSdk.BASE_FEE) * 10).toString(), // Add buffer
              networkPassphrase: servers.network === 'futurenet' 
                ? StellarSdk.Networks.FUTURENET
                : servers.network === 'mainnet' || servers.network === 'public'
                ? StellarSdk.Networks.PUBLIC
                : StellarSdk.Networks.TESTNET,
            })
              .setSorobanData(sorobanData)
              .addOperation(
                StellarSdk.Operation.invokeHostFunction({
                  func: sourceOp.func,
                  auth: result.results?.[0]?.auth || sourceOp.auth || [],
                })
              )
              .setTimeout(300)
              .build();
            
            console.log(`[Build Deploy TX] ✅ Transaction rebuilt with raw RPC data`);
            
            // Return early with XDR - skip the rest of the simulation parsing
            return {
              xdr: transaction.toXDR(),
              vaultId,
            };
          } catch (xdrParseError) {
            console.error(`[Build Deploy TX] XDR parsing failed, returning unsigned transaction:`, xdrParseError);
            
            // If XDR parsing fails completely, return the original transaction
            // The client will need to handle simulation themselves
            console.log(`[Build Deploy TX] ⚠️ Returning base transaction without resource footprint`);
            console.log(`[Build Deploy TX] Client must simulate and assemble transaction before signing`);
            
            return {
              xdr: transaction.toXDR(),
              vaultId,
              requiresClientSimulation: true, // Flag to indicate client needs to simulate
              simulationData: {
                minResourceFee,
                transactionData: transactionDataXdr,
                results: result.results,
                events: result.events,
              },
            };
          }
        } catch (rawError) {
          console.error(`[Build Deploy TX] Raw RPC call also failed:`, rawError);
          throw new Error(
            `XDR parsing error: The Stellar SDK cannot parse the Soroban RPC response from ${normalizedNetwork}. ` +
            `This is likely a version incompatibility issue. ` +
            `Raw RPC call also failed: ${rawError instanceof Error ? rawError.message : 'Unknown error'}. ` +
            `Please check: 1) Factory contract ${factoryAddress} is deployed on ${normalizedNetwork}, ` +
            `2) Contract is properly initialized, 3) The network protocol version is compatible with the SDK.`
          );
        }
      }
      
      // If it's not an XDR error, rethrow
      throw new Error(`Failed to simulate transaction: ${errorMsg}`);
    }
    
    // Check for simulation error first
    if (StellarSdk.rpc.Api.isSimulationError(simulationResponse)) {
      console.error(`[Build Deploy TX] Simulation error details:`, simulationResponse);
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }

    // Check if simulation was successful
    if (!StellarSdk.rpc.Api.isSimulationSuccess(simulationResponse)) {
      console.error(`[Build Deploy TX] Unexpected simulation response:`, simulationResponse);
      throw new Error(`Simulation did not return success status. Check if factory contract is deployed and initialized.`);
    }

    console.log(`[Build Deploy TX] Simulation successful`);

    // Prepare the transaction with simulation results
    try {
      // Use the assembleTransaction helper which handles XDR parsing
      const preparedTx = StellarSdk.rpc.assembleTransaction(
        transaction,
        simulationResponse
      );
      
      transaction = preparedTx.build();
    } catch (assembleError) {
      console.error(`[Build Deploy TX] Error assembling transaction:`, assembleError);
      
      // Check if it's the XDR parsing error
      const errorMsg = assembleError instanceof Error ? assembleError.message : String(assembleError);
      if (errorMsg.includes('Bad union switch') || errorMsg.includes('XDR')) {
        // Try manual assembly as a fallback
        console.warn(`[Build Deploy TX] XDR parsing failed, attempting manual assembly...`);
        
        try {
          // Manually add auth and resource footprint from simulation
          if (simulationResponse.transactionData) {
            // transactionData is already a SorobanDataBuilder, convert to XDR string first
            const txDataXdr = simulationResponse.transactionData.build().toXDR('base64');
            const txData = StellarSdk.xdr.SorobanTransactionData.fromXDR(txDataXdr, 'base64');
            
            // Rebuild transaction with proper soroban data
            const ops = transaction.operations;
            const sourceOp = ops[0] as StellarSdk.Operation.InvokeHostFunction;
            
            transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
              fee: (Number(simulationResponse.minResourceFee) + Number(StellarSdk.BASE_FEE)).toString(),
              networkPassphrase: servers.network === 'futurenet' 
                ? StellarSdk.Networks.FUTURENET
                : servers.network === 'mainnet' || servers.network === 'public'
                ? StellarSdk.Networks.PUBLIC
                : StellarSdk.Networks.TESTNET,
            })
              .setSorobanData(txData)
              .addOperation(
                StellarSdk.Operation.invokeHostFunction({
                  func: sourceOp.func,
                  auth: sourceOp.auth || [],
                })
              )
              .setTimeout(300)
              .build();
              
            console.log(`[Build Deploy TX] ✅ Manual assembly successful`);
          } else {
            throw new Error('No transactionData in simulation response');
          }
        } catch (manualError) {
          console.error(`[Build Deploy TX] Manual assembly also failed:`, manualError);
          throw new Error(
            `XDR parsing error: The Soroban RPC server returned an incompatible response. ` +
            `This usually means: 1) The factory contract (${factoryAddress}) is not properly deployed on ${normalizedNetwork}, ` +
            `2) The contract WASM is outdated/incompatible with the current RPC version, or ` +
            `3) There's a version mismatch between stellar-sdk and the RPC server. ` +
            `Please verify the factory contract is deployed and try again. Original error: ${errorMsg}`
          );
        }
      } else {
        throw new Error(`Failed to assemble transaction: ${errorMsg}`);
      }
    }

    console.log(`[Build Deploy TX] Transaction built successfully, returning XDR for signing`);

    return {
      xdr: transaction.toXDR(),
      vaultId,
    };
  } catch (error) {
    console.error('Error building deployment transaction:', error);
    throw error;
  }
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
    console.log(`[Vault Deployment] Network: ${network || 'testnet'}`);
    console.log(`[Vault Deployment] Owner: ${config.owner}`);
    console.log(`[Vault Deployment] Assets: ${config.assets.join(', ')}`);

    // Convert asset symbols to contract addresses (network-aware)
    const assetAddressStrings = config.assets.map(asset => {
      const address = getAssetAddress(asset, network);
      console.log(`[Vault Deployment] ${asset} -> ${address}`);
      return address;
    });
    
    // Optional: Validate custom token contracts (for addresses starting with 'C')
    // This is a best-effort validation - if it fails, we'll still allow deployment
    for (let i = 0; i < config.assets.length; i++) {
      const asset = config.assets[i];
      const address = assetAddressStrings[i];
      
      // Only validate custom addresses (not well-known tokens)
      if (asset.startsWith('C') && asset.length === 56) {
        console.log(`[Vault Deployment] Validating custom token: ${address}`);
        const validation = await validateTokenContract(address, network);
        
        if (!validation.valid && validation.error) {
          console.warn(`⚠️  Token validation warning: ${validation.error}`);
          console.warn(`⚠️  Continuing deployment anyway - vault may fail if token is invalid`);
        } else if (validation.valid) {
          console.log(`✅ Custom token validated successfully`);
        }
      }
    }
    
    // Warn if non-XLM tokens are being used on futurenet
    if ((network || 'testnet').toLowerCase() === 'futurenet') {
      const nonXLMAssets = config.assets.filter(a => a.toUpperCase() !== 'XLM');
      if (nonXLMAssets.length > 0) {
        console.warn(`⚠️  WARNING: Non-XLM tokens on futurenet may not be available.`);
        console.warn(`⚠️  Requested: ${nonXLMAssets.join(', ')}`);
        console.warn(`⚠️  These will be converted to Native XLM automatically.`);
      }
    }

    // Get network-specific servers
    const servers = getNetworkServers(network);
    
    // Load source account - check if account exists first
    let sourceAccount;
    try {
      sourceAccount = await servers.horizonServer.loadAccount(sourceKeypair.publicKey());
    } catch (accountError: any) {
      // Check if it's a 'not found' error
      if (accountError.response?.status === 404 || accountError.message?.includes('Not Found')) {
        throw new Error(
          `Wallet account not found on ${network || 'testnet'}. ` +
          `Please fund your wallet first using the Stellar Laboratory or Friendbot. ` +
          `For testnet: https://laboratory.stellar.org/#account-creator?network=test ` +
          `For futurenet: https://laboratory.stellar.org/#account-creator?network=futurenet`
        );
      }
      // Other errors
      throw new Error(`Failed to load account: ${accountError.message || 'Unknown error'}`);
    }

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
    let simulationResponse;
    try {
      simulationResponse = await servers.sorobanServer.simulateTransaction(transaction);
    } catch (simError) {
      console.error(`[Vault Deployment] Simulation request failed:`, simError);
      throw new Error(`Failed to simulate transaction: ${simError instanceof Error ? simError.message : 'Unknown error'}`);
    }
    
    // Check for simulation error first
    if (StellarSdk.rpc.Api.isSimulationError(simulationResponse)) {
      console.error(`[Vault Deployment] Simulation error details:`, simulationResponse);
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }

    // Check if simulation was successful
    if (!StellarSdk.rpc.Api.isSimulationSuccess(simulationResponse)) {
      console.error(`[Vault Deployment] Unexpected simulation response:`, simulationResponse);
      throw new Error(`Simulation did not return success status. Check if factory contract is deployed and initialized.`);
    }

    console.log(`[Vault Deployment] Simulation successful`);

    // Prepare the transaction with simulation results
    try {
      // Use the assembleTransaction helper which handles XDR parsing
      const preparedTx = StellarSdk.rpc.assembleTransaction(
        transaction,
        simulationResponse
      );
      
      transaction = preparedTx.build();
    } catch (assembleError) {
      console.error(`[Vault Deployment] Error assembling transaction:`, assembleError);
      
      // Check if it's the XDR parsing error
      const errorMsg = assembleError instanceof Error ? assembleError.message : String(assembleError);
      if (errorMsg.includes('Bad union switch') || errorMsg.includes('XDR')) {
        // Try manual assembly as a fallback
        console.warn(`[Vault Deployment] XDR parsing failed, attempting manual assembly...`);
        
        try {
          // Manually add auth and resource footprint from simulation
          if (simulationResponse.transactionData) {
            // transactionData is already a SorobanDataBuilder, convert to XDR string first
            const txDataXdr = simulationResponse.transactionData.build().toXDR('base64');
            const txData = StellarSdk.xdr.SorobanTransactionData.fromXDR(txDataXdr, 'base64');
            
            // Rebuild transaction with proper soroban data
            const ops = transaction.operations;
            const sourceOp = ops[0] as StellarSdk.Operation.InvokeHostFunction;
            
            transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
              fee: (Number(simulationResponse.minResourceFee) + Number(StellarSdk.BASE_FEE)).toString(),
              networkPassphrase: servers.network === 'futurenet' 
                ? StellarSdk.Networks.FUTURENET
                : servers.network === 'mainnet' || servers.network === 'public'
                ? StellarSdk.Networks.PUBLIC
                : StellarSdk.Networks.TESTNET,
            })
              .setSorobanData(txData)
              .addOperation(
                StellarSdk.Operation.invokeHostFunction({
                  func: sourceOp.func,
                  auth: sourceOp.auth || [],
                })
              )
              .setTimeout(300)
              .build();
              
            console.log(`[Vault Deployment] ✅ Manual assembly successful`);
          } else {
            throw new Error('No transactionData in simulation response');
          }
        } catch (manualError) {
          console.error(`[Vault Deployment] Manual assembly also failed:`, manualError);
          throw new Error(
            `XDR parsing error: The Soroban RPC server returned an incompatible response. ` +
            `This usually means: 1) The factory contract (${factoryAddress}) is not properly deployed on ${normalizedNetwork}, ` +
            `2) The contract WASM is outdated/incompatible with the current RPC version, or ` +
            `3) There's a version mismatch between stellar-sdk and the RPC server. ` +
            `Please verify the factory contract is deployed and try again. Original error: ${errorMsg}`
          );
        }
      } else {
        throw new Error(`Failed to assemble transaction: ${errorMsg}`);
      }
    }

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
    // Get network-specific servers
    const servers = getNetworkServers(network);
    
    // Load source account - check if account exists first
    let sourceAccount;
    try {
      sourceAccount = await servers.horizonServer.loadAccount(sourceKeypair.publicKey());
    } catch (accountError: any) {
      // Check if it's a 'not found' error
      if (accountError.response?.status === 404 || accountError.message?.includes('Not Found')) {
        throw new Error(
          `Wallet account not found on ${network || 'testnet'}. ` +
          `Please fund your wallet first using the Stellar Laboratory or Friendbot. ` +
          `For testnet: https://laboratory.stellar.org/#account-creator?network=test ` +
          `For futurenet: https://laboratory.stellar.org/#account-creator?network=futurenet`
        );
      }
      // Other errors
      throw new Error(`Failed to load account: ${accountError.message || 'Unknown error'}`);
    }
    
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
    
    // Simulate transaction to get resource footprint and auth
    const simulationResponse = await servers.sorobanServer.simulateTransaction(transaction);
    
    if (StellarSdk.rpc.Api.isSimulationError(simulationResponse)) {
      console.error(`❌ Contract simulation failed for ${method}:`, simulationResponse.error);
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }
    
    // Define read-only methods that don't need to be submitted
    const readOnlyMethods = [
      'get_state',
      'get_position',
      'get_config',
      'get_total_value',
      'get_share_price',
      'balance',
      'allowance',
    ];
    
    const isReadOnly = readOnlyMethods.includes(method);
    
    // Extract the actual contract return value from simulation
    let contractResult = null;
    if (simulationResponse.result && 'retval' in simulationResponse.result) {
      contractResult = simulationResponse.result.retval;
    }
    
    // For read-only methods, return simulation result without submitting transaction
    if (isReadOnly) {
      
      return {
        success: true,
        hash: null, // No transaction hash for read-only calls
        result: contractResult,
        readOnly: true,
      };
    }
    
    // For write methods, assemble and submit the transaction
    // Assemble the transaction with simulation results (adds footprint and auth)
    transaction = StellarSdk.rpc.assembleTransaction(
      transaction,
      simulationResponse
    ).build();
    
    // Sign transaction
    transaction.sign(sourceKeypair);
    
    // Submit transaction
    const response = await servers.horizonServer.submitTransaction(transaction);
    
    console.log(`✅ ${method} transaction submitted: ${response.hash}`);
    console.log(`🔗 https://stellar.expert/explorer/${servers.network}/tx/${response.hash}`);
    
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


