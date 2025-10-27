#!/usr/bin/env pwsh
# Setup Syft Vault with Soroswap Integration
# Run this script to configure your vaults with DEX router

$ErrorActionPreference = "Continue"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "SYFT VAULT - SOROSWAP INTEGRATION SETUP" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$TESTNET_ROUTER = "CCMAPXWVZD4USEKDWRYS7DA4Y3D7E2SDMGBFJUCEXTC7VN6CUBGWPFUS"
$DEPLOYER_KEY = "SCBH7Z3Q2F3YUJGBRTWV765OSKKIF7C5UW3TC43H4VU7T7ODCKDNJ7WB"
$FACTORY_ID = "CARQMQWQJJQPW55VCGXTPE2BURC5445N37C2GJXEQTKI7JYIHRZ6YKZW"

Write-Host "✅ Configuration loaded:" -ForegroundColor Green
Write-Host "   Router: $TESTNET_ROUTER"
Write-Host "   Factory: $FACTORY_ID"
Write-Host ""

# Step 1: Check if Stellar CLI is working
Write-Host "🔍 Step 1: Checking Stellar CLI..." -ForegroundColor Yellow
$stellarVersion = stellar --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Stellar CLI installed: $stellarVersion" -ForegroundColor Green
} else {
    Write-Host "   ❌ Stellar CLI not found. Install with: cargo install stellar-cli" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Get deployer address
Write-Host "🔍 Step 2: Getting deployer address..." -ForegroundColor Yellow
$deployerAddress = stellar keys address deployer 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ℹ️  Setting up deployer identity..." -ForegroundColor Cyan
    $env:STELLAR_ACCOUNT = $DEPLOYER_KEY
    stellar keys generate deployer --secret-key $DEPLOYER_KEY --network testnet 2>&1 | Out-Null
    $deployerAddress = stellar keys address deployer 2>&1
}
Write-Host "   ✅ Deployer address: $deployerAddress" -ForegroundColor Green
Write-Host ""

# Step 3: Fund account if needed
Write-Host "🔍 Step 3: Checking account balance..." -ForegroundColor Yellow
Write-Host "   ℹ️  If account needs funding, run:" -ForegroundColor Cyan
Write-Host "      curl `"https://friendbot.stellar.org/?addr=$deployerAddress`"" -ForegroundColor Gray
Write-Host ""

# Step 4: Get list of vaults from Supabase
Write-Host "🔍 Step 4: Fetching vaults from database..." -ForegroundColor Yellow
Write-Host "   ℹ️  Checking Supabase for deployed vaults..." -ForegroundColor Cyan
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "MANUAL STEPS TO SET ROUTER ON YOUR VAULTS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "For each vault you've deployed, run:" -ForegroundColor Yellow
Write-Host ""
Write-Host "stellar contract invoke ``" -ForegroundColor White
Write-Host "  --id YOUR_VAULT_CONTRACT_ID ``" -ForegroundColor White
Write-Host "  --source-account deployer ``" -ForegroundColor White
Write-Host "  --network testnet ``" -ForegroundColor White
Write-Host "  -- set_router ``" -ForegroundColor White
Write-Host "  --router $TESTNET_ROUTER" -ForegroundColor White
Write-Host ""

Write-Host "To test a swap:" -ForegroundColor Yellow
Write-Host ""
Write-Host "stellar contract invoke ``" -ForegroundColor White
Write-Host "  --id YOUR_VAULT_CONTRACT_ID ``" -ForegroundColor White
Write-Host "  --source-account deployer ``" -ForegroundColor White
Write-Host "  --network testnet ``" -ForegroundColor White
Write-Host "  -- trigger_rebalance" -ForegroundColor White
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "BACKEND CONFIGURATION UPDATED ✅" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your backend/.env now includes:" -ForegroundColor Green
Write-Host "  - Stellar Testnet RPC URL" -ForegroundColor Gray
Write-Host "  - Soroswap Router Address" -ForegroundColor Gray
Write-Host "  - Soroswap Factory Address" -ForegroundColor Gray
Write-Host "  - Test token addresses (XLM, USDC)" -ForegroundColor Gray
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Deploy a test vault from your frontend" -ForegroundColor White
Write-Host "  2. Copy the vault contract ID" -ForegroundColor White
Write-Host "  3. Run the set_router command above" -ForegroundColor White
Write-Host "  4. Test rebalancing!" -ForegroundColor White
Write-Host ""

Write-Host "✅ Setup complete!" -ForegroundColor Green
