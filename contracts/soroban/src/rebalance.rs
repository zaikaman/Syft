// Rebalancing execution logic
use soroban_sdk::{Env, Address, symbol_short, Symbol, Vec, String};
use crate::errors::VaultError;

const CONFIG: Symbol = symbol_short!("CONFIG");
const STATE: Symbol = symbol_short!("STATE");

/// Execute rebalancing of vault assets according to rules
pub fn execute_rebalance(env: &Env) -> Result<(), VaultError> {
    use soroban_sdk::symbol_short;
    
    // Get vault configuration
    let config: crate::types::VaultConfig = env.storage().instance()
        .get(&CONFIG)
        .ok_or(VaultError::NotInitialized)?;
    
    let state: crate::types::VaultState = env.storage().instance()
        .get(&STATE)
        .ok_or(VaultError::NotInitialized)?;
    
    // Log rebalance start
    env.events().publish(
        (symbol_short!("reb_start"),),
        state.total_value
    );
    
    // Ensure vault has assets to rebalance
    if state.total_value == 0 {
        return Err(VaultError::InsufficientBalance);
    }
    
    // Execute rebalancing for each rule
    for i in 0..config.rules.len() {
        if let Some(rule) = config.rules.get(i) {
            execute_rule_action(env, &rule, &config.assets, state.total_value)?;
        }
    }
    
    Ok(())
}

/// Execute only rebalance actions (excludes stake and liquidity)
pub fn execute_rebalance_only(env: &Env) -> Result<(), VaultError> {
    use soroban_sdk::symbol_short;
    
    let config: crate::types::VaultConfig = env.storage().instance()
        .get(&CONFIG)
        .ok_or(VaultError::NotInitialized)?;
    
    let state: crate::types::VaultState = env.storage().instance()
        .get(&STATE)
        .ok_or(VaultError::NotInitialized)?;
    
    env.events().publish(
        (symbol_short!("reb_start"),),
        state.total_value
    );
    
    if state.total_value == 0 {
        return Err(VaultError::InsufficientBalance);
    }
    
    // Execute only rebalance rules
    for i in 0..config.rules.len() {
        if let Some(rule) = config.rules.get(i) {
            if rule.action == String::from_str(env, "rebalance") {
                execute_rebalance_action(env, &rule, &config.assets, state.total_value)?;
            }
        }
    }
    
    Ok(())
}

/// Execute only stake actions (excludes rebalance and liquidity)
pub fn execute_stake_only(env: &Env) -> Result<(), VaultError> {
    use soroban_sdk::symbol_short;
    
    let config: crate::types::VaultConfig = env.storage().instance()
        .get(&CONFIG)
        .ok_or(VaultError::NotInitialized)?;
    
    let state: crate::types::VaultState = env.storage().instance()
        .get(&STATE)
        .ok_or(VaultError::NotInitialized)?;
    
    env.events().publish(
        (symbol_short!("stk_start"),),
        state.total_value
    );
    
    if state.total_value == 0 {
        return Err(VaultError::InsufficientBalance);
    }
    
    // Execute only stake rules
    for i in 0..config.rules.len() {
        if let Some(rule) = config.rules.get(i) {
            if rule.action == String::from_str(env, "stake") {
                execute_stake_action(env, &rule, &config.assets, state.total_value)?;
            }
        }
    }
    
    Ok(())
}

/// Execute only liquidity actions (excludes rebalance and stake)
pub fn execute_liquidity_only(env: &Env) -> Result<(), VaultError> {
    use soroban_sdk::symbol_short;
    
    let config: crate::types::VaultConfig = env.storage().instance()
        .get(&CONFIG)
        .ok_or(VaultError::NotInitialized)?;
    
    let state: crate::types::VaultState = env.storage().instance()
        .get(&STATE)
        .ok_or(VaultError::NotInitialized)?;
    
    env.events().publish(
        (symbol_short!("liq_start"),),
        state.total_value
    );
    
    if state.total_value == 0 {
        return Err(VaultError::InsufficientBalance);
    }
    
    // Execute only liquidity rules
    for i in 0..config.rules.len() {
        if let Some(rule) = config.rules.get(i) {
            if rule.action == String::from_str(env, "liquidity") {
                execute_liquidity_action(env, &rule, &config.assets, state.total_value)?;
            }
        }
    }
    
    Ok(())
}

