#![no_std]

// Vault contract module structure
mod types;
mod vault;
mod engine;
mod rebalance;
mod events;
// mod factory;  // Factory should be a separate contract
mod errors;
// mod vault_nft;  // VaultNFT should be a separate contract
// mod nft_types;

// Export the main vault contract
pub use vault::*;

// Export types and errors for external use
pub use types::*;
pub use errors::*;
