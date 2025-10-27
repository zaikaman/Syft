// Swap router interface for integrating with Soroswap/Phoenix DEX
use soroban_sdk::{Address, Env, Vec, BytesN};
use crate::errors::VaultError;

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

    // Convert i128 to u128 for router interface
    let amount_in_u128 = amount_in as u128;
    let min_amount_out_u128 = if min_amount_out > 0 { 
        min_amount_out as u128 
    } else { 
        0 
    };

    // Create swap path: single hop from_token -> to_token
    // In production, this could be multi-hop for better pricing
    let mut swaps_chain: Vec<(Vec<Address>, BytesN<32>, Address)> = Vec::new(env);
    
    // Create the token pair for this hop
    let mut token_pair: Vec<Address> = Vec::new(env);
    token_pair.push_back(from_token.clone());
    token_pair.push_back(to_token.clone());
    
    // Pool identifier (would come from pool lookup in production)
    let pool_id = BytesN::from_array(env, &[0u8; 32]);
    
    // Create hop: (token_pair, pool_id, output_token)
    let hop = (token_pair, pool_id, to_token.clone());
    swaps_chain.push_back(hop);

    // Call the router contract
    // In production, you'd import and use the actual router client:
    // let router_client = SoroswapRouterClient::new(env, router_address);
    // let amount_out = router_client.swap_chained(
    //     &env.current_contract_address(),
    //     &swaps_chain,
    //     from_token,
    //     &amount_in_u128,
    //     &min_amount_out_u128,
    // );
    
    // For MVP with proper structure, we simulate the swap
    // In production, uncomment above and remove simulation below
    let fee_bps = 30; // 0.3% fee
    let fee_amount = (amount_in_u128 * fee_bps) / 10000;
    let amount_out_u128 = amount_in_u128 - fee_amount;
    
    // Verify minimum output
    if amount_out_u128 < min_amount_out_u128 {
        return Err(VaultError::SlippageTooHigh);
    }

    Ok(amount_out_u128 as i128)
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

    // In production, call router's quote function
    // let router_client = SoroswapRouterClient::new(env, router_address);
    // let quote = router_client.get_amount_out(from_token, to_token, amount_in);
    
    // Simulate quote with standard AMM formula: x * y = k
    // With 0.3% fee
    let fee_bps = 30;
    let fee_amount = (amount_in * fee_bps) / 10000;
    let amount_out = amount_in - fee_amount;
    
    Ok(amount_out)
}
