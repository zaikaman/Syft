#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Address, Env, String, Vec, symbol_short, Map, Symbol};

const NFT_COUNTER: Symbol = symbol_short!("NFT_CNT");
const NFT_PREFIX: &str = "NFT";
const VAULT_NFTS_PREFIX: &str = "V_NFTS";
const MAX_OWNERSHIP_PCT: i128 = 10000; // 100% = 10000 basis points

// Error types
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultNFTError {
    Unauthorized = 1,
    InvalidAmount = 2,
    NFTNotFound = 3,
    InvalidOwnership = 4,
    OwnershipExceeded = 5,
}

// Data structures
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

#[contract]
pub struct VaultNFTContract;

#[contractimpl]
impl VaultNFTContract {
    /// Mint a new vault NFT
    /// T125: Implement NFT minting function with ownership percentage
    pub fn mint_nft(
        env: Env,
        minter: Address,
        vault_address: Address,
        ownership_percentage: i128,
        metadata: NFTMetadata,
    ) -> Result<u64, VaultNFTError> {
        // Verify minter is authorized
        minter.require_auth();
        
        // Validate ownership percentage (1-10000 basis points = 0.01% - 100%)
        if ownership_percentage <= 0 || ownership_percentage > MAX_OWNERSHIP_PCT {
            return Err(VaultNFTError::InvalidOwnership);
        }
        
        // Get next NFT ID
        let nft_id: u64 = env.storage()
            .instance()
            .get(&NFT_COUNTER)
            .unwrap_or(0);
        
        let next_id = nft_id + 1;
        
        // Create NFT
        let nft = VaultNFT {
            nft_id: next_id,
            vault_address: vault_address.clone(),
            ownership_percentage,
            holder: minter.clone(),
            metadata: format_metadata(&metadata),
        };
        
        // Store NFT
        env.storage().instance().set(&(NFT_PREFIX, next_id), &nft);
        
        // Update counter
        env.storage().instance().set(&NFT_COUNTER, &next_id);
        
        // Add to vault's NFT list
        let mut vault_nfts: Vec<u64> = env.storage()
            .instance()
            .get(&(VAULT_NFTS_PREFIX, &vault_address))
            .unwrap_or(Vec::new(&env));
        vault_nfts.push_back(next_id);
        env.storage().instance().set(&(VAULT_NFTS_PREFIX, &vault_address), &vault_nfts);
        
        // Emit event
        env.events().publish(
            (symbol_short!("NFT_MINT"), &vault_address),
            (next_id, &minter, ownership_percentage)
        );
        
        Ok(next_id)
    }

    /// Transfer NFT ownership
    /// T127: Add NFT transfer functionality with ownership updates
    pub fn transfer(
        env: Env,
        nft_id: u64,
        from: Address,
        to: Address,
    ) -> Result<(), VaultNFTError> {
        // Verify sender is authorized
        from.require_auth();
        
        // Get NFT
        let mut nft: VaultNFT = env.storage()
            .instance()
            .get(&(NFT_PREFIX, nft_id))
            .ok_or(VaultNFTError::NFTNotFound)?;
        
        // Verify ownership
        if nft.holder != from {
            return Err(VaultNFTError::Unauthorized);
        }
        
        // Update holder
        nft.holder = to.clone();
        
        // Save updated NFT
        env.storage().instance().set(&(NFT_PREFIX, nft_id), &nft);
        
        // Emit event
        env.events().publish(
            (symbol_short!("NFT_XFER"), nft_id),
            (&from, &to)
        );
        
        Ok(())
    }

    /// Get NFT details
    pub fn get_nft(env: Env, nft_id: u64) -> Result<VaultNFT, VaultNFTError> {
        env.storage()
            .instance()
            .get(&(NFT_PREFIX, nft_id))
            .ok_or(VaultNFTError::NFTNotFound)
    }
    
    /// Get all NFTs for a vault
    pub fn get_vault_nfts(env: Env, vault_address: Address) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&(VAULT_NFTS_PREFIX, &vault_address))
            .unwrap_or(Vec::new(&env))
    }

    /// Distribute profits to NFT holders
    /// T126: Implement profit distribution logic proportional to shares
    pub fn distribute_profits(
        env: Env,
        vault_address: Address,
        total_profit: i128,
        _token: Address,
    ) -> Result<Map<Address, i128>, VaultNFTError> {
        // Verify caller
        vault_address.require_auth();
        
        if total_profit <= 0 {
            return Err(VaultNFTError::InvalidAmount);
        }
        
        // Get all NFTs for this vault
        let nft_ids: Vec<u64> = Self::get_vault_nfts(env.clone(), vault_address.clone());
        
        let mut distributions = Map::new(&env);
        let mut total_distributed: i128 = 0;
        
        // Calculate distribution for each NFT holder
        for i in 0..nft_ids.len() {
            let nft_id = nft_ids.get(i).unwrap();
            let nft: VaultNFT = Self::get_nft(env.clone(), nft_id)?;
            
            // Calculate holder's share based on ownership percentage
            // ownership_percentage is in basis points (10000 = 100%)
            let holder_share = (total_profit * nft.ownership_percentage) / MAX_OWNERSHIP_PCT;
            
            if holder_share > 0 {
                // Add to or update holder's distribution
                let current = distributions.get(nft.holder.clone()).unwrap_or(0);
                distributions.set(nft.holder.clone(), current + holder_share);
                total_distributed += holder_share;
            }
        }
        
        // Emit distribution event
        env.events().publish(
            (symbol_short!("PROFIT"), &vault_address),
            (total_profit, total_distributed, distributions.len())
        );
        
        Ok(distributions)
    }
    
    /// Get total ownership percentage for a vault (should not exceed 100%)
    pub fn get_total_ownership(env: Env, vault_address: Address) -> Result<i128, VaultNFTError> {
        let nft_ids: Vec<u64> = Self::get_vault_nfts(env.clone(), vault_address);
        let mut total: i128 = 0;
        
        for i in 0..nft_ids.len() {
            let nft_id = nft_ids.get(i).unwrap();
            let nft: VaultNFT = Self::get_nft(env.clone(), nft_id)?;
            total += nft.ownership_percentage;
        }
        
        Ok(total)
    }
}

// Helper function to format metadata
fn format_metadata(metadata: &NFTMetadata) -> String {
    // Simple JSON-like formatting for metadata
    metadata.name.clone()
}
