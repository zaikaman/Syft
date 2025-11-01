#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Token,        // The XLM token being staked
    TotalStaked,  // Total amount currently staked
    UserStake(Address), // Amount staked per user
}

#[contract]
pub struct MockStakingPool;

#[contractimpl]
impl MockStakingPool {
    /// Initialize the staking pool with the token to stake
    pub fn initialize(env: Env, token: Address) {
        if env.storage().instance().has(&DataKey::Token) {
            panic!("already initialized");
        }
        
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::TotalStaked, &0i128);
    }

    /// Stake tokens - transfers tokens from user to this contract
    pub fn stake_tokens(env: Env, from: Address, amount: i128) -> i128 {
        from.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let token: Address = env.storage().instance().get(&DataKey::Token)
            .expect("not initialized");

        // Transfer tokens from user to this contract
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        // Update user's staked amount
        let user_key = DataKey::UserStake(from.clone());
        let current_stake: i128 = env.storage()
            .persistent()
            .get(&user_key)
            .unwrap_or(0);
        let new_stake = current_stake + amount;
        env.storage().persistent().set(&user_key, &new_stake);

        // Update total staked
        let total: i128 = env.storage().instance().get(&DataKey::TotalStaked).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalStaked, &(total + amount));

        // Return amount staked (1:1 ratio, so same as input)
        amount
    }

    /// Unstake tokens - transfers tokens back to user
    pub fn unstake_tokens(env: Env, from: Address, amount: i128) -> i128 {
        from.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        // Check user has enough staked
        let user_key = DataKey::UserStake(from.clone());
        let current_stake: i128 = env.storage()
            .persistent()
            .get(&user_key)
            .unwrap_or(0);
        
        if current_stake < amount {
            panic!("insufficient stake");
        }

        let token: Address = env.storage().instance().get(&DataKey::Token)
            .expect("not initialized");

        // Transfer tokens back to user
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &from, &amount);

        // Update user's staked amount
        let new_stake = current_stake - amount;
        if new_stake == 0 {
            env.storage().persistent().remove(&user_key);
        } else {
            env.storage().persistent().set(&user_key, &new_stake);
        }

        // Update total staked
        let total: i128 = env.storage().instance().get(&DataKey::TotalStaked).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalStaked, &(total - amount));

        // Return amount unstaked
        amount
    }

    /// Get current staking rate (1:1 for mock, returns 1_000_000 which represents 1.0 with 6 decimals)
    pub fn get_staking_rate(env: Env) -> i128 {
        let _ = env; // Prevent unused variable warning
        1_000_000 // 1.0 with 6 decimal places
    }

    /// Get user's staked amount
    pub fn get_user_stake(env: Env, user: Address) -> i128 {
        let user_key = DataKey::UserStake(user);
        env.storage().persistent().get(&user_key).unwrap_or(0)
    }

    /// Get total staked in pool
    pub fn get_total_staked(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalStaked).unwrap_or(0)
    }

    /// Get the token address being staked
    pub fn get_token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token)
            .expect("not initialized")
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
        token, Address, Env, IntoVal, Symbol,
    };

    fn create_token_contract<'a>(
        env: &Env,
        admin: &Address,
    ) -> (token::Client<'a>, token::StellarAssetClient<'a>) {
        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        (
            token::Client::new(env, &sac.address()),
            token::StellarAssetClient::new(env, &sac.address()),
        )
    }

    #[test]
    fn test_stake_and_unstake() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        let (token, token_admin) = create_token_contract(&env, &admin);
        let pool_id = env.register(MockStakingPool, ());
        let pool = MockStakingPoolClient::new(&env, &pool_id);

        // Initialize pool
        pool.initialize(&token.address);

        // Mint tokens to user
        token_admin.mint(&user, &1000);
        assert_eq!(token.balance(&user), 1000);

        // Stake 500 tokens
        let staked = pool.stake_tokens(&user, &500);
        assert_eq!(staked, 500);
        assert_eq!(token.balance(&user), 500);
        assert_eq!(token.balance(&pool_id), 500);
        assert_eq!(pool.get_user_stake(&user), 500);
        assert_eq!(pool.get_total_staked(), 500);

        // Unstake 200 tokens
        let unstaked = pool.unstake_tokens(&user, &200);
        assert_eq!(unstaked, 200);
        assert_eq!(token.balance(&user), 700);
        assert_eq!(token.balance(&pool_id), 300);
        assert_eq!(pool.get_user_stake(&user), 300);
        assert_eq!(pool.get_total_staked(), 300);

        // Check staking rate
        assert_eq!(pool.get_staking_rate(), 1_000_000);
    }

    #[test]
    #[should_panic(expected = "insufficient stake")]
    fn test_unstake_too_much() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        let (token, token_admin) = create_token_contract(&env, &admin);
        let pool_id = env.register(MockStakingPool, ());
        let pool = MockStakingPoolClient::new(&env, &pool_id);

        pool.initialize(&token.address);
        token_admin.mint(&user, &1000);

        pool.stake_tokens(&user, &500);
        pool.unstake_tokens(&user, &600); // Should panic
    }
}
