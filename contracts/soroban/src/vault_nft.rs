// Vault NFT contract for fractional ownership
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec, symbol_short, Map};
use crate::nft_types::{VaultNFT, NFTMetadata};
use crate::errors::VaultError;

const NFT_COUNTER: &str = "NFT_CNT";
const NFT_PREFIX: &str = "NFT";
const VAULT_NFTS_PREFIX: &str = "V_NFTS";
const MAX_OWNERSHIP_PCT: i128 = 10000; // 100% = 10000 basis points

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
    ) -> Result<u64, VaultError> {
        // Verify minter is authorized
        minter.require_auth();
        
        // Validate ownership percentage (1-10000 basis points = 0.01% - 100%)
        if ownership_percentage <= 0 || ownership_percentage > MAX_OWNERSHIP_PCT {
            return Err(VaultError::InvalidOwnership);
        }
        
        // Get next NFT ID
        let nft_id: u64 = env.storage()
            .instance()
            .get(&symbol_short!(NFT_COUNTER))
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
        env.storage().instance().set(&symbol_short!(NFT_COUNTER), &next_id);
        
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
    ) -> Result<(), VaultError> {
        // Verify sender is authorized
        from.require_auth();
        
        // Get NFT
        let mut nft: VaultNFT = env.storage()
            .instance()
            .get(&(NFT_PREFIX, nft_id))
            .ok_or(VaultError::NFTNotFound)?;
        
        // Verify ownership
        if nft.holder != from {
            return Err(VaultError::Unauthorized);
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
    pub fn get_nft(env: Env, nft_id: u64) -> Result<VaultNFT, VaultError> {
        env.storage()
            .instance()
            .get(&(NFT_PREFIX, nft_id))
            .ok_or(VaultError::NFTNotFound)
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
        token: Address,
    ) -> Result<Map<Address, i128>, VaultError> {
        // Verify caller
        vault_address.require_auth();
        
        if total_profit <= 0 {
            return Err(VaultError::InvalidAmount);
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
    pub fn get_total_ownership(env: Env, vault_address: Address) -> Result<i128, VaultError> {
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
