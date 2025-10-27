// Vault data structures and types
use soroban_sdk::{contracttype, Address, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultConfig {
    pub owner: Address,
    pub name: String,
    pub assets: Vec<Address>,
    pub rules: Vec<RebalanceRule>,
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
