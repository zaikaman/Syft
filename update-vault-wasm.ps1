# Update Vault Factory with new WASM

$ErrorActionPreference = "Stop"

Write-Host "🔄 Updating Vault Factory with new vault WASM..." -ForegroundColor Cyan

# Load environment variables
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$') {
            $name = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($name, $value)
        }
    }
}

$DEPLOYER_SECRET = $env:DEPLOYER_SECRET_KEY
$FACTORY_ADDRESS = $env:VAULT_FACTORY_CONTRACT_ID
$NETWORK = "testnet"

if (-not $DEPLOYER_SECRET) {
    Write-Host "❌ DEPLOYER_SECRET_KEY not found in .env" -ForegroundColor Red
    exit 1
}

if (-not $FACTORY_ADDRESS) {
    Write-Host "❌ VAULT_FACTORY_CONTRACT_ID not found in .env" -ForegroundColor Red
    exit 1
}

# 1. Install the new vault WASM and get the hash
Write-Host "`n📦 Installing new vault WASM..." -ForegroundColor Yellow
$wasmPath = "target\wasm32v1-none\release\syft_vault.wasm"

if (-not (Test-Path $wasmPath)) {
    Write-Host "❌ WASM file not found at: $wasmPath" -ForegroundColor Red
    Write-Host "   Run: stellar contract build --package syft-vault" -ForegroundColor Yellow
    exit 1
}

Write-Host "   Using WASM: $wasmPath" -ForegroundColor Gray

# Install WASM and capture the hash
$installOutput = stellar contract install `
    --wasm $wasmPath `
    --network $NETWORK `
    --source $DEPLOYER_SECRET 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install WASM:" -ForegroundColor Red
    Write-Host $installOutput -ForegroundColor Red
    exit 1
}

# Extract WASM hash from output
$wasmHash = $installOutput | Select-String -Pattern "^[A-Fa-f0-9]{64}$" | ForEach-Object { $_.Matches[0].Value }

if (-not $wasmHash) {
    Write-Host "❌ Could not extract WASM hash from install output" -ForegroundColor Red
    Write-Host "Output was:" -ForegroundColor Yellow
    Write-Host $installOutput
    exit 1
}

Write-Host "✅ WASM installed with hash: $wasmHash" -ForegroundColor Green

# 2. Update the factory with the new WASM hash
Write-Host "`n🏭 Updating factory with new WASM hash..." -ForegroundColor Yellow

# The factory's initialize function can only be called once
# We need to either:
# A) Deploy a new factory, or
# B) Add an update_wasm function to the factory

Write-Host "`n⚠️  Note: The factory contract needs an update_wasm() function" -ForegroundColor Yellow
Write-Host "   Current factory only has initialize() which can only be called once" -ForegroundColor Yellow
Write-Host "`n📝 Options:" -ForegroundColor Cyan
Write-Host "   1. Deploy a NEW factory contract with this WASM hash" -ForegroundColor White
Write-Host "   2. Add update_wasm() function to factory and redeploy it" -ForegroundColor White

Write-Host "`n✅ New WASM Hash: $wasmHash" -ForegroundColor Green
Write-Host "`n💾 Save this hash to update your factory!" -ForegroundColor Cyan
