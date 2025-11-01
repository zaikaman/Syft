// Direct liquidity pool interface for token swaps
// This bypasses the router and interacts directly with liquidity pools
use soroban_sdk::{contractclient, Address, Env};

/// Soroswap Liquidity Pool interface
/// Based on Uniswap V2 Pair interface
#[contractclient(name = "LiquidityPoolClient")]
pub trait LiquidityPoolInterface {
    /// Swap tokens directly through the pool
    /// amount0Out or amount1Out should be 0 (only one can be non-zero)
    fn swap(
        env: Env,
        amount0_out: i128,
        amount1_out: i128,
        to: Address,
    );
    
    /// Get reserves of the two tokens in the pool
    /// Returns (reserve0, reserve1)
    /// Note: Soroswap returns just two values, not three like Uniswap V2
    fn get_reserves(env: Env) -> (i128, i128);
    
    /// Get token0 address
    fn token_0(env: Env) -> Address;
    
    /// Get token1 address
    fn token_1(env: Env) -> Address;
}

/// Execute a direct swap through a liquidity pool
/// This transfers tokens to the pool first, then calls swap
pub fn swap_via_pool(
    env: &Env,
    pool_address: &Address,
    from_token: &Address,
    to_token: &Address,
    amount_in: i128,
    min_amount_out: i128,
) -> Result<i128, crate::errors::VaultError> {
    use crate::errors::VaultError;
    
    if amount_in <= 0 {
        return Err(VaultError::InvalidAmount);
    }

    let pool_client = LiquidityPoolClient::new(env, pool_address);
    let vault_address = env.current_contract_address();
    
    // Get pool token addresses to determine which is token0 and token1
    let token0 = pool_client.token_0();
    let token1 = pool_client.token_1();
    
    // Determine which token we're swapping from/to
    let (is_token0_in, is_token0_out) = if from_token == &token0 {
        (true, false)
    } else if from_token == &token1 {
        (false, true)
    } else {
        return Err(VaultError::InvalidConfiguration);
    };
    
    // Get current reserves to calculate output
    let (reserve0, reserve1) = pool_client.get_reserves();
    
    // Calculate output amount using constant product formula (x * y = k)
    // With 0.3% fee: amount_out = (amount_in * 997 * reserve_out) / (reserve_in * 1000 + amount_in * 997)
    let (reserve_in, reserve_out) = if is_token0_in {
        (reserve0, reserve1)
    } else {
        (reserve1, reserve0)
    };
    
    let amount_in_with_fee = amount_in
        .checked_mul(997)
        .ok_or(VaultError::InvalidAmount)?;
    
    let numerator = amount_in_with_fee
        .checked_mul(reserve_out)
        .ok_or(VaultError::InvalidAmount)?;
    
    let denominator = reserve_in
        .checked_mul(1000)
        .and_then(|v| v.checked_add(amount_in_with_fee))
        .ok_or(VaultError::InvalidAmount)?;
    
    let amount_out = numerator / denominator;
    
    // Verify we get at least the minimum
    if amount_out < min_amount_out {
        return Err(VaultError::SlippageTooHigh);
    }
    
    // Transfer tokens to the pool
    // This is the key difference from router - we transfer directly to pool
    crate::token_client::transfer_tokens(
        env,
        from_token,
        &vault_address,
        pool_address,
        amount_in,
    )?;
    
    // Determine output amounts for swap call
    let (amount0_out, amount1_out) = if is_token0_in {
        (0, amount_out)  // Swapping token0 -> token1
    } else {
        (amount_out, 0)  // Swapping token1 -> token0
    };
    
    // Authorize the swap operation as the current contract
    // This is needed for the pool to send tokens back to us
    env.authorize_as_current_contract(soroban_sdk::vec![env]);
    
    // Call swap on the pool to get our tokens back to vault
    pool_client.swap(
        &amount0_out,
        &amount1_out,
        &vault_address,
    );
    
    Ok(amount_out)
}

