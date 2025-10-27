// Vault core contract functionality
use soroban_sdk::{contract, contractimpl, Address, Env, Symbol, symbol_short, token};

use crate::types::{VaultConfig, VaultState, UserPosition};
use crate::errors::VaultError;
use crate::events::{emit_deposit, emit_withdraw};

const CONFIG: Symbol = symbol_short!("CONFIG");
const STATE: Symbol = symbol_short!("STATE");
const POSITION: Symbol = symbol_short!("POSITION");

#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    /// Initialize a new vault
    pub fn initialize(env: Env, config: VaultConfig) -> Result<(), VaultError> {
        // Check if already initialized
        if env.storage().instance().has(&CONFIG) {
            return Err(VaultError::AlreadyInitialized);
        }

        // Validate configuration
        if config.assets.is_empty() {
            return Err(VaultError::InvalidConfiguration);
        }

        // Initialize vault state
        let state = VaultState {
            total_shares: 0,
            total_value: 0,
            last_rebalance: env.ledger().timestamp(),
        };

        // Store configuration and state
        env.storage().instance().set(&CONFIG, &config);
        env.storage().instance().set(&STATE, &state);

        Ok(())
    }

    /// Deposit assets into the vault
    pub fn deposit(env: Env, user: Address, amount: i128) -> Result<i128, VaultError> {
        // Debug: Entry point
        env.events().publish((symbol_short!("debug"),), symbol_short!("start"));
        
        // Require authorization from the user first
        user.require_auth();
        env.events().publish((symbol_short!("debug"),), symbol_short!("auth_ok"));
        
        // Check vault is initialized
        if !env.storage().instance().has(&CONFIG) {
            return Err(VaultError::NotInitialized);
        }
        env.events().publish((symbol_short!("debug"),), symbol_short!("init_ok"));

        // Validate amount
        if amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }
        env.events().publish((symbol_short!("debug"),), symbol_short!("amt_ok"));

        // Get user position first (before any transfers)
        let mut position = Self::get_position(env.clone(), user.clone());
        env.events().publish((symbol_short!("debug"),), symbol_short!("pos_ok"));

        // Get config to determine base asset (first asset in the vault)
        let config: VaultConfig = env.storage().instance().get(&CONFIG)
            .ok_or(VaultError::NotInitialized)?;
        env.events().publish((symbol_short!("debug"),), symbol_short!("cfg_ok"));
        
        if config.assets.is_empty() {
            return Err(VaultError::InvalidConfiguration);
        }
        
        let base_token = config.assets.get(0)
            .ok_or(VaultError::InvalidConfiguration)?;
        env.events().publish((symbol_short!("debug"),), symbol_short!("tok_ok"));

        // Get vault address
        let vault_address = env.current_contract_address();
        env.events().publish((symbol_short!("debug"),), symbol_short!("addr_ok"));
        
        // Transfer tokens from user to vault using token contract
        // The transfer must happen BEFORE any state changes
        env.events().publish((symbol_short!("debug"),), symbol_short!("b4_xfer"));
        let token_client = token::TokenClient::new(&env, &base_token);
        token_client.transfer(&user, &vault_address, &amount);
        env.events().publish((symbol_short!("debug"),), symbol_short!("xfer_ok"));

        // Get current state
        let mut state: VaultState = env.storage().instance().get(&STATE)
            .ok_or(VaultError::NotInitialized)?;

        // Calculate shares to mint
        let shares = if state.total_shares == 0 {
            amount // First deposit: 1:1 ratio
        } else {
            // shares = (amount * total_shares) / total_value
            amount.checked_mul(state.total_shares)
                .and_then(|v| v.checked_div(state.total_value))
                .ok_or(VaultError::InvalidAmount)?
        };

        // Update state
        state.total_shares = state.total_shares.checked_add(shares)
            .ok_or(VaultError::InvalidAmount)?;
        state.total_value = state.total_value.checked_add(amount)
            .ok_or(VaultError::InvalidAmount)?;

        // Update user position (position was already fetched at the start)
        position.shares = position.shares.checked_add(shares)
            .ok_or(VaultError::InvalidAmount)?;
        position.last_deposit = env.ledger().timestamp();

        // Store updates
        env.storage().instance().set(&STATE, &state);
        env.storage().instance().set(&(POSITION, user.clone()), &position);

        // Emit event
        emit_deposit(&env, &user, amount, shares);

        Ok(shares)
    }

    /// Withdraw assets from the vault
    pub fn withdraw(env: Env, user: Address, shares: i128) -> Result<i128, VaultError> {
        // Require authorization from the user first
        user.require_auth();
        
        // Check vault is initialized
        if !env.storage().instance().has(&CONFIG) {
            return Err(VaultError::NotInitialized);
        }

        // Validate shares
        if shares <= 0 {
            return Err(VaultError::InvalidAmount);
        }

        // Get user position
        let mut position = Self::get_position(env.clone(), user.clone());
        if position.shares < shares {
            return Err(VaultError::InsufficientShares);
        }

        // Get current state
        let mut state: VaultState = env.storage().instance().get(&STATE)
            .ok_or(VaultError::NotInitialized)?;

        // Guard against division by zero
        if state.total_shares == 0 {
            return Err(VaultError::InvalidAmount);
        }

        // Calculate amount to return
        // amount = (shares * total_value) / total_shares
        let amount = shares.checked_mul(state.total_value)
            .and_then(|v| v.checked_div(state.total_shares))
            .ok_or(VaultError::InvalidAmount)?;

        // Get config to determine base asset
        let config: VaultConfig = env.storage().instance().get(&CONFIG)
            .ok_or(VaultError::NotInitialized)?;
        
        if config.assets.is_empty() {
            return Err(VaultError::InvalidConfiguration);
        }
        
        let base_token = config.assets.get(0)
            .ok_or(VaultError::InvalidConfiguration)?;

        // Get vault address
        let vault_address = env.current_contract_address();
        
        // Transfer tokens from vault to user using token contract
        // DO NOT call user.require_auth() - vault doesn't need user auth to send funds to them
        let token_client = token::TokenClient::new(&env, &base_token);
        token_client.transfer(&vault_address, &user, &amount);

        // Update state
        state.total_shares = state.total_shares.checked_sub(shares)
            .ok_or(VaultError::InvalidAmount)?;
        state.total_value = state.total_value.checked_sub(amount)
            .ok_or(VaultError::InvalidAmount)?;

        // Update user position
        position.shares = position.shares.checked_sub(shares)
            .ok_or(VaultError::InvalidAmount)?;

        // Store updates
        env.storage().instance().set(&STATE, &state);
        if position.shares == 0 {
            env.storage().instance().remove(&(POSITION, user.clone()));
        } else {
            env.storage().instance().set(&(POSITION, user.clone()), &position);
        }

        // Emit event
        emit_withdraw(&env, &user, shares, amount);

        Ok(amount)
    }

    /// Get vault state
    pub fn get_state(env: Env) -> VaultState {
        env.storage().instance().get(&STATE)
            .unwrap_or(VaultState {
                total_shares: 0,
                total_value: 0,
                last_rebalance: 0,
            })
    }

    /// Get user position
    pub fn get_position(env: Env, user: Address) -> UserPosition {
        env.storage().instance().get(&(POSITION, user))
            .unwrap_or(UserPosition {
                shares: 0,
                last_deposit: 0,
            })
    }

    /// Get vault configuration
    pub fn get_config(env: Env) -> Result<VaultConfig, VaultError> {
        env.storage().instance().get(&CONFIG)
            .ok_or(VaultError::NotInitialized)
    }

    /// Set router address for swaps (owner only)
    pub fn set_router(env: Env, router: Address) -> Result<(), VaultError> {
        // Check vault is initialized
        if !env.storage().instance().has(&CONFIG) {
            return Err(VaultError::NotInitialized);
        }

        // Get config and verify owner
        let mut config: VaultConfig = env.storage().instance().get(&CONFIG)
            .ok_or(VaultError::NotInitialized)?;
        
        config.owner.require_auth();
        
        // Update router address
        config.router_address = Some(router);
        
        // Store updated config
        env.storage().instance().set(&CONFIG, &config);
        
        Ok(())
    }

    /// Trigger a rebalance based on configured rules (owner only)
    pub fn trigger_rebalance(env: Env) -> Result<(), VaultError> {
        // Check vault is initialized
        if !env.storage().instance().has(&CONFIG) {
            return Err(VaultError::NotInitialized);
        }

        // Require owner authorization to prevent spam
        let config: VaultConfig = env.storage().instance().get(&CONFIG)
            .ok_or(VaultError::NotInitialized)?;
        config.owner.require_auth();

        // Check if rebalancing should occur based on rules
        if !crate::engine::should_rebalance(&env) {
            return Ok(()); // No rebalancing needed
        }

        let _config: VaultConfig = env.storage().instance().get(&CONFIG)
            .ok_or(VaultError::NotInitialized)?;
        
        let mut state: VaultState = env.storage().instance().get(&STATE)
            .ok_or(VaultError::NotInitialized)?;

        // Execute rebalance logic
        crate::rebalance::execute_rebalance(&env)?;

        // Update last rebalance timestamp
        state.last_rebalance = env.ledger().timestamp();
        env.storage().instance().set(&STATE, &state);

        // Emit rebalance event
        crate::events::emit_rebalance(&env, state.last_rebalance);

        Ok(())
    }
}
