//! USDC Token Contract for Futurenet
//!
//! This is a standard SEP-41 fungible token configured as USDC
//! with 6 decimals (same as real USDC)

use soroban_sdk::{
    contract, contracterror, contractimpl, panic_with_error, symbol_short, token::TokenInterface,
    Address, Env, String, Symbol,
};
use stellar_contract_utils::pausable::{self as pausable, Pausable};
use stellar_macros::when_not_paused;
use stellar_tokens::fungible::Base;

pub const OWNER: Symbol = symbol_short!("OWNER");

#[contract]
pub struct USDCToken;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum USDCTokenError {
    Unauthorized = 1,
}

#[contractimpl]
impl USDCToken {
    /// Initialize USDC token with owner and initial supply
    pub fn __constructor(e: &Env, owner: Address, initial_supply: i128) {
        // Set USDC metadata: 6 decimals, "USD Coin", "USDC"
        Base::set_metadata(e, 6, String::from_str(e, "USD Coin"), String::from_str(e, "USDC"));
        Base::mint(e, &owner, initial_supply);
        e.storage().instance().set(&OWNER, &owner);
    }

    /// Get total supply
    pub fn total_supply(e: &Env) -> i128 {
        Base::total_supply(e)
    }

    /// Mint new tokens (owner only)
    #[when_not_paused]
    pub fn mint(e: &Env, to: Address, amount: i128) {
        let owner: Address = e.storage().instance().get(&OWNER).expect("owner should be set");
        owner.require_auth();

        Base::mint(e, &to, amount);
    }
    
    /// Get the owner address
    pub fn owner(e: &Env) -> Address {
        e.storage().instance().get(&OWNER).expect("owner should be set")
    }
}

#[contractimpl]
impl Pausable for USDCToken {
    fn paused(e: &Env) -> bool {
        pausable::paused(e)
    }

    fn pause(e: &Env, caller: Address) {
        caller.require_auth();
        let owner: Address = e.storage().instance().get(&OWNER).expect("owner should be set");
        if owner != caller {
            panic_with_error!(e, USDCTokenError::Unauthorized);
        }

        pausable::pause(e);
    }

    fn unpause(e: &Env, caller: Address) {
        caller.require_auth();
        let owner: Address = e.storage().instance().get(&OWNER).expect("owner should be set");
        if owner != caller {
            panic_with_error!(e, USDCTokenError::Unauthorized);
        }

        pausable::unpause(e);
    }
}

#[contractimpl]
impl TokenInterface for USDCToken {
    fn balance(e: Env, account: Address) -> i128 {
        Base::balance(&e, &account)
    }

    fn allowance(e: Env, owner: Address, spender: Address) -> i128 {
        Base::allowance(&e, &owner, &spender)
    }

    #[when_not_paused]
    fn transfer(e: Env, from: Address, to: Address, amount: i128) {
        Base::transfer(&e, &from, &to, amount);
    }

    #[when_not_paused]
    fn transfer_from(e: Env, spender: Address, from: Address, to: Address, amount: i128) {
        Base::transfer_from(&e, &spender, &from, &to, amount);
    }

    fn approve(e: Env, owner: Address, spender: Address, amount: i128, live_until_ledger: u32) {
        Base::approve(&e, &owner, &spender, amount, live_until_ledger);
    }

    #[when_not_paused]
    fn burn(e: Env, from: Address, amount: i128) {
        Base::burn(&e, &from, amount)
    }

    #[when_not_paused]
    fn burn_from(e: Env, spender: Address, from: Address, amount: i128) {
        Base::burn_from(&e, &spender, &from, amount)
    }

    fn decimals(e: Env) -> u32 {
        Base::decimals(&e)
    }

    fn name(e: Env) -> String {
        Base::name(&e)
    }

    fn symbol(e: Env) -> String {
        Base::symbol(&e)
    }
}