/// Calculate expected output for a swap without executing it
/// This uses the same constant product formula as the actual swap
pub fn calculate_swap_output(
    env: &Env,
    pool_address: &Address,
    from_token: &Address,
    to_token: &Address,
    amount_in: i128,
) -> Result<i128, crate::errors::VaultError> {
    use crate::errors::VaultError;
    
    if amount_in <= 0 {
        return Err(VaultError::InvalidAmount);
    }

    let pool_client = LiquidityPoolClient::new(env, pool_address);
    
    // Get pool token addresses to determine which is token0 and token1
    let token0 = pool_client.token_0();
    let token1 = pool_client.token_1();
    
    // Determine which token we're swapping from
    let is_token0_in = if from_token == &token0 {
        true
    } else if from_token == &token1 {
        false
    } else {
        return Err(VaultError::InvalidConfiguration);
    };
    
    // Get current reserves
    let (reserve0, reserve1) = pool_client.get_reserves();
    
    // Calculate output amount using constant product formula
    let (reserve_in, reserve_out) = if is_token0_in {
        (reserve0, reserve1)
    } else {
        (reserve1, reserve0)
    };
    
    let amount_in_with_fee = amount_in
        .checked_mul(997)
        .ok_or(VaultError::InvalidAmount)?;
    
    let numerator = amount_in_with_fee
        .checked_mul(reserve_out)
        .ok_or(VaultError::InvalidAmount)?;
    
    let denominator = reserve_in
        .checked_mul(1000)
        .and_then(|v| v.checked_add(amount_in_with_fee))
        .ok_or(VaultError::InvalidAmount)?;
    
    let amount_out = numerator / denominator;
    
    Ok(amount_out)
}

/// Calculate required input for a desired output from a swap
/// This uses the constant product formula solved for amount_in
pub fn calculate_swap_input(
    env: &Env,
    pool_address: &Address,
    from_token: &Address,
    to_token: &Address,
    amount_out_desired: i128,
) -> Result<i128, crate::errors::VaultError> {
    use crate::errors::VaultError;
    
    if amount_out_desired <= 0 {
        return Err(VaultError::InvalidAmount);
    }

    let pool_client = LiquidityPoolClient::new(env, pool_address);
    
    // Get pool token addresses to determine which is token0 and token1
    let token0 = pool_client.token_0();
    let token1 = pool_client.token_1();
    
    // Determine which token we're swapping from
    let is_token0_in = if from_token == &token0 {
        true
    } else if from_token == &token1 {
        false
    } else {
        return Err(VaultError::InvalidConfiguration);
    };
    
    // Get current reserves
    let (reserve0, reserve1) = pool_client.get_reserves();
    
    // Calculate input amount using constant product formula (solved for amount_in)
    // Formula: amount_in = (reserve_in * amount_out * 1000) / ((reserve_out - amount_out) * 997) + 1
    let (reserve_in, reserve_out) = if is_token0_in {
        (reserve0, reserve1)
    } else {
        (reserve1, reserve0)
    };
    
    // Make sure we're not trying to drain the pool
    if amount_out_desired >= reserve_out {
        return Err(VaultError::InvalidAmount);
    }
    
    let numerator = reserve_in
        .checked_mul(amount_out_desired)
        .and_then(|v| v.checked_mul(1000))
        .ok_or(VaultError::InvalidAmount)?;
    
    let denominator = reserve_out
        .checked_sub(amount_out_desired)
        .and_then(|v| v.checked_mul(997))
        .ok_or(VaultError::InvalidAmount)?;
    
    let amount_in = (numerator / denominator)
        .checked_add(1) // Add 1 for rounding
        .ok_or(VaultError::InvalidAmount)?;
    
    Ok(amount_in)
}

/// Find the liquidity pool address for a token pair
/// This queries the Soroswap factory to get the pool address
pub fn get_pool_for_pair(
    env: &Env,
    factory_address: &Address,
    token_a: &Address,
    token_b: &Address,
) -> Result<Address, crate::errors::VaultError> {
    use crate::errors::VaultError;
    use soroban_sdk::contractclient;
    
    // Soroswap Factory interface
    #[contractclient(name = "FactoryClient")]
    pub trait FactoryInterface {
        fn get_pair(env: Env, token_a: Address, token_b: Address) -> Address;
    }
    
    let factory_client = FactoryClient::new(env, factory_address);
    let pool_address = factory_client.get_pair(&token_a.clone(), &token_b.clone());
    
    // Verify pool exists (not zero address)
    // In Soroban, we'd check if the address is valid
    // For now, just return it
    Ok(pool_address)
}
