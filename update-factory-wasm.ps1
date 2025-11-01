#!/usr/bin/env pwsh

# Update Factory with New Vault WASM Hash
# This script updates the existing factory contract to use the new vault WASM

$ErrorActionPreference = "Stop"

# Configuration
$NETWORK = "testnet"
$FACTORY_ID = "CCODOMK6HSVVKX7FP2CCUVL7VKKOYCO3AJPWC5C656RP4FXGFPWU3YM2"
$NEW_WASM_HASH = "06223d4f8cdf361c5a63018aa93ee731f4a22a72e028da700736880c3de970a7"

# Load deployer key from .env
$envPath = ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^DEPLOYER_SECRET_KEY=(.+)$') {
            $env:DEPLOYER_SECRET = $matches[1]
        }
    }
}

if (-not $env:DEPLOYER_SECRET) {
    Write-Host "❌ DEPLOYER_SECRET_KEY not found in .env" -ForegroundColor Red
    exit 1
}

# Get deployer address
$DEPLOYER_ADDRESS = stellar keys address deployer 2>$null
if (-not $DEPLOYER_ADDRESS) {
    Write-Host "❌ Could not get deployer address" -ForegroundColor Red
    Write-Host "   Run: stellar keys generate deployer --network testnet" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n🏭 Updating Factory WASM Hash" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

Write-Host "Factory: $FACTORY_ID" -ForegroundColor Gray
Write-Host "Admin: $DEPLOYER_ADDRESS" -ForegroundColor Gray
Write-Host "New WASM: $NEW_WASM_HASH" -ForegroundColor Green

# Check current WASM hash
Write-Host "`n📋 Current WASM hash:" -ForegroundColor Yellow
$currentHash = stellar contract invoke `
    --id $FACTORY_ID `
    --source-account $env:DEPLOYER_SECRET `
    --rpc-url https://soroban-testnet.stellar.org:443 `
    --network-passphrase "Test SDF Network ; September 2015" `
    -- get_vault_wasm_hash 2>&1 | Select-Object -Last 1

Write-Host "   $currentHash" -ForegroundColor Gray

if ($currentHash -match $NEW_WASM_HASH) {
    Write-Host "`n✅ Factory already using the new WASM hash!" -ForegroundColor Green
    exit 0
}

# Update factory
Write-Host "`n🔄 Updating factory..." -ForegroundColor Yellow

$result = stellar contract invoke `
    --id $FACTORY_ID `
    --source-account $env:DEPLOYER_SECRET `
    --rpc-url https://soroban-testnet.stellar.org:443 `
    --network-passphrase "Test SDF Network ; September 2015" `
    -- update_wasm `
    --admin $DEPLOYER_ADDRESS `
    --new_wasm_hash $NEW_WASM_HASH 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Failed to update factory:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}

# Verify update
Write-Host "`n✓ Update transaction submitted" -ForegroundColor Green
Write-Host "`n📋 Verifying new WASM hash..." -ForegroundColor Yellow

Start-Sleep -Seconds 2

$newHash = stellar contract invoke `
    --id $FACTORY_ID `
    --source-account $env:DEPLOYER_SECRET `
    --rpc-url https://soroban-testnet.stellar.org:443 `
    --network-passphrase "Test SDF Network ; September 2015" `
    -- get_vault_wasm_hash 2>&1 | Select-Object -Last 1

Write-Host "   $newHash" -ForegroundColor Gray

if ($newHash -match $NEW_WASM_HASH) {
    Write-Host "`n✅ Factory successfully updated!" -ForegroundColor Green
    Write-Host "`n🎉 All new vaults will now use the fixed WASM with direct pool swaps" -ForegroundColor Cyan
} else {
    Write-Host "`n⚠️  Update may have failed - hash didn't change" -ForegroundColor Yellow
}
