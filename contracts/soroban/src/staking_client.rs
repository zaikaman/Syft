// Liquid Staking Pool interface for Stellar (e.g., stXLM, yXLM)
// This allows users to stake their XLM and receive liquid staking tokens
use soroban_sdk::{contractclient, Address, Env};

/// Liquid Staking Pool interface
/// Compatible with protocols like Lumenswap's stXLM or similar liquid staking
#[contractclient(name = "StakingPoolClient")]
pub trait StakingPoolInterface {
    /// Deposit XLM and receive staking tokens (e.g., stXLM)
    /// Returns the amount of staking tokens minted
    fn deposit(
        env: Env,
        sender: Address,
        amount: i128,
    ) -> i128;
    
    /// Withdraw staking tokens and receive XLM back
    /// Returns the amount of XLM returned
    fn withdraw(
        env: Env,
        sender: Address,
        amount: i128,
    ) -> i128;
    
    /// Get the exchange rate between XLM and staking token
    /// Returns (xlm_amount, st_token_amount) representing the ratio
    fn get_exchange_rate(env: Env) -> (i128, i128);
    
    /// Get total staked amount for an address
    fn get_staked_balance(env: Env, user: Address) -> i128;
}

/// Stake tokens through a liquid staking pool
/// This deposits the token and receives liquid staking tokens in return
pub fn stake_tokens(
    env: &Env,
    pool_address: &Address,
    token: &Address,
    amount: i128,
) -> Result<i128, crate::errors::VaultError> {
    use crate::errors::VaultError;
    
    if amount <= 0 {
        return Err(VaultError::InvalidAmount);
    }

    let pool_client = StakingPoolClient::new(env, pool_address);
    let vault_address = env.current_contract_address();
    
    // First, transfer tokens to the staking pool
    // The pool will hold the tokens and mint staking tokens to us
    crate::token_client::transfer_tokens(
        env,
        token,
        &vault_address,
        pool_address,
        amount,
    )?;
    
    // Call deposit on the staking pool
    // This mints liquid staking tokens (e.g., stXLM) to the vault
    let st_tokens_received = pool_client.deposit(
        &vault_address,
        &amount,
    );
    
    if st_tokens_received <= 0 {
        return Err(VaultError::InvalidAmount);
    }
    
    Ok(st_tokens_received)
}

/// Unstake tokens from a liquid staking pool
/// This burns liquid staking tokens and receives the original tokens back
pub fn unstake_tokens(
    env: &Env,
    pool_address: &Address,
    st_token_amount: i128,
) -> Result<i128, crate::errors::VaultError> {
    use crate::errors::VaultError;
    
    if st_token_amount <= 0 {
        return Err(VaultError::InvalidAmount);
    }

    let pool_client = StakingPoolClient::new(env, pool_address);
    let vault_address = env.current_contract_address();
    
    // Call withdraw on the staking pool
    // This burns our staking tokens and sends XLM back to vault
    let tokens_received = pool_client.withdraw(
        &vault_address,
        &st_token_amount,
    );
    
    if tokens_received <= 0 {
        return Err(VaultError::InvalidAmount);
    }
    
    Ok(tokens_received)
}

/// Get the current staking exchange rate
/// Returns (base_amount, st_token_amount) ratio
pub fn get_staking_rate(
    env: &Env,
    pool_address: &Address,
) -> Result<(i128, i128), crate::errors::VaultError> {
    let pool_client = StakingPoolClient::new(env, pool_address);
    let rate = pool_client.get_exchange_rate();
    Ok(rate)
}

/// Get staked balance for the vault
pub fn get_staked_balance(
    env: &Env,
    pool_address: &Address,
) -> Result<i128, crate::errors::VaultError> {
    let pool_client = StakingPoolClient::new(env, pool_address);
    let vault_address = env.current_contract_address();
    let balance = pool_client.get_staked_balance(&vault_address);
    Ok(balance)
}
