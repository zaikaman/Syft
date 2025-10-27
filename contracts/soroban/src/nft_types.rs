// Vault NFT data structures
use soroban_sdk::{contracttype, Address, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultNFT {
    pub nft_id: u64,
    pub vault_address: Address,
    pub ownership_percentage: i128,
    pub holder: Address,
    pub metadata: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NFTMetadata {
    pub name: String,
    pub description: String,
    pub image_url: String,
    pub vault_performance: i128,
}