/// Execute the action specified in a rebalancing rule
fn execute_rule_action(
    env: &Env, 
    rule: &crate::types::RebalanceRule,
    assets: &Vec<Address>,
    total_value: i128
) -> Result<(), VaultError> {
    use soroban_sdk::String;
    
    // Log the action we're executing
    env.events().publish(
        (symbol_short!("exec_act"),),
        rule.action.clone()
    );
    
    // Rebalance action: Adjust asset allocations to target percentages
    if rule.action == String::from_str(env, "rebalance") {
        return execute_rebalance_action(env, rule, assets, total_value);
    }
    
    // Stake action: Move assets to staking
    if rule.action == String::from_str(env, "stake") {
        return execute_stake_action(env, rule, assets, total_value);
    }
    
    // Provide liquidity action: Add assets to AMM pools
    if rule.action == String::from_str(env, "liquidity") {
        return execute_liquidity_action(env, rule, assets, total_value);
    }
    
    // Log if no action matched
    env.events().publish(
        (symbol_short!("no_match"),),
        rule.action.clone()
    );
    
    Ok(())
}

/// Execute rebalancing to target allocation percentages
fn execute_rebalance_action(
    env: &Env,
    rule: &crate::types::RebalanceRule,
    assets: &Vec<Address>,
    total_value: i128
) -> Result<(), VaultError> {
    // Validate target allocation matches number of assets
    if rule.target_allocation.len() != assets.len() {
        return Err(VaultError::InvalidConfiguration);
    }
    
    // Validate allocations sum to 100% (represented as 100_0000 for 2 decimal precision)
    let mut total_allocation: i128 = 0;
    for i in 0..rule.target_allocation.len() {
        if let Some(alloc) = rule.target_allocation.get(i) {
            total_allocation = total_allocation.checked_add(alloc)
                .ok_or(VaultError::InvalidConfiguration)?;
        }
    }
    
    // Allow 100% allocation (100_0000 in our precision)
    if total_allocation != 100_0000 && total_allocation != 0 {
        return Err(VaultError::InvalidConfiguration);
    }

    // Get router address from config
    let config: crate::types::VaultConfig = env.storage().instance()
        .get(&CONFIG)
        .ok_or(VaultError::NotInitialized)?;
    
    let router_address = config.router_address
        .ok_or(VaultError::InvalidConfiguration)?;
    
    // Calculate current balances and target amounts
    let mut current_balances: Vec<i128> = Vec::new(env);
    let mut target_amounts: Vec<i128> = Vec::new(env);
    
    for i in 0..assets.len() {
        if let (Some(asset), Some(target_pct)) = (assets.get(i), rule.target_allocation.get(i)) {
            // Get current balance of this asset in vault
            let current_balance = crate::token_client::get_vault_balance(env, &asset);
            current_balances.push_back(current_balance);
            
            // Calculate target amount
            let target_amount = total_value
                .checked_mul(target_pct)
                .and_then(|v| v.checked_div(100_0000))
                .ok_or(VaultError::InvalidAmount)?;
            
            target_amounts.push_back(target_amount);
        }
    }
    
    // Check if rebalancing is actually needed (tolerance: 1% of total value)
    let tolerance = total_value / 100; // 1% tolerance
    let mut needs_rebalance = false;
    
    for i in 0..assets.len() {
        if let (Some(current), Some(target)) = (
            current_balances.get(i),
            target_amounts.get(i)
        ) {
            let diff = if current > target {
                current - target
            } else {
                target - current
            };
            
            // If any asset is off by more than tolerance, we need to rebalance
            if diff > tolerance {
                needs_rebalance = true;
                break;
            }
        }
    }
    
    // Skip rebalancing if already at target allocation
    if !needs_rebalance {
        // Log that rebalance was skipped
        env.events().publish(
            (symbol_short!("reb_skip"),),
            tolerance
        );
        // No error, just skip - allocation is already correct
        return Ok(());
    }
    
    // Log that we're proceeding with swaps
    env.events().publish(
        (symbol_short!("reb_exec"),),
        true
    );
    
    // Execute swaps to reach target allocation
    for i in 0..assets.len() {
        if let (Some(asset), Some(current), Some(target)) = (
            assets.get(i),
            current_balances.get(i),
            target_amounts.get(i)
        ) {
            let diff = target - current;
            
            // Skip if this asset is already close to target
            if diff.abs() <= tolerance {
                continue;
            }
            
            if diff > 0 {
                // Need to buy more of this asset
                // Log what we're trying to buy
                env.events().publish(
                    (symbol_short!("need_buy"),),
                    (asset.clone(), diff)
                );
                
                // Find an asset we have excess of to sell
                for j in 0..assets.len() {
                    if i == j {
                        continue;
                    }
                    
                    if let (Some(source_asset), Some(source_current), Some(source_target)) = (
                        assets.get(j),
                        current_balances.get(j),
                        target_amounts.get(j)
                    ) {
                        // Log what we're checking
                        env.events().publish(
                            (symbol_short!("check_src"),),
                            (source_asset.clone(), source_current, source_target)
                        );
                        
                        if source_current > source_target {
                            // This asset has excess, use it as source
                            let excess = source_current - source_target;
                            let amount_to_swap = if diff < excess { diff } else { excess };
                            
                            env.events().publish(
                                (symbol_short!("calc_swap"),),
                                (excess, amount_to_swap)
                            );
                            
                            // Skip if amount is negligible
                            if amount_to_swap <= 0 {
                                env.events().publish(
                                    (symbol_short!("skip_amt"),),
                                    amount_to_swap
                                );
                                continue;
                            }
                            
                            // Get the factory address to find the pool
                            let factory_address = crate::swap_router::get_soroswap_factory_address_internal(env);
                            
                            // Get the pool for this token pair
                            let pool_address = match crate::pool_client::get_pool_for_pair(
                                env,
                                &factory_address,
                                &source_asset,
                                &asset,
                            ) {
                                Ok(addr) => addr,
                                Err(e) => {
                                    env.events().publish(
                                        (symbol_short!("pool_err"),),
                                        symbol_short!("notfound")
                                    );
                                    return Err(e);
                                }
                            };
                            
                            // Calculate expected output directly from pool reserves
                            let expected_output = match crate::pool_client::calculate_swap_output(
                                env,
                                &pool_address,
                                &source_asset,
                                &asset,
                                amount_to_swap,
                            ) {
                                Ok(amt) => amt,
                                Err(e) => {
                                    env.events().publish(
                                        (symbol_short!("calc_err"),),
                                        symbol_short!("failed")
                                    );
                                    return Err(e);
                                }
                            };
                            
                            // Calculate minimum output with 5% slippage tolerance
                            // Use the expected output from pool calculation, not the target diff
                            let min_amount_out = (expected_output * 95) / 100;
                            
                            // Log swap attempt with expected and minimum outputs
                            env.events().publish(
                                (symbol_short!("swap_try"),),
                                (source_asset.clone(), asset.clone(), amount_to_swap)
                            );
                            
                            env.events().publish(
                                (symbol_short!("swap_calc"),),
                                (expected_output, min_amount_out)
                            );
                            
                            // Approve router to spend our tokens
                            crate::token_client::approve_router(
                                env,
                                &source_asset,
                                &router_address,
                                amount_to_swap,
                            )?;
                            
                            env.events().publish(
                                (symbol_short!("approved"),),
                                amount_to_swap
                            );
                            
                            // Execute swap through router
                            // Note: If this fails, the entire transaction will fail
                            let amount_out = match crate::swap_router::swap_via_router(
                                env,
                                &router_address,
                                &source_asset,
                                &asset,
                                amount_to_swap,
                                min_amount_out,
                            ) {
                                Ok(amt) => {
                                    env.events().publish(
                                        (symbol_short!("swapped"),),
                                        amt
                                    );
                                    amt
                                },
                                Err(e) => {
                                    // Log the error and propagate it
                                    env.events().publish(
                                        (symbol_short!("swap_err"),),
                                        symbol_short!("failed")
                                    );
                                    return Err(e);
                                }
                            };
                            
                            // Update balances after swap
                            current_balances.set(j, source_current - amount_to_swap);
                            current_balances.set(i, current + amount_out);
                            
                            break;
                        }
                    }
                }
            }
        }
    }
    
    Ok(())
}

