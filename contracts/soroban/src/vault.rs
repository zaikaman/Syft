// Vault core contract functionality
use soroban_sdk::{contract, contractimpl, Address, Env, Symbol, symbol_short, token, log};

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

    /// Deposit assets into the vault (with optional auto-swap)
    /// If deposit_token is different from base token, it will be swapped automatically
    pub fn deposit(env: Env, user: Address, amount: i128) -> Result<i128, VaultError> {
        // Call deposit_with_token using the base asset (first asset)
        let config: VaultConfig = env.storage().instance().get(&CONFIG)
            .ok_or(VaultError::NotInitialized)?;
        
        if config.assets.is_empty() {
            return Err(VaultError::InvalidConfiguration);
        }
        
        let base_token = config.assets.get(0)
            .ok_or(VaultError::InvalidConfiguration)?;
        
        Self::deposit_with_token(env, user, amount, base_token)
    }

    /// Deposit with specific token (will auto-swap if not base asset)
    pub fn deposit_with_token(env: Env, user: Address, amount: i128, deposit_token: Address) -> Result<i128, VaultError> {
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
        
        // Transfer deposit token from user to vault
        env.events().publish((symbol_short!("debug"),), symbol_short!("b4_xfer"));
        let deposit_token_client = token::TokenClient::new(&env, &deposit_token);
        deposit_token_client.transfer(&user, &vault_address, &amount);
        env.events().publish((symbol_short!("debug"),), symbol_short!("xfer_ok"));

        // AUTO-SWAP: If deposit token differs from base token, automatically swap to base token
        // This allows users to deposit ANY token (e.g., XLM) into vaults with different base assets (e.g., USDC)
        // The vault will automatically swap the deposited token to match the base asset
        let final_amount = if deposit_token != base_token {
            // Deposit token is different from base token - need to swap
            env.events().publish((symbol_short!("debug"),), symbol_short!("swap_req"));
            
            // Check if router is configured
            let router_address = config.router_address
                .ok_or(VaultError::RouterNotSet)?;
            
            env.events().publish((symbol_short!("debug"),), symbol_short!("swap_go"));
            
            // Swap deposit token to base token via router
            let swapped_amount = crate::swap_router::swap_via_router(
                &env,
                &router_address,
                &deposit_token,
                &base_token,
                amount,
                0, // min_amount_out = 0 (accept any slippage for now)
            )?;
            
            env.events().publish((symbol_short!("debug"),), symbol_short!("swap_ok"));
            swapped_amount
        } else {
            // Deposit token matches base token - no swap needed
            amount
        };

        // Get current state
        let mut state: VaultState = env.storage().instance().get(&STATE)
            .ok_or(VaultError::NotInitialized)?;

        // Calculate shares to mint based on final amount (after swap if needed)
        let shares = if state.total_shares == 0 {
            final_amount // First deposit: 1:1 ratio
        } else {
            // shares = (final_amount * total_shares) / total_value
            final_amount.checked_mul(state.total_shares)
                .and_then(|v| v.checked_div(state.total_value))
                .ok_or(VaultError::InvalidAmount)?
        };

        // Update state with final amount
        state.total_shares = state.total_shares.checked_add(shares)
            .ok_or(VaultError::InvalidAmount)?;
        state.total_value = state.total_value.checked_add(final_amount)
            .ok_or(VaultError::InvalidAmount)?;

        // Update user position (position was already fetched at the start)
        position.shares = position.shares.checked_add(shares)
            .ok_or(VaultError::InvalidAmount)?;
        position.last_deposit = env.ledger().timestamp();

        // Store updates
        env.storage().instance().set(&STATE, &state);
        env.storage().instance().set(&(POSITION, user.clone()), &position);

        // Emit event with final amount (after swap)
        emit_deposit(&env, &user, final_amount, shares);

        // NOTE: Auto-swap is now ENABLED for deposits
        // If user deposits a token different from the vault's base token, it will automatically swap
        // Example: Vault has USDC as base, user deposits XLM → automatically swaps XLM to USDC
        //
        // For multi-asset vaults with specific allocations, users should still call force_rebalance()
        // after deposit to rebalance across all configured assets according to target allocation

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

    /// Set the staking pool address for liquid staking (e.g., stXLM)
    pub fn set_staking_pool(env: Env, caller: Address, staking_pool: Address) -> Result<(), VaultError> {
        caller.require_auth();
        
        let mut config: VaultConfig = env.storage().instance().get(&CONFIG)
            .ok_or(VaultError::NotInitialized)?;
        
        // Only owner can update staking pool
        if caller != config.owner {
            return Err(VaultError::Unauthorized);
        }
        
        config.staking_pool_address = Some(staking_pool);
        
        // Store updated config
        env.storage().instance().set(&CONFIG, &config);
        
        Ok(())
    }

    /// Set the factory address for finding liquidity pools
    pub fn set_factory(env: Env, caller: Address, factory: Address) -> Result<(), VaultError> {
        caller.require_auth();
        
        let mut config: VaultConfig = env.storage().instance().get(&CONFIG)
            .ok_or(VaultError::NotInitialized)?;
        
        // Only owner can update factory
        if caller != config.owner {
            return Err(VaultError::Unauthorized);
        }
        
        config.factory_address = Some(factory);
        
        // Store updated config
        env.storage().instance().set(&CONFIG, &config);
        
        Ok(())
    }

    /// Trigger a rebalance based on configured rules (only rebalance actions)
    /// Can be called by anyone, but only executes if rebalance rules are met
    pub fn trigger_rebalance(env: Env) -> Result<(), VaultError> {
        // Check vault is initialized
        if !env.storage().instance().has(&CONFIG) {
            return Err(VaultError::NotInitialized);
        }

        // Check if rebalancing should occur based on rules
        // NOTE: Anyone can call this, but it only rebalances if rules are satisfied
        // This prevents griefing while allowing automated rebalancing
        if !crate::engine::should_rebalance(&env) {
            return Ok(()); // No rebalancing needed
        }

        let _config: VaultConfig = env.storage().instance().get(&CONFIG)
            .ok_or(VaultError::NotInitialized)?;
        
        let mut state: VaultState = env.storage().instance().get(&STATE)
            .ok_or(VaultError::NotInitialized)?;

        // Execute only rebalance actions
        crate::rebalance::execute_rebalance_only(&env)?;

        // Update last rebalance timestamp
        state.last_rebalance = env.ledger().timestamp();
        env.storage().instance().set(&STATE, &state);

        // Emit rebalance event
        crate::events::emit_rebalance(&env, state.last_rebalance);

        Ok(())
    }

    /// Trigger staking based on configured rules (only stake actions)
    /// Can be called by anyone, but only executes if stake rules are met
    pub fn trigger_stake(env: Env) -> Result<(), VaultError> {
        // Check vault is initialized
        if !env.storage().instance().has(&CONFIG) {
            return Err(VaultError::NotInitialized);
        }

        // Check if staking should occur based on rules
        if !crate::engine::should_stake(&env) {
            return Ok(()); // No staking needed
        }

        let _config: VaultConfig = env.storage().instance().get(&CONFIG)
            .ok_or(VaultError::NotInitialized)?;
        
        let mut state: VaultState = env.storage().instance().get(&STATE)
            .ok_or(VaultError::NotInitialized)?;

        // Execute only stake actions
        crate::rebalance::execute_stake_only(&env)?;

        // Update last rebalance timestamp
        state.last_rebalance = env.ledger().timestamp();
        env.storage().instance().set(&STATE, &state);

        // Emit stake event
        env.events().publish((symbol_short!("staked"),), state.last_rebalance);

        Ok(())
    }

    /// Trigger liquidity provision based on configured rules (only liquidity actions)
    /// Can be called by anyone, but only executes if liquidity rules are met
    pub fn trigger_liquidity(env: Env) -> Result<(), VaultError> {
        // Check vault is initialized
        if !env.storage().instance().has(&CONFIG) {
            return Err(VaultError::NotInitialized);
        }

        // Check if liquidity provision should occur based on rules
        if !crate::engine::should_provide_liquidity(&env) {
            return Ok(()); // No liquidity provision needed
        }

        let _config: VaultConfig = env.storage().instance().get(&CONFIG)
            .ok_or(VaultError::NotInitialized)?;
        
        let mut state: VaultState = env.storage().instance().get(&STATE)
            .ok_or(VaultError::NotInitialized)?;

        // Execute only liquidity actions
        crate::rebalance::execute_liquidity_only(&env)?;

        // Update last rebalance timestamp
        state.last_rebalance = env.ledger().timestamp();
        env.storage().instance().set(&STATE, &state);

        // Emit liquidity event
        env.events().publish((symbol_short!("liquidity"),), state.last_rebalance);

        Ok(())
    }

    /// Force rebalance to target allocation (for post-deposit swaps)
    /// Always executes rebalance regardless of rules
    pub fn force_rebalance(env: Env) -> Result<(), VaultError> {
        // Check vault is initialized
        if !env.storage().instance().has(&CONFIG) {
            return Err(VaultError::NotInitialized);
        }

        let _config: VaultConfig = env.storage().instance().get(&CONFIG)
            .ok_or(VaultError::NotInitialized)?;

        let mut state: VaultState = env.storage().instance().get(&STATE)
            .ok_or(VaultError::NotInitialized)?;

        // Execute rebalance logic without checking rules
        crate::rebalance::execute_rebalance(&env)?;

        // Update last rebalance timestamp
        state.last_rebalance = env.ledger().timestamp();
        env.storage().instance().set(&STATE, &state);

        // Emit rebalance event
        crate::events::emit_rebalance(&env, state.last_rebalance);

        Ok(())
    }

    /// Get the current staking position for the vault
    pub fn get_staking_position(env: Env) -> Result<crate::types::StakingPosition, VaultError> {
        use soroban_sdk::String;
        
        let position_key = String::from_str(&env, "stake_position");
        
        env.storage().instance()
            .get(&position_key)
            .ok_or(VaultError::NotInitialized)
    }

    /// Get the current liquidity position for the vault
    pub fn get_liquidity_position(env: Env) -> Result<crate::types::LiquidityPosition, VaultError> {
        use soroban_sdk::String;
        
        let position_key = String::from_str(&env, "lp_position");
        
        env.storage().instance()
            .get(&position_key)
            .ok_or(VaultError::NotInitialized)
    }

    /// Check if vault has an active staking position
    pub fn has_staking_position(env: Env) -> bool {
        use soroban_sdk::String;
        let position_key = String::from_str(&env, "stake_position");
        env.storage().instance().has(&position_key)
    }

    /// Check if vault has an active liquidity position
    pub fn has_liquidity_position(env: Env) -> bool {
        use soroban_sdk::String;
        let position_key = String::from_str(&env, "lp_position");
        env.storage().instance().has(&position_key)
    }
}
