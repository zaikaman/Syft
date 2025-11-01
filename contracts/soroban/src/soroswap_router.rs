// Soroswap Router interface for actual swap execution
use soroban_sdk::{contractclient, Address, Env, Vec};

/// Soroswap Router interface
/// Based on Uniswap V2 Router interface adapted for Soroban
#[contractclient(name = "SoroswapRouterClient")]
pub trait SoroswapRouterInterface {
    /// Swap exact tokens for tokens along a specified path
    /// Returns the amount of output tokens received
    fn swap_exact_tokens_for_tokens(
        env: Env,
        amount_in: i128,
        amount_out_min: i128,
        path: Vec<Address>,
        to: Address,
        deadline: u64,
    ) -> Vec<i128>;
    
    /// Swap tokens for exact tokens along a specified path
    /// Returns the amounts for each swap in the path
    fn swap_tokens_for_exact_tokens(
        env: Env,
        amount_out: i128,
        amount_in_max: i128,
        path: Vec<Address>,
        to: Address,
        deadline: u64,
    ) -> Vec<i128>;
    
    /// Get amounts out for a given input amount and path
    /// Used for price quotes
    fn get_amounts_out(
        env: Env,
        amount_in: i128,
        path: Vec<Address>,
    ) -> Vec<i128>;
}