/// Execute staking action
fn execute_stake_action(
    env: &Env,
    rule: &crate::types::RebalanceRule,
    assets: &Vec<Address>,
    total_value: i128
) -> Result<(), VaultError> {
    // Validate at least one asset to stake
    if assets.is_empty() {
        return Err(VaultError::InvalidConfiguration);
    }
    
    // Calculate staking amount based on threshold
    let stake_amount = total_value
        .checked_mul(rule.threshold)
        .and_then(|v| v.checked_div(100_0000))
        .ok_or(VaultError::InvalidAmount)?;
    
    if stake_amount > total_value {
        return Err(VaultError::InsufficientBalance);
    }
    
    // Get the primary staking asset (typically native XLM or first asset)
    let staking_token = assets.get(0).ok_or(VaultError::InvalidConfiguration)?;
    
    // Get current balance
    let balance = crate::token_client::get_vault_balance(env, &staking_token);
    
    if stake_amount > balance {
        return Err(VaultError::InsufficientBalance);
    }
    
    // Get staking pool address from config
    let config: crate::types::VaultConfig = env.storage().instance()
        .get(&CONFIG)
        .ok_or(VaultError::NotInitialized)?;
    
    let staking_pool = config.staking_pool_address
        .ok_or(VaultError::InvalidConfiguration)?;
    
    // Stake tokens through liquid staking pool
    // This will deposit XLM and receive stXLM (or similar) in return
    let st_tokens_received = crate::staking_client::stake_tokens(
        env,
        &staking_pool,
        &staking_token,
        stake_amount,
    )?;
    
    // Store staking position for tracking
    let position = crate::types::StakingPosition {
        staking_pool: staking_pool.clone(),
        original_token: staking_token.clone(),
        staked_amount: stake_amount,
        st_token_amount: st_tokens_received,
        timestamp: env.ledger().timestamp(),
    };
    
    // Save position to storage
    // Key: "stake_" + staking_pool address
    let position_key = String::from_str(env, "stake_position");
    env.storage().instance().set(&position_key, &position);
    
    // Emit staking event
    crate::events::emit_vault_event(
        env,
        String::from_str(env, "tokens_staked"),
        stake_amount,
    );
    
    Ok(())
}

