// Swap router interface for integrating with Soroswap/Phoenix DEX
use soroban_sdk::{Address, Env, Vec, BytesN};
use crate::errors::VaultError;
use crate::soroswap_router::SoroswapRouterClient;

/// Interface for Soroswap Aggregator Router
/// Allows swapping tokens through multiple liquidity sources
pub trait SwapRouterInterface {
    /// Execute a chained swap through multiple pools
    /// Returns the amount of output tokens received
    fn swap_chained(
        env: Env,
        user: Address,
        swaps_chain: Vec<(Vec<Address>, BytesN<32>, Address)>,
        token_in: Address,
        amount_in: u128,
        min_amount_out: u128,
    ) -> u128;
}

/// Execute token swap through Soroswap router
pub fn swap_via_router(
    env: &Env,
    router_address: &Address,
    from_token: &Address,
    to_token: &Address,
    amount_in: i128,
    min_amount_out: i128,
) -> Result<i128, VaultError> {
    if amount_in <= 0 {
        return Err(VaultError::InvalidAmount);
    }

    // WORKAROUND: Instead of using the router which has auth issues,
    // we'll swap directly through the liquidity pool
    // This avoids the authorize_as_current_contract problem
    
    // Get the Soroswap factory address from router
    // For testnet Soroswap, the factory is at a known address
    // We'll need to get the pool for this token pair
    
    // For now, try to find the pool by querying common addresses
    // In production, you'd query the factory contract
    let factory_address = get_soroswap_factory_address(env);
    
    // Get the pool address for this token pair
    let pool_address = match crate::pool_client::get_pool_for_pair(
        env,
        &factory_address,
        from_token,
        to_token,
    ) {
        Ok(addr) => addr,
        Err(_) => {
            // If we can't find pool via factory, fall back to router
            // but this will likely fail with auth error
            return swap_via_router_fallback(
                env,
                router_address,
                from_token,
                to_token,
                amount_in,
                min_amount_out,
            );
        }
    };
    
    // Swap directly through the pool
    crate::pool_client::swap_via_pool(
        env,
        &pool_address,
        from_token,
        to_token,
        amount_in,
        min_amount_out,
    )
}

/// Fallback to router-based swap (may have auth issues)
fn swap_via_router_fallback(
    env: &Env,
    router_address: &Address,
    from_token: &Address,
    to_token: &Address,
    amount_in: i128,
    min_amount_out: i128,
) -> Result<i128, VaultError> {
    // Create swap path: direct swap from_token -> to_token
    let mut path: Vec<Address> = Vec::new(env);
    path.push_back(from_token.clone());
    path.push_back(to_token.clone());
    
    // Set deadline to 5 minutes from now
    let deadline = env.ledger().timestamp() + 300;
    
    // Get vault address
    let vault_address = env.current_contract_address();
    
    // Approve the router to spend from_token
    crate::token_client::approve_router(
        env,
        from_token,
        router_address,
        amount_in,
    )?;
    
    // CRITICAL: Authorize sub-contract calls
    env.authorize_as_current_contract(soroban_sdk::vec![env]);
    
    // Execute swap through Soroswap router
    let router_client = SoroswapRouterClient::new(env, router_address);
    
    // Call swap_exact_tokens_for_tokens
    let amounts = router_client.swap_exact_tokens_for_tokens(
        &amount_in,
        &min_amount_out,
        &path,
        &vault_address,
        &deadline,
    );
    
    // Get the output amount (last element in the amounts array)
    let amount_out = amounts.get(amounts.len() - 1)
        .ok_or(VaultError::InvalidAmount)?;
    
    // Verify we got at least the minimum
    if amount_out < min_amount_out {
        return Err(VaultError::SlippageTooHigh);
    }

    Ok(amount_out)
}

/// Get Soroswap factory address for the network
fn get_soroswap_factory_address(env: &Env) -> Address {
    // Get the factory address from the router address by using a known mapping
    // For Soroswap testnet: CDJTMBYKNUGINFQALHDMPLZYNGUV42GPN4B7QOYTWHRC4EE5IYJM6AES
    //
    // WORKAROUND: Since we can't easily create Address from bytes at runtime,
    // we'll use Address::from_string with the String type from soroban_sdk
    
    use soroban_sdk::String;
    
    let factory_str = String::from_str(env, "CDJTMBYKNUGINFQALHDMPLZYNGUV42GPN4B7QOYTWHRC4EE5IYJM6AES");
    Address::from_string(&factory_str)
}

/// Find optimal swap route between two tokens
/// In production, this queries available pools and calculates best route
pub fn find_optimal_route(
    env: &Env,
    router_address: &Address,
    from_token: &Address,
    to_token: &Address,
    amount_in: i128,
) -> Result<Vec<(Vec<Address>, BytesN<32>, Address)>, VaultError> {
    // In production, this would:
    // 1. Query all available pools from Soroswap/Phoenix
    // 2. Build a graph of possible routes
    // 3. Calculate expected output for each route considering fees and slippage
    // 4. Return the route with best price
    
    // For MVP, return simple direct route
    let mut swaps_chain: Vec<(Vec<Address>, BytesN<32>, Address)> = Vec::new(env);
    
    let mut token_pair: Vec<Address> = Vec::new(env);
    token_pair.push_back(from_token.clone());
    token_pair.push_back(to_token.clone());
    
    // In production, query actual pool address
    let pool_id = BytesN::from_array(env, &[0u8; 32]);
    
    let hop = (token_pair, pool_id, to_token.clone());
    swaps_chain.push_back(hop);

    Ok(swaps_chain)
}

/// Get quote for swap without executing
pub fn get_swap_quote(
    env: &Env,
    router_address: &Address,
    from_token: &Address,
    to_token: &Address,
    amount_in: i128,
) -> Result<i128, VaultError> {
    if amount_in <= 0 {
        return Err(VaultError::InvalidAmount);
    }

    // Create swap path
    let mut path: Vec<Address> = Vec::new(env);
    path.push_back(from_token.clone());
    path.push_back(to_token.clone());
    
    // Get quote from router
    let router_client = SoroswapRouterClient::new(env, router_address);
    let amounts = router_client.get_amounts_out(&amount_in, &path);
    
    // Get the output amount (last element)
    let amount_out = amounts.get(amounts.len() - 1)
        .ok_or(VaultError::InvalidAmount)?;
    
    Ok(amount_out)
}
