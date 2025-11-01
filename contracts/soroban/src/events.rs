// Event emissions for vault actions
use soroban_sdk::{symbol_short, Address, Env, Symbol, String};

const DEPOSIT: Symbol = symbol_short!("deposit");
const WITHDRAW: Symbol = symbol_short!("withdraw");
const REBALANCE: Symbol = symbol_short!("rebalance");

pub fn emit_deposit(env: &Env, user: &Address, amount: i128, shares: i128) {
    env.events().publish((DEPOSIT, user), (amount, shares));
}

pub fn emit_withdraw(env: &Env, user: &Address, shares: i128, amount: i128) {
    env.events().publish((WITHDRAW, user), (shares, amount));
}

pub fn emit_rebalance(env: &Env, timestamp: u64) {
    env.events().publish((REBALANCE,), timestamp);
}

pub fn emit_vault_event(env: &Env, event_type: String, amount: i128) {
    env.events().publish((event_type,), amount);
}