/// Execute liquidity provision action
fn execute_liquidity_action(
    env: &Env,
    rule: &crate::types::RebalanceRule,
    assets: &Vec<Address>,
    total_value: i128
) -> Result<(), VaultError> {
    // Need at least 2 assets for liquidity pair
    if assets.len() < 2 {
        return Err(VaultError::InvalidConfiguration);
    }
    
    // Calculate liquidity amount
    let liquidity_amount = total_value
        .checked_mul(rule.threshold)
        .and_then(|v| v.checked_div(100_0000))
        .ok_or(VaultError::InvalidAmount)?;
    
    if liquidity_amount > total_value {
        return Err(VaultError::InsufficientBalance);
    }
    
    // Get router and factory addresses from config
    let config: crate::types::VaultConfig = env.storage().instance()
        .get(&CONFIG)
        .ok_or(VaultError::NotInitialized)?;
    
    let router_address = config.router_address
        .ok_or(VaultError::InvalidConfiguration)?;
    
    let factory_address = config.factory_address
        .ok_or(VaultError::InvalidConfiguration)?;
    
    // Use first two assets as liquidity pair
    let token_a = assets.get(0).ok_or(VaultError::InvalidConfiguration)?;
    let token_b = assets.get(1).ok_or(VaultError::InvalidConfiguration)?;
    
    // Get current balances
    let balance_a = crate::token_client::get_vault_balance(env, &token_a);
    let balance_b = crate::token_client::get_vault_balance(env, &token_b);
    
    // Find the liquidity pool for this pair
    let pool_address = crate::pool_client::get_pool_for_pair(
        env,
        &factory_address,
        &token_a,
        &token_b,
    )?;
    
    // Get pool reserves to calculate optimal amounts
    use crate::pool_client::LiquidityPoolClient;
    let pool_client = LiquidityPoolClient::new(env, &pool_address);
    let (reserve_a, reserve_b) = pool_client.get_reserves();
    
    // Determine if token_a is token0 or token1 in the pool
    let pool_token0 = pool_client.token_0();
    let (reserve_a_correct, reserve_b_correct) = if &pool_token0 == &token_a {
        (reserve_a, reserve_b)
    } else {
        (reserve_b, reserve_a)
    };
    
    // Calculate amounts to provide based on pool ratio
    // Start with half of liquidity_amount for each token
    let mut amount_a = liquidity_amount / 2;
    let mut amount_b = liquidity_amount / 2;
    
    // If pool has reserves, adjust to maintain ratio
    if reserve_a_correct > 0 && reserve_b_correct > 0 {
        // Calculate optimal amount_b for our amount_a
        let optimal_b = crate::liquidity_router::get_optimal_liquidity_amounts(
            env,
            &router_address,
            amount_a,
            reserve_a_correct,
            reserve_b_correct,
        )?;
        
        if optimal_b <= balance_b {
            amount_b = optimal_b;
        } else {
            // If we don't have enough of token_b, calculate based on available token_b
            amount_b = balance_b.min(liquidity_amount / 2);
            amount_a = amount_b
                .checked_mul(reserve_a_correct)
                .and_then(|v| v.checked_div(reserve_b_correct))
                .unwrap_or(amount_a);
        }
    }
    
    // Verify we have sufficient balance
    if amount_a > balance_a || amount_b > balance_b {
        return Err(VaultError::InsufficientBalance);
    }
    
    // Add liquidity through router with 5% slippage tolerance
    let (lp_tokens, actual_a, actual_b) = crate::liquidity_router::add_liquidity_to_pool(
        env,
        &router_address,
        &token_a,
        &token_b,
        amount_a,
        amount_b,
        5, // 5% slippage
    )?;
    
    // Store liquidity position for tracking
    let position = crate::types::LiquidityPosition {
        pool_address: pool_address.clone(),
        token_a: token_a.clone(),
        token_b: token_b.clone(),
        lp_tokens,
        amount_a_provided: actual_a,
        amount_b_provided: actual_b,
        timestamp: env.ledger().timestamp(),
    };
    
    // Save position to storage
    // Key: "lp_position_" + pool address
    let position_key = String::from_str(env, "lp_position");
    env.storage().instance().set(&position_key, &position);
    
    // Emit liquidity provision event
    crate::events::emit_vault_event(
        env,
        String::from_str(env, "liquidity_provided"),
        lp_tokens,
    );
    
    Ok(())
}

