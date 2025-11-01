#![no_std]

// Vault contract module structure
mod types;
mod vault;
mod engine;
mod rebalance;
mod events;
mod errors;
mod token_client;
mod swap_router;
mod soroswap_router;
mod pool_client;  // Direct pool interaction
mod staking_client;  // Liquid staking integration
mod liquidity_router;  // Liquidity provision
// mod factory;  // Factory should be a separate contract
// mod vault_nft;  // VaultNFT should be a separate contract
// mod nft_types;

// Export the main vault contract
pub use vault::*;

// Export types and errors for external use
pub use types::*;
pub use errors::*;
