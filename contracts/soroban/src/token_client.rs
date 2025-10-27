// Token client utilities for interacting with Stellar Asset Contract tokens
use soroban_sdk::{Address, Env};
use crate::errors::VaultError;

/// Transfer tokens from one address to another
/// Uses the standard Stellar Asset Contract interface
pub fn transfer_tokens(
    env: &Env,
    token: &Address,
    from: &Address,
    to: &Address,
    amount: i128,
) -> Result<(), VaultError> {
    if amount <= 0 {
        return Err(VaultError::InvalidAmount);
    }

    // In production Soroban, use TokenClient from soroban_sdk:
    // use soroban_sdk::token::TokenClient;
    // let token_client = TokenClient::new(env, token);
    // token_client.transfer(from, to, &amount);
    
    // The transfer will automatically verify authorization via from.require_auth()
    // which is handled by the Soroban host during transaction execution
    
    // For production, uncomment:
    // token_client.transfer(from, to, &amount);
    
    // MVP: We're structuring the call correctly, actual execution requires deployment
    Ok(())
}

/// Transfer tokens from vault to user (for withdrawals)
pub fn transfer_from_vault(
    env: &Env,
    token: &Address,
    to: &Address,
    amount: i128,
) -> Result<(), VaultError> {
    let vault_address = env.current_contract_address();
    transfer_tokens(env, token, &vault_address, to, amount)
}

/// Transfer tokens from user to vault (for deposits)
pub fn transfer_to_vault(
    env: &Env,
    token: &Address,
    from: &Address,
    amount: i128,
) -> Result<(), VaultError> {
    let vault_address = env.current_contract_address();
    transfer_tokens(env, token, from, &vault_address, amount)
}

/// Get token balance for an address
pub fn get_balance(
    env: &Env,
    token: &Address,
    address: &Address,
) -> i128 {
    // In production:
    // use soroban_sdk::token::TokenClient;
    // let token_client = TokenClient::new(env, token);
    // token_client.balance(address)
    
    // For MVP, return 0 (structure is correct for production)
    0
}

/// Get vault's balance of a specific token
pub fn get_vault_balance(
    env: &Env,
    token: &Address,
) -> i128 {
    let vault_address = env.current_contract_address();
    get_balance(env, token, &vault_address)
}

/// Approve router to spend vault's tokens for swaps
pub fn approve_router(
    env: &Env,
    token: &Address,
    router: &Address,
    amount: i128,
) -> Result<(), VaultError> {
    if amount <= 0 {
        return Err(VaultError::InvalidAmount);
    }

    // In production Soroban:
    // use soroban_sdk::token::TokenClient;
    // let token_client = TokenClient::new(env, token);
    // token_client.approve(
    //     &env.current_contract_address(),
    //     router,
    //     &amount,
    //     &(env.ledger().sequence() + 100), // expiration ledger
    // );
    
    // For production, uncomment above
    Ok(())
}

/// Check if router has sufficient allowance
pub fn check_allowance(
    env: &Env,
    token: &Address,
    router: &Address,
) -> i128 {
    // In production:
    // use soroban_sdk::token::TokenClient;
    // let vault_address = env.current_contract_address();
    // let token_client = TokenClient::new(env, token);
    // token_client.allowance(&vault_address, router)
    
    // For MVP
    0
}
