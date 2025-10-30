// Error types for vault operations
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InsufficientBalance = 4,
    InsufficientShares = 5,
    InvalidAmount = 6,
    InvalidConfiguration = 7,
    RebalanceFailed = 8,
    TransferFailed = 9,
    NFTNotFound = 10,
    InvalidOwnership = 11,
    OwnershipExceeded = 12,
    SlippageTooHigh = 13,
    SwapFailed = 14,
    PoolNotFound = 15,
    InsufficientLiquidity = 16,
    RouterNotSet = 17,
}
