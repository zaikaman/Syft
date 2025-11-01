// Vault data structures and types
use soroban_sdk::{contracttype, Address, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultConfig {
    pub owner: Address,
    pub name: String,
    pub assets: Vec<Address>,
    pub rules: Vec<RebalanceRule>,
    pub router_address: Option<Address>, // Soroswap/Phoenix router for swaps
    pub staking_pool_address: Option<Address>, // Liquid staking pool (e.g., stXLM)
    pub factory_address: Option<Address>, // Soroswap factory for finding pools
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultState {
    pub total_shares: i128,
    pub total_value: i128,
    pub last_rebalance: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RebalanceRule {
    pub condition_type: String,
    pub threshold: i128,
    pub action: String,
    pub target_allocation: Vec<i128>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserPosition {
    pub shares: i128,
    pub last_deposit: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssetBalance {
    pub token: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StakingPosition {
    pub staking_pool: Address,
    pub original_token: Address,  // e.g., XLM
    pub staked_amount: i128,      // Original amount staked
    pub st_token_amount: i128,    // Liquid staking tokens received (e.g., stXLM)
    pub timestamp: u64,           // When staked
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LiquidityPosition {
    pub pool_address: Address,
    pub token_a: Address,
    pub token_b: Address,
    pub lp_tokens: i128,          // LP tokens received
    pub amount_a_provided: i128,  // Original amount of token A
    pub amount_b_provided: i128,  // Original amount of token B
    pub timestamp: u64,           // When liquidity was provided
}
