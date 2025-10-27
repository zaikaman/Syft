// Rule evaluation engine
use soroban_sdk::{Env, String, symbol_short, Symbol, Vec};
use crate::types::RebalanceRule;

const STATE: Symbol = symbol_short!("STATE");

/// Evaluate all rebalancing rules and return true if any should trigger
pub fn evaluate_rules(env: &Env, rules: &Vec<RebalanceRule>) -> bool {
    for i in 0..rules.len() {
        if let Some(rule) = rules.get(i) {
            if evaluate_single_rule(env, &rule) {
                return true;
            }
        }
    }
    false
}

/// Evaluate a single rule based on its condition type
fn evaluate_single_rule(env: &Env, rule: &RebalanceRule) -> bool {
    let condition_type = rule.condition_type.clone();
    
    // Time-based condition: Check if enough time has passed since last rebalance
    if condition_type.to_string().contains("time") {
        return evaluate_time_condition(env, rule);
    }
    
    // APY threshold condition: Check if APY meets threshold
    if condition_type.to_string().contains("apy") {
        return evaluate_apy_condition(env, rule);
    }
    
    // Allocation percentage condition: Check if allocation drifted
    if condition_type.to_string().contains("allocation") {
        return evaluate_allocation_condition(env, rule);
    }
    
    // Price-based condition: Check price movements
    if condition_type.to_string().contains("price") {
        return evaluate_price_condition(env, rule);
    }
    
    false
}

/// Evaluate time-based rebalancing condition
fn evaluate_time_condition(env: &Env, rule: &RebalanceRule) -> bool {
    let state: crate::types::VaultState = env.storage().instance()
        .get(&STATE)
        .unwrap_or(crate::types::VaultState {
            total_shares: 0,
            total_value: 0,
            last_rebalance: 0,
        });
    
    let current_time = env.ledger().timestamp();
    let time_elapsed = current_time.saturating_sub(state.last_rebalance);
    
    // threshold is in seconds
    time_elapsed >= rule.threshold as u64
}

/// Evaluate APY threshold condition
fn evaluate_apy_condition(env: &Env, rule: &RebalanceRule) -> bool {
    // In MVP, we'll use a simplified APY calculation
    // In production, this would fetch real-time APY data from liquidity pools
    
    // For now, return true if threshold is reasonable (mock implementation)
    // This will be enhanced with real Stellar AMM data integration
    rule.threshold > 0 && rule.threshold < 100_0000 // APY between 0-100%
}

/// Evaluate allocation drift condition
fn evaluate_allocation_condition(env: &Env, rule: &RebalanceRule) -> bool {
    // Check if current allocation drifted from target
    // In MVP, simplified logic - will be enhanced with real asset balance tracking
    
    let state: crate::types::VaultState = env.storage().instance()
        .get(&STATE)
        .unwrap_or(crate::types::VaultState {
            total_shares: 0,
            total_value: 0,
            last_rebalance: 0,
        });
    
    // If vault has value, check if rebalance is needed
    // threshold represents max drift percentage (e.g., 5%)
    state.total_value > 0
}

/// Evaluate price-based condition
fn evaluate_price_condition(env: &Env, rule: &RebalanceRule) -> bool {
    // Price movement detection
    // In MVP, simplified - will be enhanced with Stellar price oracle integration
    
    // For now, use threshold as price change percentage
    rule.threshold > 0
}

/// Check if any rule should trigger rebalancing
pub fn should_rebalance(env: &Env) -> bool {
    let config: Result<crate::types::VaultConfig, crate::errors::VaultError> = 
        env.storage().instance().get(&symbol_short!("CONFIG"))
        .ok_or(crate::errors::VaultError::NotInitialized);
    
    match config {
        Ok(cfg) => evaluate_rules(env, &cfg.rules),
        Err(_) => false,
    }
}
