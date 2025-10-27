// Vault factory contract for generating vault instances
use soroban_sdk::{contract, contractimpl, Address, Env, BytesN, Symbol, symbol_short, Vec};
use crate::types::VaultConfig;

const WASM_HASH: Symbol = symbol_short!("WASM");
const VAULT_COUNT: Symbol = symbol_short!("COUNT");
const VAULT_LIST: Symbol = symbol_short!("VAULTS");

#[contract]
pub struct VaultFactory;

#[contractimpl]
impl VaultFactory {
    /// Initialize the factory with vault contract WASM hash
    pub fn initialize(env: Env, wasm_hash: BytesN<32>) -> Result<(), crate::errors::VaultError> {
        if env.storage().instance().has(&WASM_HASH) {
            return Err(crate::errors::VaultError::AlreadyInitialized);
        }
        
        env.storage().instance().set(&WASM_HASH, &wasm_hash);
        env.storage().instance().set(&VAULT_COUNT, &0u32);
        
        let empty_list: Vec<Address> = Vec::new(&env);
        env.storage().instance().set(&VAULT_LIST, &empty_list);
        
        Ok(())
    }

    /// Deploy a new vault instance
    pub fn create_vault(env: Env, config: VaultConfig) -> Result<Address, crate::errors::VaultError> {
        // Get WASM hash
        let wasm_hash: BytesN<32> = env.storage().instance()
            .get(&WASM_HASH)
            .ok_or(crate::errors::VaultError::NotInitialized)?;
        
        // Generate unique salt for this vault
        let mut vault_count: u32 = env.storage().instance()
            .get(&VAULT_COUNT)
            .unwrap_or(0);
        
        vault_count = vault_count.checked_add(1)
            .ok_or(crate::errors::VaultError::InvalidConfiguration)?;
        
        // Create salt from count and owner address
        let salt = BytesN::from_array(&env, &create_salt(vault_count));
        
        // Deploy new vault contract instance
        let vault_address = env.deployer()
            .with_current_contract(salt)
            .deploy(wasm_hash);
        
        // Update vault count and list
        env.storage().instance().set(&VAULT_COUNT, &vault_count);
        
        let mut vaults: Vec<Address> = env.storage().instance()
            .get(&VAULT_LIST)
            .unwrap_or(Vec::new(&env));
        vaults.push_back(vault_address.clone());
        env.storage().instance().set(&VAULT_LIST, &vaults);
        
        Ok(vault_address)
    }

    /// Get vault contract WASM hash
    pub fn get_vault_wasm_hash(env: Env) -> Result<BytesN<32>, crate::errors::VaultError> {
        env.storage().instance()
            .get(&WASM_HASH)
            .ok_or(crate::errors::VaultError::NotInitialized)
    }

    /// Get total number of vaults created
    pub fn get_vault_count(env: Env) -> u32 {
        env.storage().instance()
            .get(&VAULT_COUNT)
            .unwrap_or(0)
    }

    /// Get list of all deployed vault addresses
    pub fn get_vaults(env: Env) -> Vec<Address> {
        env.storage().instance()
            .get(&VAULT_LIST)
            .unwrap_or(Vec::new(&env))
    }

    /// Get vault at specific index
    pub fn get_vault_at(env: Env, index: u32) -> Result<Address, crate::errors::VaultError> {
        let vaults: Vec<Address> = env.storage().instance()
            .get(&VAULT_LIST)
            .unwrap_or(Vec::new(&env));
        
        vaults.get(index)
            .ok_or(crate::errors::VaultError::InvalidConfiguration)
    }
}

/// Create a unique salt for vault deployment
fn create_salt(count: u32) -> [u8; 32] {
    let mut salt = [0u8; 32];
    let count_bytes = count.to_be_bytes();
    salt[0..4].copy_from_slice(&count_bytes);
    salt
}
