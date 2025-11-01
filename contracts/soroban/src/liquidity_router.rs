// Soroswap Router interface for liquidity provision
// This handles adding and removing liquidity from AMM pools
use soroban_sdk::{contractclient, Address, Env, Vec};

/// Soroswap Router Liquidity interface
/// Based on Uniswap V2 Router liquidity functions
#[contractclient(name = "LiquidityRouterClient")]
pub trait LiquidityRouterInterface {
    /// Add liquidity to a token pair pool
    /// Returns (liquidity_tokens, amount_a_used, amount_b_used)
    fn add_liquidity(
        env: Env,
        token_a: Address,
        token_b: Address,
        amount_a_desired: i128,
        amount_b_desired: i128,
        amount_a_min: i128,
        amount_b_min: i128,
        to: Address,
        deadline: u64,
    ) -> (i128, i128, i128);
    
    /// Remove liquidity from a token pair pool
    /// Returns (amount_a, amount_b)
    fn remove_liquidity(
        env: Env,
        token_a: Address,
        token_b: Address,
        liquidity: i128,
        amount_a_min: i128,
        amount_b_min: i128,
        to: Address,
        deadline: u64,
    ) -> (i128, i128);
    
    /// Get optimal amounts for adding liquidity
    /// Returns optimal amount_b for given amount_a
    fn quote(
        env: Env,
        amount_a: i128,
        reserve_a: i128,
        reserve_b: i128,
    ) -> i128;
}

/// Add liquidity to a Soroswap pool
/// This adds both tokens to the pool and receives LP tokens
pub fn add_liquidity_to_pool(
    env: &Env,
    router_address: &Address,
    token_a: &Address,
    token_b: &Address,
    amount_a: i128,
    amount_b: i128,
    slippage_percent: i128, // e.g., 5 for 5% slippage
) -> Result<(i128, i128, i128), crate::errors::VaultError> {
    use crate::errors::VaultError;
    
    if amount_a <= 0 || amount_b <= 0 {
        return Err(VaultError::InvalidAmount);
    }
    
    if slippage_percent < 0 || slippage_percent > 100 {
        return Err(VaultError::InvalidConfiguration);
    }

    let router_client = LiquidityRouterClient::new(env, router_address);
    let vault_address = env.current_contract_address();
    
    // Calculate minimum amounts based on slippage tolerance
    let amount_a_min = amount_a
        .checked_mul(100 - slippage_percent)
        .and_then(|v| v.checked_div(100))
        .ok_or(VaultError::InvalidAmount)?;
    
    let amount_b_min = amount_b
        .checked_mul(100 - slippage_percent)
        .and_then(|v| v.checked_div(100))
        .ok_or(VaultError::InvalidAmount)?;
    
    // Approve router to spend our tokens
    crate::token_client::approve_router(env, token_a, router_address, amount_a)?;
    crate::token_client::approve_router(env, token_b, router_address, amount_b)?;
    
    // Set deadline to 1 hour from now
    let deadline = env.ledger().timestamp() + 3600;
    
    // Add liquidity through router
    let (lp_tokens, actual_a, actual_b) = router_client.add_liquidity(
        &token_a,
        &token_b,
        &amount_a,
        &amount_b,
        &amount_a_min,
        &amount_b_min,
        &vault_address,
        &deadline,
    );
    
    if lp_tokens <= 0 {
        return Err(VaultError::InvalidAmount);
    }
    
    Ok((lp_tokens, actual_a, actual_b))
}

/// Remove liquidity from a Soroswap pool
/// This burns LP tokens and receives both tokens back
pub fn remove_liquidity_from_pool(
    env: &Env,
    router_address: &Address,
    token_a: &Address,
    token_b: &Address,
    lp_tokens: i128,
    slippage_percent: i128,
) -> Result<(i128, i128), crate::errors::VaultError> {
    use crate::errors::VaultError;
    
    if lp_tokens <= 0 {
        return Err(VaultError::InvalidAmount);
    }
    
    if slippage_percent < 0 || slippage_percent > 100 {
        return Err(VaultError::InvalidConfiguration);
    }

    let router_client = LiquidityRouterClient::new(env, router_address);
    let vault_address = env.current_contract_address();
    
    // Get current pool reserves to estimate minimum amounts
    // We'll set minimums to 0 for simplicity, or calculate based on reserves
    let amount_a_min = 0;
    let amount_b_min = 0;
    
    // Set deadline to 1 hour from now
    let deadline = env.ledger().timestamp() + 3600;
    
    // Remove liquidity through router
    let (amount_a, amount_b) = router_client.remove_liquidity(
        &token_a,
        &token_b,
        &lp_tokens,
        &amount_a_min,
        &amount_b_min,
        &vault_address,
        &deadline,
    );
    
    if amount_a <= 0 || amount_b <= 0 {
        return Err(VaultError::InvalidAmount);
    }
    
    Ok((amount_a, amount_b))
}

/// Get optimal amount_b for adding liquidity with amount_a
/// This helps maintain the correct ratio when adding liquidity
pub fn get_optimal_liquidity_amounts(
    env: &Env,
    router_address: &Address,
    amount_a: i128,
    reserve_a: i128,
    reserve_b: i128,
) -> Result<i128, crate::errors::VaultError> {
    use crate::errors::VaultError;
    
    if amount_a <= 0 || reserve_a <= 0 || reserve_b <= 0 {
        return Err(VaultError::InvalidAmount);
    }

    let router_client = LiquidityRouterClient::new(env, router_address);
    
    let amount_b = router_client.quote(
        &amount_a,
        &reserve_a,
        &reserve_b,
    );
    
    Ok(amount_b)
}
