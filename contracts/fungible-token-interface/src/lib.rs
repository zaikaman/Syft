#![no_std]

// Use USDC contract as the main export
mod usdc;
pub use usdc::*;

// Keep other modules for reference but don't export
#[cfg(test)]
mod test;