/// Helper function to swap tokens using Stellar liquidity pools
fn swap_tokens(
    env: &Env,
    from_token: &Address,
    to_token: &Address,
    amount: i128,
) -> Result<i128, VaultError> {
    if amount <= 0 {
        return Err(VaultError::InvalidAmount);
    }
    
    // Get router address from vault config
    let config: crate::types::VaultConfig = env.storage().instance()
        .get(&symbol_short!("CONFIG"))
        .ok_or(VaultError::NotInitialized)?;
    
    let router_address = config.router_address
        .ok_or(VaultError::InvalidConfiguration)?;
    
    // Calculate minimum output with 1% slippage tolerance
    let min_amount_out = (amount * 99) / 100;
    
    // Approve router to spend our tokens
    crate::token_client::approve_router(
        env,
        from_token,
        &router_address,
        amount,
    )?;
    
    // Execute swap through Soroswap/Phoenix router
    let amount_out = crate::swap_router::swap_via_router(
        env,
        &router_address,
        from_token,
        to_token,
        amount,
        min_amount_out,
    )?;
    
    Ok(amount_out)
}

/// Get optimal swap route between two tokens
fn get_swap_route(
    env: &Env,
    from_token: &Address,
    to_token: &Address,
) -> Result<Vec<Address>, VaultError> {
    // In production, this would query Stellar's liquidity pool network
    // to find the optimal path (lowest slippage, best price)
    
    // For direct pairs, return simple path
    let mut path: Vec<Address> = Vec::new(env);
    path.push_back(from_token.clone());
    path.push_back(to_token.clone());
    
    // For production:
    // 1. Query all available liquidity pools
    // 2. Build a graph of token pairs
    // 3. Find optimal path using Dijkstra's algorithm or similar
    // 4. Consider factors: liquidity depth, fees, slippage
    
    Ok(path)
}

/// Execute token swap through Stellar AMM
fn execute_amm_swap(
    env: &Env,
    from_token: &Address,
    to_token: &Address,
    amount_in: i128,
    min_amount_out: i128,
) -> Result<i128, VaultError> {
    // Use the swap_tokens function which now uses the router
    let amount_out = swap_tokens(env, from_token, to_token, amount_in)?;
    
    // Verify minimum output
    if amount_out < min_amount_out {
        return Err(VaultError::SlippageTooHigh);
    }
    
    Ok(amount_out)
}
